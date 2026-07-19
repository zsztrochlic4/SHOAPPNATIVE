/**
 * App-side bridge to the coach safety guardrails (src/backend/coach/safety).
 *
 * Builds the read-only CoachContext from AppState and re-exports the guard entry points, so every
 * coach surface (the 1:1 chat, the reducer chat path, and the nutrition food coach) enforces the
 * SAME guardrails from one shared source (spec §2/§7). This file only READS AppState.
 *
 * The coach ships DISABLED (coachGate.COACH_ENABLED === false); this bridge does not change that.
 * `coachOperational()` additionally honours the server-side kill switch (spec §20).
 */

import type { AppState } from '../store/types'
import { coachAvailable } from '../backend/coach/coachGate'
import {
  guardIncoming, guardOutgoing, coachPrecheck, coachEligibility, coachKillSwitchEngaged, newSafetySession,
  type CoachContext, type SafetySession, type SafetyDecision, type GuardOutcome, type CoachPrecheck,
  type ContactButton, type CoachUsage,
} from '../backend/coach/safety'

/** Best-effort locale check for the §20 location rule. Australia is the audience default; a clear
 *  non-AU device timezone flips to local-services wording. Real locale plumbing is a small [TO BUILD]. */
function detectAustralia(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz.startsWith('Australia/')) return true
    if (tz.includes('/')) return false // a recognisable non-AU IANA zone
  } catch { /* ignore */ }
  return true
}

/** Read-only projection of the stored user the safety layer needs. Injury/age/screening meaning
 *  stays owned by the engine — this only forwards stored values for the engine bridge to use. */
export function coachContext(state: AppState): CoachContext {
  const u = state.backendUser
  return {
    dateOfBirth: u?.date_of_birth ?? null,
    affectedRegions: u?.affected_regions ?? [],
    screeningOutcome: u?.screening?.outcome ?? null,
    engineExcludedExerciseIds: u?.excluded_exercise_ids ?? [],
    isAustralia: detectAustralia(),
  }
}

/** Coach availability, honouring BOTH the build-time gate and the server-side kill switch (§20). */
export function coachOperational(): boolean {
  return coachAvailable() && !coachKillSwitchEngaged()
}

export { guardIncoming, guardOutgoing, coachPrecheck, coachEligibility, coachKillSwitchEngaged, newSafetySession }
export type { CoachContext, SafetySession, SafetyDecision, GuardOutcome, CoachPrecheck, ContactButton, CoachUsage }
