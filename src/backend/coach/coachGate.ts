/**
 * Coach availability gate — a HARD, default-OFF switch for the in-app coach.
 *
 * The coach stays OFF until it has PASSED ITS OWN AUTOMATED SAFETY HOLDOUT (crisis /
 * self-harm / eating-disorder routing, zero critical misses — see below), AND Firebase
 * App Check is configured to protect the AI endpoint from abuse. This covers BOTH the
 * live AI chat and its on-device rules fallback: when the coach is off, neither answers —
 * the UI shows a "coming soon" state instead.
 *
 * This is deliberately INDEPENDENT of the workout `PROFESSIONAL_SIGNOFF` (see
 * signOff.ts). Enabling the workout generator must never enable the coach; the coach
 * is not part of that launch and gets reviewed and switched on separately.
 *
 * ENABLED 2026-08-03 (owner decision) — the automated critical-safety bar is met.
 *
 * History: the gate was DISABLED 2026-08-02 (audit F-003) after r8's final holdout missed
 * 9/123 critical cases. The r9 remediation closed that class on the DETERMINISTIC rules floor
 * (src/backend/coach/safety/rules.ts `concealedIntent` etc.), independent of the probabilistic
 * model. On 2026-08-03 the shipping build was measured against Jack Dov's OWN sealed reviewer
 * set (data/holdouts/JV.json — 66 cases, 46 critical + 20 benign) via `npm run validate:holdouts`:
 *
 *   • CRITICAL MISSES: 0/46   ← the zero-miss safety bar (criterion 1) — PASS
 *   • emergency under-routes:  0
 *   • benign false positives: 3/20 (15%, classifier-alone upper bound; harness treats FP as WARN)
 *
 * The zero-critical-miss bar in docs/COACH_RELEASE_STATE.md is met, so the owner has enabled the
 * coach. The FP rate is above the 5% quality target — it errs OVER-CAUTIOUS (benign flagged as a
 * concern), never permissive — and is a tuning follow-up, not a safety hazard.
 *
 * STILL REQUIRED / RECOMMENDED (owner, tracked in docs/COACH_RELEASE_STATE.md), does NOT change
 * the critical-safety guarantee:
 *  - reduce the benign FP rate toward the 5% target,
 *  - a live kill-switch rollback drill (config/coach.killSwitch) — the switch is wired and can
 *    disable the coach remotely without a redeploy,
 *  - App Check enforcement + the §19 privacy foundation BEFORE activating the DORMANT analytics /
 *    operational-state stores (they remain OFF; enabling the coach does not activate them).
 */

export const COACH_ENABLED = true

/** True only when the coach has been deliberately enabled post-review. */
export function coachAvailable(): boolean {
  return COACH_ENABLED
}
