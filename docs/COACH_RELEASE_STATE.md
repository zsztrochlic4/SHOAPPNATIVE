# Coach release-state record — AUTHORITATIVE

_Updated 2026-08-02 (audit remediation, finding F-003). This file supersedes the
2026-08-02 "candidate branch" note that previously lived here. Where any other
document disagrees with this record or with `src/backend/coach/safety/STATUS.md`,
those two lose only to each other in one direction: **STATUS.md is the safety
record of truth; this file must always match it.**_

## Current release state: DISABLED

| Control | Value | Source |
|---|---|---|
| `COACH_ENABLED` | **`false`** | `src/backend/coach/coachGate.ts` |
| Safety classifier | `activeClassifier` LLM path, **`validated: false`** | `src/backend/coach/safety/classifier.ts` |
| App Check enforcement | `false` (monitor mode) | `functions/src/lib/guards.ts` → `APP_CHECK_ENFORCED` |
| Remote kill switch | `config/coach.killSwitch` (Firestore); OFF without redeploy | `functions/src/killSwitchRemote.ts`, `src/backend/coach/safety/killSwitch.ts` |
| Daily cap | `DAILY_COACH_LIMIT` server-enforced | `src/backend/coach/safety/dailyLimit.ts` |

## Why the 2026-08-01 enablement was rolled back

The gate was flipped to `true` on 2026-08-01 citing an "R8 clinical validation".
That claim did not reconcile with the coach's own safety records:

1. `src/backend/coach/safety/STATUS.md` records the final r8 validation **failing
   9/123 critical cases** and states enabling was **not authorised**.
2. The post-fix build (r9) has **not** had a fresh independent holdout validation.
3. `activeClassifier.validated` is `false` in the shipped code — the classifier the
   router actually runs is explicitly marked unvalidated.

A release decision that contradicts its own safety evidence is a governance
defect regardless of intent (external audit 2026-08-02, finding F-003, P0). The
gate is therefore OFF, and the code comment in `coachGate.ts` documents the
rollback.

## Conditions for re-enabling (all required, in order)

1. **Fresh independent clinical holdout** on the exact shipping build (r9 or
   later) against a set the builder has never seen, meeting the documented
   thresholds: zero critical misses, zero emergency under-routes.
2. **`activeClassifier.validated` flipped by the reviewing clinician's record**,
   never by the builder. The reviewer's name, credentials, date, dataset id and
   result summary must be appended to `STATUS.md`.
3. **Named sign-offs** recorded here: clinical, privacy, security, implementation.
4. **Live rollback drill**: set `config/coach.killSwitch = true` in production,
   confirm the callable refuses without a redeploy, record the drill owner/date.
5. Only then: one commit that flips `COACH_ENABLED = true`, updates this file and
   `STATUS.md` in the same change, and names the deployed Functions revision.

## What remains true while disabled

- The server turn (`functions/src/coach.ts` → `runCoachTurn`) throws
  `coach_disabled` before any other work; the client shows the "coming soon"
  surface. Neither the live model nor the rules fallback answers.
- The deterministic safety suite (218 assertions), routing benchmarks, function
  orchestration tests and context-selection tests keep running in CI so the
  gated build stays releasable.
- App Check remains in monitor mode app-wide; the coach follows the app-wide
  enforcement rollout (`docs/APP_CHECK.md`) and never enforces uniquely ahead of
  native attestation.
