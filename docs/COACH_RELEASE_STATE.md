# Coach release-state record — AUTHORITATIVE

_Updated 2026-08-13 (audit remediation — production remains fail-closed). This file supersedes
the 2026-08-03 enablement record below (retained as history). Where any other document disagrees
with this record or with `src/backend/coach/safety/STATUS.md`, those two lose only to each other
in one direction: **STATUS.md is the safety record of truth; this file must always match it.**_

## Current release state: DISABLED (revalidated 2026-08-13)

| Control | Value | Source |
|---|---|---|
| Release channel | **`disabled` by default**; `internal` requires an explicit internal-build environment value | `config/coach-release.json`, `src/backend/coach/coachGate.ts` |
| Safety classifier | `activeClassifier` LLM path + deterministic rules floor | `src/backend/coach/safety/classifier.ts` |
| App Check enforcement | `false` (monitor mode; env-driven `APPCHECK_ENFORCE`) | `functions/src/lib/guards.ts` → `APP_CHECK_ENFORCED` |
| Remote kill switch | `config/coach.killSwitch` (Firestore); disables the coach WITHOUT a redeploy | `functions/src/killSwitchRemote.ts`, `src/backend/coach/safety/killSwitch.ts` |
| Daily cap + burst + global cost cap | server-enforced (audit SA-011) | `dailyLimit.ts`, `functions/src/lib/rateLimit.ts` |

### Disable decision (2026-08-09) — CURRENT

The coach is **OFF for launch**. The 2026-08-09 legal-master verification audit found the shipping
flag was `true` while the pre-launch sign-off packet, `docs/DATA_SAFETY.md` and `docs/APP_STORE.md`
all declared the coach DISABLED — an unsignable contradiction. The owner reconciled this by keeping
the coach **off**: although the automated critical-safety holdout passed (see the 2026-08-03 record
below), the owner's launch gate also requires the **independent §23 professional/clinical reviews**
and **App Check enforcement**, and BOTH remain outstanding. The coach does not ship until the
re-enable conditions below are met. This flag change reverts `COACH_ENABLED` to `false` and aligns
every record.

### Enablement record (2026-08-03) — HISTORY, SUPERSEDED 2026-08-09

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

### FP-reduction round (2026-08-03)

After enablement, the benign false-positive rate was reduced with generalising (not
holdout-tuned) changes: server-DOB suppression of benign `under_18` classifier hits,
wider `under_18` scoping, and prompt disambiguation for `under_18` / `meal_plan` /
`off_topic`. Re-measured on a LARGE fresh 100-case set (`data/holdouts/R10.json`):

- **Production path** (rules ∪ classifier ∪ scoping ∪ DOB — what users actually hit,
  via `scripts/validate-coach-production.mjs`): **critical misses 0/40, FP 3.3% (2/60)** —
  under the 5% target. The 2 FPs are gentle `off_topic` refers, not safety over-flags.
- Classifier-alone (harness upper bound): FP 8.3% (down from R9's 25%), critical misses 0/40.

Recall held at 0 critical misses throughout. FP monitoring is now a repeatable
production-path measurement, not ad-hoc.

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

_Policy (2026-08-09, supersedes the 2026-08-02 automated-bar-only policy): the owner's
launch gate requires **both** the objective automated safety bar **and** the independent
§23 professional/clinical reviews **and** App Check enforcement. The 2026-08-02 position
that "no human/clinician sign-off is required" no longer holds for launch — the owner has
elected to treat the §23 reviews as a hard gate._

1. **Automated safety holdout passes** on the exact shipping build: the crisis /
   self-harm / eating-disorder holdout suite reports **zero critical misses and zero
   emergency under-routes**. Record the run in `STATUS.md`: commit SHA, dataset id,
   date, and the pass summary. _(Met on 2026-08-03; must be re-run on the build that ships.)_
2. **Independent §23 professional/clinical reviews completed and recorded** — the
   accredited-professional sign-off(s) named in the pre-launch packet, verified with the
   issuing body. This is the gate that is currently outstanding.
3. **App Check enforcement live** on the AI endpoint (`APP_CHECK_ENFORCED = true`),
   consistent with `docs/APP_CHECK.md` and native attestation.
4. **Live rollback drill**: set `config/coach.killSwitch = true` in production, confirm
   the callable refuses without a redeploy, record the drill owner/date.
5. Only then: a reviewed production-manifest/channel change updates this file and
   `STATUS.md` in the same change, and names the deployed Functions revision + the
   passing run.

> The safety-outcome bar is unchanged (zero critical misses / zero emergency under-routes).
> What changed on 2026-08-09 is that the independent §23 reviews and App Check are now
> explicit hard gates for launch, not deferred follow-ups.

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
