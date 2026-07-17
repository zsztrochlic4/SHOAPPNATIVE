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
 * To turn the coach on AFTER its review: set `COACH_ENABLED = true` (ideally sourced
 * from a remote flag rather than a code edit) and confirm App Check is live.
 */

export const COACH_ENABLED = false

/** True only when the coach has been deliberately enabled post-review. */
export function coachAvailable(): boolean {
  return COACH_ENABLED
}
