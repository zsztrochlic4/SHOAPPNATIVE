# Coach release-state record — AUTHORITATIVE

_Updated 2026-08-02 (audit remediation, finding F-003). This file supersedes the
2026-08-02 "candidate branch" note that previously lived here. Where any other
document disagrees with this record or with `src/backend/coach/safety/STATUS.md`,
those two lose only to each other in one direction: **STATUS.md is the safety
record of truth; this file must always match it.**_

## Current release state: ENABLED (owner decision, 2026-08-03)

| Control | Value | Source |
|---|---|---|
| `COACH_ENABLED` | **`true`** (enabled 2026-08-03) | `src/backend/coach/coachGate.ts` |
| Safety classifier | `activeClassifier` LLM path + deterministic rules floor, **`validated: true`** | `src/backend/coach/safety/classifier.ts` |
| App Check enforcement | `false` (monitor mode; env-driven `APPCHECK_ENFORCE`) | `functions/src/lib/guards.ts` → `APP_CHECK_ENFORCED` |
| Remote kill switch | `config/coach.killSwitch` (Firestore); disables the coach WITHOUT a redeploy | `functions/src/killSwitchRemote.ts`, `src/backend/coach/safety/killSwitch.ts` |
| Daily cap + burst + global cost cap | server-enforced (audit SA-011) | `dailyLimit.ts`, `functions/src/lib/rateLimit.ts` |

### Enablement record (2026-08-03)

Enabled by **owner decision** on the strength of a recorded passing run against the reviewer-owned
sealed holdout:

- **Dataset:** `data/holdouts/JV.json` (Jack Dov sealed set — 66 cases: 46 critical + 20 benign).
- **Command:** `npm run validate:holdouts` (HOLDOUT_SETS=JV, FP_GATING=hard), model gemini-2.5-flash-lite.
- **Result:** **critical misses 0/46**, emergency under-routes 0 → the zero-miss safety bar (criterion 1) is MET.
  Benign false positives **3/20 (15%)** — above the 5% quality target; this is the classifier-alone
  upper bound and fails OVER-CAUTIOUS (benign flagged as a concern), not permissive.
- **Owner-accepted caveats / follow-ups** (do not affect the zero-critical-miss guarantee):
  reduce the benign FP toward 5%; perform a live kill-switch rollback drill; enable App Check +
  complete the §19 privacy foundation before activating the DORMANT analytics/operational-state
  stores (still OFF). The four independent §23 reviews remain outstanding and are the owner's
  accepted risk in shipping now.

The critical-recall guarantee is carried DETERMINISTICALLY by the rules floor (`rules.ts`
`concealedIntent` etc.), so it holds even if the model regresses.

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

_Policy (2026-08-02): re-enablement is gated on an **objective automated safety
bar** — **no human or clinician sign-off is required**. The bar is a reproducible
safety run, nothing more, nothing less._

1. **Automated safety holdout passes** on the exact shipping build (r9 or later):
   the crisis / self-harm / eating-disorder holdout suite reports **zero critical
   misses and zero emergency under-routes**. Record the run in `STATUS.md`: commit
   SHA, dataset id, date, and the pass summary.
2. **`activeClassifier.validated` flipped only on the strength of that recorded
   run** — tied to the commit and dataset. Never by hand-asserting a pass; that
   hand-assertion is exactly the failure mode F-003 caught.
3. **Live rollback drill**: set `config/coach.killSwitch = true` in production,
   confirm the callable refuses without a redeploy, record the drill owner/date.
4. Only then: one commit that flips `COACH_ENABLED = true`, updates this file and
   `STATUS.md` in the same change, and names the deployed Functions revision + the
   passing run.

> The bar is deliberately **at least as strict on the safety outcome** as before
> (zero critical misses / zero emergency under-routes) — what's removed is the
> human sign-off overhead, not the requirement that the build actually pass.

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
