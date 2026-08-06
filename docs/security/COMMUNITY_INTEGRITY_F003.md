# Community Competitive Integrity — F-003 Remediation Spec

**Status:** MVP IMPLEMENTED (2026-08-06), flag still OFF. The server recompute,
immutable event log, provenance, anomaly rules → provisional/held ranks, rules +
parity/anomaly unit tests are built and green; `COMMUNITY_BACKEND` stays `false`
until the human/infra gate items in [§8](#8-definition-of-done-for-the-gate) are
signed off. Launch gate for flipping `COMMUNITY_BACKEND=true`
([`src/community/backendConfig.ts`](../../src/community/backendConfig.ts)).
**Audit:** Community audit F-003 (Critical). See memory `community-audit-remediation-2026-08`.
**Owner:** the review-queue/appeals scope and the items in [§7](#7-open-owner-decisions)
remain owner calls; the MVP was built on the recommended path.

### What shipped in the MVP (code)

| Piece | Where |
|-------|-------|
| Shared scoring core (client display == server recompute) | [`src/community/scoring.ts`](../../src/community/scoring.ts) |
| Anomaly rules → `ok`/`provisional`/`held` | [`src/community/anomaly.ts`](../../src/community/anomaly.ts) |
| Server ingest + immutable log + recompute + provenance | [`functions/src/community.ts`](../../functions/src/community.ts) `syncCommunityStats` |
| Selectors delegate to the shared core (no drift) | [`src/store/selectors.ts`](../../src/store/selectors.ts) |
| Client sends RAW inputs, not metrics | [`src/community/backend.ts`](../../src/community/backend.ts), [`src/community/LeagueScreen.tsx`](../../src/community/LeagueScreen.tsx) |
| Rules for the log (owner-read, client-write denied) | [`firestore.rules`](../../firestore.rules) + [`test/rules/firestore.test.mjs`](../../test/rules/firestore.test.mjs) |
| Scheduled reprocessing sweep | [`functions/src/community.ts`](../../functions/src/community.ts) `reprocessStandings` |
| Review queue + appeals + owner resolution | [`functions/src/community.ts`](../../functions/src/community.ts) `appealStanding` / `resolveStandingReview`, `communityReviews/{uid}` |
| Deletion + export of the community log | [`functions/src/account.ts`](../../functions/src/account.ts), [`src/store/cloudRepo.ts`](../../src/store/cloudRepo.ts) |
| Parity + anomaly unit tests | [`test/unit/communityScoring.test.mjs`](../../test/unit/communityScoring.test.mjs), [`communityAnomaly.test.mjs`](../../test/unit/communityAnomaly.test.mjs) |

---

## 1. The finding in one line

The server never derives the competitive metrics — it *transcribes* them. Every
number that ranks a user in a league or a friend group is computed on the client
and posted up; the server only clamps ranges.

| Metric | Computed by | Trust |
|--------|-------------|-------|
| `odometer` / `points` (0–100 weekly consistency) | [`weeklyIndex()`](../../src/store/selectors.ts) client-side | **untrusted** |
| `streakCurrent` / `streakBest` | [`streakStats()`](../../src/store/selectors.ts) client-side | **untrusted** |
| `volume7` / `volume30` | `totalVolumeRange()` client-side | **untrusted** |
| `sessionsThisWeek` | `workoutsInRange() + activitiesInRange()` client-side | **untrusted** |

[`syncCommunityStats`](../../functions/src/community.ts) receives these via
`intIn()` (range clamp only) and writes them into
`leagueStandings/{weekKey}/tiers/{tier}/members/{uid}` and each
`groups/{gid}/members/{uid}`. A patched client posts `points: 100` weekly and the
ladder is fiction. PR #55's per-user rate limits + validation harden the endpoint
but do not add integrity — clamping a fabricated number keeps it fabricated.

Per [`DATA_SCHEMA.md`](DATA_SCHEMA.md) trust zones, workout/habit/nutrition logs
are **Zone A (client-owned)** and *"a backend must never treat this as verified."*
Community scoring violates that rule directly.

## 2. What "server-authoritative" can and cannot mean here

Workouts and habits are **self-logged** and live in Zone A `users/{uid}`
subcollections. There is no server-issued workout whose completion the server
witnesses, so **provable** integrity is out of reach while a human self-reports.

The realistic target is defense-in-depth:

1. Recompute every eligible metric **on the server** from an **append-only,
   server-timestamped event log** the client cannot retro-edit.
2. Stamp each standing with a **calc version + provenance** so any number is
   reproducible and auditable.
3. Layer **anomaly rules → provisional ranks → review/appeals** so implausible
   climbs are held back rather than trusted.

This turns "trust the client's answer" into "trust only immutable, timestamped
inputs, recompute deterministically, and quarantine the implausible." That is the
bar F-003 asks for.

## 3. Trust model: a server-written immutable log

> **Deviation from the original design (recorded).** The first draft put the log
> at a **client-writable** `users/{uid}/events` (create-only rules). During build
> we chose a **server-written** log instead, because the existing architecture's
> invariant is *"all writes to competitive/community data go through Cloud
> Functions; clients only read"* ([`firestore.rules`](../../firestore.rules)
> community section). A client-writable path would breach that and widen Zone A's
> write surface. The callable is now the **only** writer, so append-only
> immutability is enforced by code **and** by rules `write: if false` — strictly
> stronger than create-only client rules, and consistent with the rest of the hub.

Two server-owned collections under the community record:

```
communityProfiles/{uid}/scoreDays/{dayKey}    current per-day inputs (recompute source)
communityProfiles/{uid}/scoreEvents/{autoId}   append-only immutable change trail
```

Firestore rules ([`firestore.rules`](../../firestore.rules), tested in
[`test/rules/firestore.test.mjs`](../../test/rules/firestore.test.mjs)):

- **All client writes denied** (`write: if false`) on both collections — only the
  Admin-SDK callable writes, and it only ever appends to `scoreEvents` (never
  updates or deletes it). The trail is immutable from every client's perspective.
- `get`/`list`: **owner-only**, so a user can inspect/export their own scoring
  inputs (transparency), but no one can read another user's log.

Why two collections: `scoreDays` is the compact, current per-day truth the
recompute reads (bounded, ~one doc/day); `scoreEvents` is the immutable audit
trail — a new event is appended only when a day's content actually changes (a
`rev` bump), which keeps it bounded while preserving the tamper/backfill history
anomaly detection needs. The mutable Zone A `habits`/`sessions` logs remain the UX
source of truth; the client serializes them into day records and posts those.

> **This does not make the inputs "true."** A patched client can still post a fake
> completed-workout day. What the log guarantees is that inputs are **server-
> timestamped, ordered, and un-editable after the fact** — the substrate anomaly
> detection and recompute need. Plausibility is enforced in §5.

### Ingest contract (as built)

The client posts raw daily inputs; the server validates, clamps (Zone-A-equivalent
ranges), and stores them. `dayKey` is client-asserted (device-local, ~Sydney) but
**bounded** (rejected if > 1 day in the future or older than the recompute window),
and its lag behind the server clock is a backfill anomaly signal (§5).

```ts
// syncCommunityStats input
{ targets: { stepTarget, sleepTargetH, waterTargetL, daysPerWeek },
  days: DayRecord[],   // raw per-day: habit values, session count+volume, activities, rest/freeze
  clientTz?: string }
// DayRecord — see src/community/scoring.ts (the shared, synced definition)
```

## 4. Server recompute (replaces the transcription path)

`syncCommunityStats` stops accepting metric values. New shape:

```ts
// IN:  { }   — no client-supplied metrics
// OUT: { ok, tier, weekKey, calcVersion }
```

Algorithm (a callable on write-through, plus a scheduled reconciliation sweep):

1. Read the caller's `users/{uid}/events` for the current league week
   (`mondayKey(now)` .. now), Admin SDK, paginated.
2. Recompute the **same definitions** the client uses today, server-side, from
   events only — `odometer`, `streak*`, `volume7/30`, `sessionsThisWeek`. The
   metric definitions are extracted into a **shared, pure module** (see the coach
   prebuild-sync precedent, memory `coach-backend-built`) so client display and
   server scoring can never drift.
3. Run anomaly rules (§5) → decide `status: 'ok' | 'provisional' | 'held'`.
4. Write the standing with provenance:

```ts
leagueStandings/{weekKey}/tiers/{tier}/members/{uid} = {
  username, points,
  calcVersion: 'v1',          // bump on any definition change → forces reprocessing
  status: 'ok'|'provisional'|'held',
  computedAt: serverTimestamp(),
  provenance: { eventCount, windowStart, windowEnd, anomalyFlags: [...] },
}
```

`points` for a `provisional`/`held` standing is **withheld from rank** (ranked
last / not shown as promoting) until cleared — implausible numbers never touch the
visible ladder.

**Reprocessing:** a scheduled job re-runs recompute for the active week so a
`calcVersion` bump or a late anomaly re-decides standings. `calcVersion` on each
standing makes stale rows detectable.

**Retention:** `pruneScoreLog` (daily) deletes `scoreDays`/`scoreEvents` older than
`RETENTION_DAYS` (the 460-day recompute window + a 30-day appeal buffer) — pure data
minimisation, since the recompute never reads that far back. Account deletion still
removes everything immediately; this bounds the log for live accounts.

## 5. Anomaly rules (v1 — flag, don't trust)

Cheap, explainable rules first (ML later, if ever). Each fires a named flag; a HARD
flag → `held` (needs review), a SOFT flag → `provisional` (rank-withheld, self-serve
appeal). **This table is the AS-BUILT set** in [`src/community/anomaly.ts`](../../src/community/anomaly.ts)
(`evaluateAnomalies`) — kept honest against the code, not aspirational.

| Flag (as built) | Kind | Signal |
|------|------|--------|
| `impossible_session_cadence` | HARD | > N completed sessions **or** > M activities logged against a single day. |
| `target_below_floor` | HARD | a self-reported goal was below its floor (gaming the ratio); clamped up + flagged. |
| `volume_jump` | SOFT | week volume > k× the user's trailing-week median (needs ≥2 prior weeks). |
| `perfect_week_no_history` | SOFT | near-max odometer with too few **active** days to support it. |
| `backfill` | SOFT | ≥ N days in this ingest whose `dayKey` lags the server clock by > 24h. |
| `device_churn` | HARD | many App Check device tokens for one uid in a week. **Inert** until native App Check (`deviceTokenCount` fixed at 1 today) — see [`APP_CHECK.md`](../APP_CHECK.md), memory `firebase-verified-state`. |

Thresholds live in the `ANOMALY_CONFIG` **code constant** today; moving them to a
server-owned `config/community` document (tune without redeploy) is a documented
follow-up, **not yet done**. Every fire is logged and lands on the review queue (§6).

**Not yet implemented (was over-claimed in earlier drafts):** a per-hour rate rule
and a `dayKey`/`tz`-vs-`serverTs` clock-skew rule. `clientTz` is now validated to an
IANA-shaped token and stored, but is **not** consumed by anomaly evaluation yet.
`backfilledDayCount` is measured per ingest (not durable across a later identical
resubmit), so it is a soft signal only. These are tracked as hardening follow-ups.

## 6. Provisional ranks · review queue · appeals

- **Provisional rank:** `provisional` standings are computed, stored, and shown to
  the user as "under review — not counting toward promotion yet." No moderator
  needed; auto-clears if the next recompute is clean.
- **Review queue (BUILT):** a `held` standing opens a `communityReviews/{uid}`
  item (its anomaly flags + snapshot) — a Zone-B collection readable **only** by a
  moderator (the `owner` custom claim, `scripts/set-owner-claim.mjs`; the subject
  can't read it, so anti-cheat internals don't leak). `finalizeStanding` maintains
  the queue: a fresh held episode opens `pending`, an in-flight appeal/decision is
  preserved, a return to a rankable status auto-closes it.
- **Appeals (BUILT):** `appealStanding` lets a user request a re-review of their own
  held standing (with an optional note); it records the appeal and immediately
  recomputes — if the data now passes, it auto-clears; if still held, it stays
  queued for the owner.
- **Resolution (BUILT):** `resolveStandingReview` (owner-claim only) writes a durable
  override on the review record and recomputes at once: `clear` → force `ok` (ranks),
  `uphold` → pin `held`, `reset` → drop the override and let the rules decide again.
  The override lives on the review doc, so `finalizeStanding` honours a moderator
  decision on every subsequent sync/sweep.

**MVP boundary:** the moderator surface is server-side (a claim-gated callable + an
owner-readable queue collection). A dedicated **admin UI** to browse/triage the
queue is not built — the owner drives it via the callable / console for now.

## 7. Open owner decisions

1. **Event-source authority.** Recommended: **append-only event log (Zone A′)** as
   in §3 — ships without the workout backend. Alternative: metrics only from
   server-issued/witnessed actions (stronger, depends on the workout backend
   landing first — memory `workout-backend-build`). Weakest: keep client compute +
   review only.
2. **Launch scope.** Recommended: **MVP** = server recompute + provenance +
   anomaly *flagging* + provisional ranks; **defer** the moderator review queue,
   appeals UI, and reprocessing-beyond-active-week to a documented follow-up.
   Alternative: build the full review/appeals machinery before the gate.
3. **Privacy review.** The event log is new personal data (timestamps, per-day
   activity). It must be added to [`PRIVACY.md`](../PRIVACY.md) /
   [`DATA_SAFETY.md`](../DATA_SAFETY.md), covered by the deletion/export workflow,
   and range-reviewed before the gate — leagues store only a handle + 0–100 today;
   the event log is more granular.
4. **App Check dependency.** The device-churn rule and meaningful rate limiting
   need **native App Check enforcement**, which is not yet possible (no native app
   registered — memory `firebase-verified-state`, [`APP_CHECK.md`](../APP_CHECK.md)).
   Decide whether the gate waits on it or ships with the rule stubbed + logged.

## 8. Definition of done for the gate

Built and verified (2026-08-06):

- [x] Event log collections + rules + `test/rules/` coverage (client-write denied,
      owner-read, append-only). Rules validated clean; emulator run pending (no JDK
      in the build sandbox — runs in CI).
- [x] Shared metric-definition module; client and server produce identical numbers
      on the same day-log (parity test in `communityScoring.test.mjs`).
- [x] `syncCommunityStats` no longer accepts client metrics; recomputes from the log.
- [x] `calcVersion` + provenance + `status` on every standing; provisional/held
      ranks withheld from promotion (points → 0 in the standing).
- [x] Anomaly rules v1 firing + logged; thresholds in an `ANOMALY_CONFIG` constant.
- [x] App-side `tsc`, `eslint`, and the 326-test unit suite green.

- [x] **Reprocessing sweep** — `reprocessStandings` ([`functions/src/community.ts`](../../functions/src/community.ts))
      runs daily (01:30 Sydney), recomputing every member's current-week standing
      from their durable log via the shared `finalizeStanding` helper, so a
      `calcVersion` bump or a newly-tripped anomaly re-decides standings without the
      user opening the app. Targets are now persisted on the profile
      (`scoringTargets`/`targetBelowFloor`) so the sweep needs no client input.
      (Scaling note in code: O(members) log reads — revisit with a work queue.)

Deferred / owner + infra (block flipping the flag):

- [x] **Deletion + export wired**: account deletion recursively purges
      `communityProfiles` (incl. `scoreDays`/`scoreEvents`) AND deletes
      `communityReviews/{uid}`, releases the `usernames/{lower}` handle, and removes
      historical `leagueStandings` rows (by `uid`) — all in
      [`functions/src/account.ts`](../../functions/src/account.ts); "Download my
      data" gathers the community profile + scoring log
      ([`src/store/cloudRepo.ts`](../../src/store/cloudRepo.ts) `collectUserExport`,
      scope in [`dataExport.ts`](../../src/lib/dataExport.ts)).
- [ ] **Privacy sign-off**: the per-day log is new granular personal data. The
      mechanics are wired (above); a human privacy review of the data collected +
      [`PRIVACY.md`](../PRIVACY.md)/[`DATA_SAFETY.md`](../DATA_SAFETY.md) copy is
      still required before the gate. **Owner.**
- [x] **Review queue + appeals + resolution** — built server-side:
      `communityReviews/{uid}` (owner-claim-readable queue), `appealStanding`
      (user), `resolveStandingReview` (owner: clear/uphold/reset with a durable
      override honoured by the recompute). Remaining slice: a dedicated **admin UI**
      to triage the queue (owner drives it via the callable for now).
- [ ] **App Check**: device-churn rule + real rate limiting need native App Check
      (memory `firebase-verified-state`). Ship stubbed+logged or wait — **owner.**
- [ ] **Emulator suites green in CI** (`test:rules`, `test:community`) + coach/pro
      sign-off; `COMMUNITY_BACKEND` flipped only after that.

Until every box is checked, `COMMUNITY_BACKEND` stays `false`.
