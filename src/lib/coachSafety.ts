/**
 * App-side bridge to the coach safety guardrails (src/backend/coach/safety).
 *
 * Builds the read-only CoachContext from AppState and re-exports the guard entry points, so every
 * coach surface (the 1:1 chat, the reducer chat path, and the nutrition food coach) enforces the
 * SAME guardrails from one shared source (spec §2/§7). This file only READS AppState.
 *
 * The coach ships DISABLED (coachGate.COACH_ENABLED === false); this bridge does not change that.
 */

import type { AppState } from '../store/types'
import {
  guardIncoming, guardOutgoing, coachEligibility, newSafetySession,
  type CoachContext, type SafetySession, type SafetyDecision, type GuardOutcome,
} from '../backend/coach/safety'

/** Read-only projection of the stored user the safety layer needs. Injury/age/screening meaning
 *  stays owned by the engine — this only forwards stored values for the engine bridge to use. */
export function coachContext(state: AppState): CoachContext {
  const u = state.backendUser
  return {
    dateOfBirth: u?.date_of_birth ?? null,
    affectedRegions: u?.affected_regions ?? [],
    screeningOutcome: u?.screening?.outcome ?? null,
    engineExcludedExerciseIds: u?.excluded_exercise_ids ?? [],
    // spec §20 location rule: Australian services only for AU users. Locale plumbing is a
    // wiring [TO BUILD]; defaulting to AU (the app's audience) is the safe interim.
    isAustralia: true,
  }
}

export { guardIncoming, guardOutgoing, coachEligibility, newSafetySession }
export type { CoachContext, SafetySession, SafetyDecision, GuardOutcome }
