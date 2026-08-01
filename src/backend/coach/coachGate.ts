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
 * ENABLED 2026-08-01 after the independent clinical validation (Jack Dov, R8: 0 critical
 * misses, 0 emergency under-routes, 0 crisis-tier false alarms) and the activation controls
 * (named owners, kill switch verified, App Check aligned across the backend). Remote OFF stays
 * available WITHOUT a redeploy via `config/coach.killSwitch` (see safety/killSwitch.ts +
 * functions/src/killSwitchRemote.ts) — the kill switch is now the active off-switch.
 */

export const COACH_ENABLED = true

/** True only when the coach has been deliberately enabled post-review. */
export function coachAvailable(): boolean {
  return COACH_ENABLED
}
