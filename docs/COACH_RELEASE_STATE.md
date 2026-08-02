# Coach release-state record (final plan Phase 0)

Phase 0's job is to make the coach's release control **unambiguous and reversible** before any
behaviour change. This file records what is verifiable from the repository and names the operational
checks that require live access (a person with Firebase/deploy credentials).

_Recorded 2026-08-02 for the `claude/coach-human-feel` candidate branch (off `main` @ 4905c4e)._

## Candidate

- **Branch:** `claude/coach-human-feel` — a single dedicated branch holding the language/human-feel
  implementation. It contains only the coach work described in the final plan (Phases 1–6) plus this
  Phase 0 record; no unrelated changes.
- **Shared source is regenerated, not hand-edited.** The server runs the app's guardrail code verbatim
  via `functions/scripts/sync-shared.mjs` → `functions/src/_shared/**` (gitignored). Run
  `node functions/scripts/sync-shared.mjs` after any `src/backend/coach/**` change.

## Verifiable gate states (from the repo)

| Control | Value | Source |
|---|---|---|
| `COACH_ENABLED` | `true` | `src/backend/coach/coachGate.ts` |
| App Check enforcement | `false` (monitor mode) | `functions/src/lib/guards.ts` → `APP_CHECK_ENFORCED` |
| Remote kill switch | `config/coach.killSwitch` (Firestore); OFF without redeploy | `functions/src/killSwitchRemote.ts`, `src/backend/coach/safety/killSwitch.ts` |
| Safety classifier | `activeClassifier` LLM path, `validated: false` | `src/backend/coach/safety/classifier.ts` |
| Daily cap | `DAILY_COACH_LIMIT` server-enforced | `src/backend/coach/safety/dailyLimit.ts` |

### Enablement reconciliation

The code, comments and review notes are now consistent: `COACH_ENABLED = true` was set on 2026-08-01
after the R8 clinical validation (see `coachGate.ts` header and `src/backend/coach/safety/STATUS.md`).
Stale "coach ships DISABLED" prose remains in a few file-level docblocks (`safety/types.ts`,
`safety/index.ts`) and is historical — the authoritative flag is `coachGate.COACH_ENABLED`. The server
turn (`functions/src/coach.ts` → `runCoachTurn`) throws `coach_disabled` when the flag is false and
`coach_unavailable` when the kill switch is engaged, so both controls gate the callable path.

### App Check decision (Phase 0 requirement)

The coach deliberately does **not** uniquely enforce App Check ahead of the app-wide rollout, because
the native app does not yet attest; enforcing only on the coach would reject real clients. It runs in
**monitor mode** (`auditAppCheck` logs missing tokens without rejecting) consistently with every other
callable, and comes along when App Check is enforced app-wide per `docs/APP_CHECK.md`.

- **Temporary risk owner:** the coach release owner (see `docs/APP_CHECK.md`).
- **Exit condition:** flip `APP_CHECK_ENFORCED = true` once real clients are confirmed to attest; until
  then endpoint-abuse risk is bounded by auth (`requireVerifiedUser`) + the server-authoritative daily
  cap + the remote kill switch.

## Automated suites on this branch (all green)

- Coach safety regression suite — `node .sweep-out/backend/coach/safety/runCoachSafetyTests.js` →
  **218 assertions PASS**.
- Detection report baseline — `runDetectionReport.js` → **unchanged** vs `main` (84 stub-baseline
  failures; the `tren` substring false-positive fix removed benign "strength"/"trend" mis-referrals
  without changing the clinical detection set or reducing real PED recall).
- `npm run test:safety` → **61 pass** (incl. new `conversational-routing.test.mjs`).
- `npm run test:unit` → **170 pass** (incl. `context-selection`, `coach-fallback-policy`,
  `coach-telemetry`).
- `functions` → `coach.test.mjs` 9 pass, `killSwitch.test.mjs` 4 pass.
- `npm run benchmark:coach` → **ROUTING GATES: PASS**.

## Operational checks that require live access (NOT verifiable from the repo)

These are the Phase 0 items a person with credentials must record/verify before release; they cannot
be established from source alone:

1. **Deployed commit + Cloud Functions revision** actually serving `coachMessage` in production.
2. **Live `config/coach.killSwitch` value**, and a real test that setting it `true` disables the
   callable **without a redeploy** (the code path and `killSwitch.test.mjs` prove the logic; a live
   toggle proves the wiring).
3. **Live App Check monitoring** thresholds and the named risk owner acknowledging the exit condition.
4. **Rollback** verified (revert the flag / engage the kill switch) before any rollout expansion.

## Do-not-regress

The clinically sensitive safety layer is preserved. Any change to fixed emergency, crisis, medical,
pregnancy, eating-disorder, poisoning, or other professional-referral wording requires the appropriate
clinical review. The conversational changes in this branch are **additive on the `allow` branch only**
and never downgrade a safety route (verified by `conversational-routing.test.mjs` and the 218-assertion
suite).
