# Community competitive integrity (F-003) — launch sign-off packet

The signable record required before flipping **`COMMUNITY_BACKEND = true`**
([`src/community/backendConfig.ts`](../../src/community/backendConfig.ts)) and
deploying the community backend to real users. It gathers the four human/infra
gates that the code cannot close on its own. Engineering work is complete and
committed (PR #60); this document is what the **owner + a privacy reviewer** fill in
to authorise go-live.

Companion docs: the architecture + §8 checklist is
[`COMMUNITY_INTEGRITY_F003.md`](COMMUNITY_INTEGRITY_F003.md); the schema/security
contract is [`DATA_SCHEMA.md`](DATA_SCHEMA.md).

## The gate as it stands today

- `COMMUNITY_BACKEND` is **`false`** → the app runs the local simulation; none of
  the collections below are read or written for real users. Safe to review.
- All F-003 engineering gate items in `COMMUNITY_INTEGRITY_F003.md` §8 are ✅
  **except** the four in this packet: **A** privacy sign-off, **B** CI emulator
  green, **C** App Check decision, **D** moderation ownership.
- **Do not flip the flag until Parts A–D below are signed.**

## Remediation against the independent review (2026-08-06)

An independent review returned **NO-GO** and found real defects. Code-level findings
have been remediated (commit to follow this doc); the rest are the human/decision
gates below. Re-run all gates on the post-remediation SHA before signing.

| # | Finding | Status |
|---|---|---|
| 1 | `test:community` red — descending `__name__` scan | **Fixed** — bounded `where(documentId ≥ floor)` read in `finalizeStanding`. Re-confirm in CI. |
| 2 | `rolloverLeagues` could promote held/provisional rows | **Fixed** — only `status=='ok'` standings move (promote or demote); new `members(status,points)` index. |
| 3 | Held users still ranked in friend groups | **Fixed** — group ranking metrics zeroed for non-ok users server-side; `status` carried to the client. |
| 5 | Community deletion could complete while data remains | **Fixed** — per-resource cleanup that throws on failure, keeping the job `in_progress` for the sweep. |
| 6 | App Check monitor / rate limits not wired | **Fixed** — all community+group callables call `auditAppCheck` + honour `enforceAppCheck`; `sync`/`appeal` rate-limited. |
| 7,10 | Spec over-claimed anomaly rules; `clientTz` unvalidated; inventory incomplete | **Fixed (docs+code)** — §5 reconciled to as-built; `clientTz` validated to IANA token; A.1 inventory corrected; `historyDayCount` now counts active days. |
| 4 | Store/privacy disclosures not launch-ready | **Docs updated** (DATA_SAFETY F-003 action, PRIVACY) — **still needs human privacy sign-off** (Part A). |
| 8 | No user appeal UI; owner happy-path untested; override lifetime | **Open (owner/UI)** — appeal/moderation backend exists; UI + owner-claim emulator fixture + override-expiry policy are follow-ups (Part D). |
| 9 | Retention/TTL undecided | **Open (owner)** — mechanism can be added once a period is chosen (Part A retention field). |
| 11 | `communityReviews` (incl. appeal text) excluded from export | **Addressed** — the user's OWN appeal note is mirrored to their profile and included in the export; moderator internals stay withheld by design (see C2). |

### Privacy-review conditions (from the returned Part A, "approved w/ conditions")

A privacy-review pass returned Part A **approved with conditions C1–C5** (and set the
retention window at ~460 days). Code-actionable conditions are now done; the rest are
human/legal:

| # | Condition | Status |
|---|---|---|
| C1 | PRIVACY.md under-states the wellness fields (steps/sleep/water/nutrition) | **Done** — §2 wording now names them + retention + appeal handling. |
| C2 | User's own appeal text absent from export | **Done** — `appealStanding` mirrors the note to the owner-readable profile; `EXPORT_SCOPE` documents moderator internals are withheld. |
| C4 | Implement the retention TTL | **Done** — `pruneScoreLog` prunes `scoreDays`/`scoreEvents` older than `RETENTION_DAYS` (460 window + 30d buffer); owner confirms the period. |
| C3 | Lawful basis / consent for the competitive processing | **Open — owner/legal.** Confirm the basis (participation-as-consent, 18+ gate) and that PRIVACY.md reflects it. |
| C5 | Re-verify A.1 inventory against the release-SHA code | **Open — do in Part B (CI)** on the exact release commit. |

> ⚠️ The returned Part A was an **AI documentation-review pass, not a human privacy
> professional** — it says so itself and requires **owner / privacy-reviewer
> countersignature**. Treat A as **unsigned** until a human signs A.5.

---

## Part A — Privacy sign-off (REQUIRED)

**Why this is needed.** Before F-003, the competition backend stored only a handle
and a 0–100 consistency number. To make scoring tamper-proof, the server now stores
a **per-day activity log** it recomputes standings from. That log is **new personal
data held server-side under a competitive feature**, so it needs a privacy review
before it goes live. It contains **no body weight, no measurements, no health notes,
and no chat/free-text — with the two free-text exceptions noted below**, but it does
include **daily wellness values** (sleep hours, steps, water, a nutrition-adherence
score) that a reviewer should weigh.

### A.1 Data inventory (what actually gets stored) — verify against code

| Collection | Fields | Sensitivity | Who can read |
|---|---|---|---|
| `communityProfiles/{uid}` | `username`, `usernameLower`, `tier`, `points` (0–100), `streakCurrent/Best`, **`volume7`, `volume30`, `sessionsThisWeek`**, `freezeTokens`, `weekKey`, `calcVersion`, `status`, `provenance` (incl. `anomalyFlags`), `scoringTargets` (step/sleep/water/day goals), `targetBelowFloor`, `groupIds` | Handle (user-chosen; could be identifying) + training volumes/counts + non-sensitive scalars | **Owner (the user)** |
| `communityProfiles/{uid}/scoreDays/{dayKey}` | `hasHabit`, **`steps`, `sleepH`, `waterL`, `nutritionScore`**, `sessions` (count), `volume` (kg), `activities` (count), `rest`, `freeze`, `rev`, `firstTs`/`lastTs` | **Daily wellness values** (steps/sleep/water/nutrition). No weight/body/notes. | **Owner (the user)** |
| `communityProfiles/{uid}/scoreEvents/{id}` | `dayKey`, `action`, `after` (a day snapshot), `lagDays`, `weekKey`, **`clientTz`** (validated to an IANA-shaped token or dropped), `serverTs` | Append-only change trail; `clientTz` is a coarse location signal | **Owner (the user)** |
| `communityReviews/{uid}` | `uid`, `username`, `weekKey`, `flags`, `points`, `status`, `state`, `override`, **`appealNote`** (user free-text ≤500), **`resolutionNote`** (owner free-text ≤500), `resolvedBy`, `openedAt`/`appealedAt`/`resolvedAt`/`updatedAt` | Moderation record; two short free-text fields | **Moderator only** (`owner` claim) — NOT the subject |
| `leagueStandings/…/members/{uid}` | **`uid`**, `username`, `points`, `status`, `calcVersion` | Public-ish leaderboard row (`uid` added so deletion can find rows) | Any signed-in user |
| `usernames/{lower}` | `uid` | Uniqueness map | Any signed-in user |
| `groups/{gid}/members/{uid}` | `username`, `odometer`, `streak`, `bestStreak`, `volume7/30`, `sessionsThisWeek`, `status` | Denormalised stats for friend groups | Group members |

Source of truth: [`functions/src/community.ts`](../../functions/src/community.ts),
[`firestore.rules`](../../firestore.rules), [`src/community/scoring.ts`](../../src/community/scoring.ts).

### A.2 Lifecycle — already wired (verify)

- **Collection basis:** the scoreDays/scoreEvents inputs are the same habit/session
  data the user already logs in-app (Zone A); F-003 copies the scoring-relevant
  subset to a server-owned, immutable log so standings can't be forged.
- **Retention:** `scoreEvents` is append-only (never edited/deleted by clients);
  `scoreDays` keeps the latest per day. Recompute reads a rolling ~460-day window.
  → *Decide: is an explicit retention/TTL policy required, or is delete-on-account
  sufficient?*
- **Deletion:** account deletion **recursively purges** `communityProfiles`
  (profile + `scoreDays` + `scoreEvents`) — [`functions/src/account.ts`](../../functions/src/account.ts)
  `RECURSIVE_DOCS` — and additionally deletes `communityReviews/{uid}`, releases the
  `usernames/{lower}` handle reservation (if still owned), and removes every
  historical `leagueStandings` member row (found by the `uid` field via a
  collection-group query). See A.4 (now resolved).
- **Export:** "Download my data" includes the community profile + scoreDays +
  scoreEvents — [`src/store/cloudRepo.ts`](../../src/store/cloudRepo.ts)
  `collectUserExport`, scope in [`dataExport.ts`](../../src/lib/dataExport.ts).
- **Disclosure:** [`PRIVACY.md`](../PRIVACY.md) now describes the per-day scoring
  record. → *Reviewer confirms the wording is accurate + sufficient.*

### A.3 Reviewer checklist

- ☐ The A.1 inventory matches the deployed code (spot-check `firestore.rules` +
  `functions/src/community.ts`).
- ☐ Storing daily **steps / sleep / water / nutrition** values server-side under a
  competition feature is acceptable and adequately disclosed in `PRIVACY.md`.
- ☐ The two free-text fields (`appealNote` user, `resolutionNote` owner) and
  `clientTz` are acceptable / adequately minimised.
- ☐ Retention policy decided (delete-on-account only, or an explicit TTL).
- ☐ Deletion + export coverage is sufficient (see the A.4 residual before signing).
- ☐ Lawful basis / consent approach for the competitive processing is settled.
- ☐ No unresolved privacy concerns (or all listed under "Conditions" below).

### A.4 Residual — RESOLVED (2026-08-06)

Account deletion now also purges `communityReviews/{uid}`, releases the
`usernames/{lower}` handle reservation (only if the user still owns it), and deletes
every historical `leagueStandings` member row (via the `uid` field). Wired in
[`functions/src/account.ts`](../../functions/src/account.ts) `purgeAccountData`,
best-effort + logged so it never blocks the essential deletion. The reviewer only
needs to confirm this covers their expectation — no open decision remains here.

### A.5 Privacy record (complete + sign)

| Field | Value |
|---|---|
| Reviewer name / role | ______ |
| Date (ISO) | ______ |
| Retention decision | ______ |
| A.4 deletion coverage (reviews/usernames/standings) confirmed adequate | ☐ yes ☐ needs change: ______ |
| Conditions / required changes | ______ |
| Decision | ☐ Approved ☐ Approved w/ conditions ☐ Rejected |
| Signature | ______ |

---

## Part B — CI emulator suites green (REQUIRED)

The rules + backend behaviour are covered by emulator suites that **could not run in
the build sandbox (no JDK)**. They must pass in CI (or a JDK-equipped machine)
before go-live.

> **Independent review 2026-08-06 found `test:community` RED (6/9)** — root cause a
> descending document-id scan (`orderBy(__name__, 'desc')`) the Firestore emulator
> rejects. **Fixed** in `finalizeStanding` (now a bounded `where(documentId >=
> floor)` range read). This MUST be re-confirmed green in CI on the release SHA — it
> was the exact gap that hid the bug the first time (no JDK locally).

```bash
npm run test:rules       # firestore.rules — incl. scoreDays/scoreEvents/communityReviews gates
npm run test:community   # syncCommunityStats recompute, held/withheld, appeal flow, non-owner reject
```

- ☑ `test:rules` green (CI **Security Rules** workflow)
- ☑ `test:community` green (CI **Community Backend** workflow — was 6/9; passes after the descending-scan fix)
- ☐ Deployed `firestore.rules` **and `firestore.indexes.json`** match the repo (the
      rollover promotion query needs the new `members(status, points)` index) — *do at deploy*
- ☐ Deployed functions build from this commit — *do at deploy*

| Run by | Date | Commit SHA | Result |
|---|---|---|---|
| CI (GitHub Actions) | 2026-08-06 | `e600fef` (merged w/ main) | **Community Backend + Security Rules + Code gate PASS.** Deploy-match rows pending until deploy. |

---

## Part C — App Check decision (REQUIRED)

**Corrected understanding (2026-08-06).** The old framing tied this gate to a
"device-churn" rule. That rule is **not achievable via App Check** — App Check
attests a call comes from a genuine app instance but exposes **no per-device
identifier** to the backend, so "count devices per uid" can't be computed from it.
`deviceTokenCount`/`device_churn` are a **dormant placeholder**, not a pending
feature. The real App Check control is **enforcement**: blocking non-genuine /
scripted / emulated clients from calling the backend at all.

**What's now in place:**
- All community + group callables call the `auditAppCheck` monitor and honour
  `enforceAppCheck: APP_CHECK_ENFORCED` (flip via the `APPCHECK_ENFORCE` env var —
  no code change). `syncCommunityStats`/`appealStanding` are also rate-limited.
- The **native App Check bridge (App Attest / Play Integrity) is now wired**
  ([#63](https://github.com/zsztrochlic4/SHOAPPNATIVE/pull/63)) — the "no native app
  registered" blocker is **removed**. But it is **UNTESTED ON DEVICE** and
  enforcement is **OFF**.

**Path to enforcement (before or shortly after launch):**
1. EAS dev build → confirm `appCheckStatus().active === true` on real iOS + Android.
2. Monitor phase — `auditAppCheck` logs show real traffic carrying tokens.
3. Flip `APPCHECK_ENFORCE=1` (and optionally console enforcement for Firestore).

Decide one:
- ☑ **Ship in monitor mode now** (rate limits on; enforcement flipped once the
  native build is device-verified) — **SELECTED.**
- ☐ **Wait for `APPCHECK_ENFORCE=1`** (device-verified enforcement) before flipping
  the community flag.

**Decision recorded:**

| Decision | Owner | Date |
|---|---|---|
| **Ship in monitor mode.** App Check monitor + per-account rate limits are on at flip; move to full enforcement by setting `APPCHECK_ENFORCE=1` once an EAS dev build confirms App Attest / Play Integrity attest on real iOS + Android. `device_churn` is a dormant placeholder (not achievable via App Check — no per-device id) and is superseded by enforcement, so it is **not** an outstanding gap. | zsztrochlic4 (owner) | 2026-08-06 |

**Prerequisite (tracked, ops):** EAS dev build → confirm `appCheckStatus().active === true`
on device and that the `appcheck.missing` Functions logs go quiet → then flip
`APPCHECK_ENFORCE=1`. Rate limits bound abuse until then.

---

## Part D — Moderation ownership (REQUIRED)

Held standings queue in `communityReviews/{uid}`, resolved via the owner-claim-gated
`resolveStandingReview` callable (`clear` / `uphold` / `reset`); users self-appeal
via `appealStanding`. There is **no admin UI yet** — the owner drives resolution via
the callable / console.

- ☐ Named person(s) hold the `owner` custom claim (`scripts/set-owner-claim.mjs`).
- ☐ There is an agreed process + SLA for triaging `state: 'pending'` reviews.
- ☐ Accepted that triage is callable/console-driven until an admin UI is built.

| Moderator(s) | Owner-claim UID(s) | Date |
|---|---|---|
| ______ | ______ | ______ |

---

## Final go / no-go

Flip `COMMUNITY_BACKEND = true` only when **all** of A–D are signed above.

| Gate | Signed? |
|---|---|
| A — Privacy sign-off | ☐ — approved-w/-conditions by an AI pass; **needs human countersignature** + C3 (lawful basis) |
| B — CI emulator green | ◑ — CI green on `e600fef`; deploy-match rows pending at deploy |
| C — App Check decision | ☑ — **decided: ship in monitor mode** (2026-08-06); EAS-build → enforce follow-through |
| D — Moderation ownership | ☐ — name moderator(s) + owner-claim UID(s) + SLA |

**Authorised to enable community backend:** name ______ · date ______ · signature ______
