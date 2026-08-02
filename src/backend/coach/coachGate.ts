/**
 * Coach availability gate — a HARD, default-OFF switch for the in-app coach.
 *
 * The coach stays OFF until it has had its OWN professional review of the persona,
 * guardrails and behaviour, AND Firebase App Check is configured to protect the AI
 * endpoint from abuse. This covers BOTH the live AI chat and its on-device rules
 * fallback: when the coach is off, neither answers — the UI shows a "coming soon"
 * state instead.
 *
 * This is deliberately INDEPENDENT of the workout `PROFESSIONAL_SIGNOFF` (see
 * signOff.ts). Enabling the workout generator must never enable the coach; the coach
 * is not part of that launch and gets reviewed and switched on separately.
 *
 * DISABLED 2026-08-02 (audit F-003). The 2026-08-01 enablement was NOT authorised by the
 * coach's own safety record and has been rolled back: the active classifier ships with
 * `validated: false` (src/backend/coach/safety/classifier.ts), and the authoritative status
 * record (src/backend/coach/safety/STATUS.md) documents the final r8 validation failing
 * 9/123 critical cases with r9 not yet independently re-validated. A release note claiming
 * the opposite existed alongside those records; the STATUS record wins, so the gate is OFF.
 *
 * Re-enabling requires ALL of (recorded in docs/COACH_RELEASE_STATE.md):
 *  1. a FRESH independent clinical holdout on the current build (r9) passing the documented
 *     zero-critical-miss / zero-emergency-under-route thresholds,
 *  2. `activeClassifier.validated` flipped by that review — never by the builder,
 *  3. named clinical/privacy/security/implementation sign-offs,
 *  4. a live kill-switch rollback drill (config/coach.killSwitch) with a named owner.
 */

export const COACH_ENABLED = false

/** True only when the coach has been deliberately enabled post-review. */
export function coachAvailable(): boolean {
  return COACH_ENABLED
}
