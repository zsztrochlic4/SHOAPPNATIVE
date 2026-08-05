# Fresh Audit Rerun (4 Aug) — Remediation Record

**Source:** StrengthHub Online — Fresh Full Audit Rerun, 4 August 2026 (CONDITIONAL PASS, 64/100),
audited at `main @ fc6bb07`. Follow-up to PR #37. No P0; eight P1s + P2s (R4-001…R4-013).
**This branch:** `claude/coach-reaudit-r4`.

Gate (all green locally):
```
app:  eslint (0 warnings) ✓  tsc ✓  check 221/221 ✓  sweep 109 profiles/0 breaches ✓  unit 285 ✓  safety 65 ✓
fns:  build ✓  tests 37/37 ✓
```

---

## Fixed

### R4-001 — Stale action switch could fail open — FIXED
`functions/src/killSwitchRemote.ts`: `engagedFresh(failClosed)` now trusts the cache only when it is
**fresh after the awaited refresh**. A never-populated cache OR a stale value whose refresh fails (a
Firestore outage) both return `true` (disabled) for plan-mutating actions — no more stale-`false`
fail-open during an outage. `makeRemoteKillSwitch` takes an injectable clock so the outage path is
deterministically tested (`functions/test/killSwitch.test.mjs`).

### R4-002 — Evaluation provenance was bypassable — FIXED
`scoreResponseQuality.ts` adds `validateManifest`: in a release run the manifest is **mandatory**
(missing/unreadable ⇒ fail), `releaseSha` must be a 40-char hex (and match `EXPECTED_SHA` when
supplied), `model`/`promptHash`/`corpusHash`/`repliesHash` must be real (non-placeholder) values, and
`replyCount` must be exactly 60. `scripts/run-coach-response-eval.mjs` marks `includesModelReplies`
true only when **all 60** replies are non-empty, records `replyCount` + `corpusHash` + `repliesHash`,
and passes `requireManifest` in score mode. The re-audit's bypass fixtures (missing manifest, one
reply, arbitrary SHA) now all fail.

### R4-005 — No cross-device version precondition — FIXED (optimistic)
`commitCoachAction` now runs in a Firestore `runTransaction` with an **optimistic `expectedVersion`
precondition**: if the stored program moved on since the action was resolved (another device
committed first), it throws `CoachActionConflictError` instead of silently overwriting. The client
surfaces an honest "changed on another device" message and records `failed(version_conflict)`.
(Identical-version patch/patch races still need the authoritative server command, P4-02 — owner.)

### R4-009 — Contradictory "fit" copy — FIXED
`set_session_length` no longer says "rebuilt your plan to fit"; the neutral base message plus the
honest over-budget caveat (U-014) no longer contradict.

### R4-010 — No stored timezone — FIXED
`Settings.timezone` added; the store captures the device IANA timezone (`deviceTimezone()`) on
hydrate and persists it, so the server coach context (which already reads `settings.timezone`) names
the correct **local** day instead of the Australia/Sydney fallback.

### R4-011 — Legacy fail-open persistence — FIXED
`writeActiveProgram` no longer swallows the stale-instance discovery query — a failure ABORTS the
write (fail closed), consistent with `commitCoachAction`.

### R4-004 (partial) — Sweep only covered Full Gym/60 min — IMPROVED
The profile sweep now also covers **Basic Gym** and **30/45/90-minute** sessions as a HARD gate
(109 profiles). **Bodyweight** is swept as a **reported warning** (not a build failure) because its
equipment taxonomy genuinely leaves required slots unfilled — a workbook-data defect (below). The gap
is now visible in CI and the coach already refuses to apply such a sparse plan (U-011).

---

## Owner-only residual

- **R4-003 / R4-006 quality** — run the live 60-case + long-context (50/100/200-turn) evaluation
  against the exact release model with two blind reviewers. The gate now refuses to pass without a
  bound manifest + all 60 replies (R4-002), so this is a hard prerequisite.
- **R4-004 (data)** — correct the Bodyweight equipment tags in the **workbook** (`equipmentTags.ts`
  is generated; `validate:data` enforces it). The sweep warning tracks the gap until then.
- **R4-005 (full)** / **R4-006 (durable journal)** — the authoritative server command with a
  `programVersion` precondition + a durable outbox/reconciler (IP-01 / P4-02 / P4-08).
- **R4-007** — native App Check attestation + staged enforcement.
- **R4-008 — NOT a defect.** The audit's "Branch not protected" came from the classic
  `branches/main/protection` endpoint, which returns 404 when protection is via a **ruleset**. `main`
  IS protected: ruleset `main protection` (active) enforces `pull_request`, `required_status_checks`
  (`sweep`, `e2e`, `Rules + sanitisation tests`), `non_fast_forward` and `deletion`. Verified via
  `GET repos/.../rulesets`.
- **R4-012 / R4-013** — native Firebase-backed E2E and the coach-overlay component extraction.
