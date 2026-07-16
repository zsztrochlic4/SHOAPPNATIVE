/**
 * Safety & Programming Rules engine — HARD safety logic.
 *
 * Source of truth: workbook sheet "Safety Rules" (docs/spec/sheets/12_Safety_Rules.tsv).
 * Applied after the Prescription Grid lookup, in ascending priority. HARD_SAFETY rules
 * can block or rewrite a session and are NEVER overridden by any goal, preference or
 * prompt. A user can change goal, split and exercises freely; never the safety envelope.
 *
 * Numeric-clamp rules (S02, S03, S04, P01) live in `clampPrescription`. The
 * swap-triggering rules (S01, S08, S09) are exposed as predicates the generator uses to
 * decide when to walk the Substitutions list. S05 (screening) lives in screening.ts;
 * S06 (stop symptom) is a runtime escalation handled in stopSymptom.ts.
 */

import type { BackendExperience } from '../schema'

export type PrescriptionClass = 'Load' | 'Power' | 'Rep' | 'Time' | 'Interval'
export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced'
export type BodyRegion = 'upper' | 'lower'

/** The subset of an Exercise Database row the safety engine needs. */
export interface ExerciseSafetyMeta {
  id: string
  skill_level: SkillLevel
  prescription_class: PrescriptionClass
  /** Failure Allowed = No forces the Min RIR floor (S03). */
  failure_allowed: boolean
  /** The closest-to-failure this exercise may EVER be taken (Min RIR column). */
  min_rir: number
  /** Spotter Recommended = Yes triggers S09 for solo lifters. */
  spotter_recommended: boolean
  /** Upper/lower drives the S07 absolute weekly load cap. */
  body_region: BodyRegion
}

export interface UserSafetyContext {
  experience: BackendExperience
  /** True when the user trains alone (onboarding Always/Usually) — S09. */
  trains_alone: boolean
  /** Completed training weeks on the current program — drives P01 (< 4 weeks). */
  weeks_trained: number
}

export interface Prescription {
  sets: number
  reps_min?: number
  reps_max?: number
  rir_min: number
  pct_1rm_max?: number
  rest_sec_min?: number
  duration_sec_max?: number
}

export interface ClampResult {
  rx: Prescription
  applied: string[] // rule_ids that fired, e.g. ['S03', 'S04', 'P01']
}

const SAFETY_FLOORS = {
  loadRepsMin: 4,
  loadPct1rmMax: 88,
  powerRirMin: 2,
  beginnerFirstWeeks: 4,
  beginnerRirMin: 2,
  minRestSec: 45,
  timeCapSec: 60,
  weeklyLoadPct: 0.05,
  upperCapKg: 2.5,
  lowerCapKg: 5,
} as const

/** S01: an Advanced exercise served to a non-Advanced user must be swapped. */
export function isSkillBlocked(ex: ExerciseSafetyMeta, user: UserSafetyContext): boolean {
  if (ex.skill_level === 'Advanced' && user.experience !== 'Advanced') return true
  return false
}

/** P01: beginners (or young people) in the first 4 weeks get no Power/Advanced work. */
export function isClassBlocked(ex: ExerciseSafetyMeta, user: UserSafetyContext): boolean {
  const beginnerPhase =
    user.experience === 'Beginner' && user.weeks_trained < SAFETY_FLOORS.beginnerFirstWeeks
  if (beginnerPhase && ex.prescription_class === 'Power') return true
  return false
}

/** S09: a spotter-recommended lift for a solo lifter needs a swap or a safe-setup cue. */
export function needsSpotterHandling(ex: ExerciseSafetyMeta, user: UserSafetyContext): boolean {
  return ex.spotter_recommended && user.trains_alone
}

/** No-collars-on-bench / safeties-in-the-rack cue attached when a swap isn't taken. */
export const NO_SPOTTER_CUE =
  'Training alone: no collars on the bar so you can bail, and set the rack safeties to catch a failed rep.'

/**
 * S07: the maximum safe weekly load increase for one exercise — the SMALLER of 5% of
 * the current load and the absolute per-session cap for the body region.
 */
export function weeklyLoadCapKg(currentLoadKg: number, region: BodyRegion): number {
  const pctCap = currentLoadKg * SAFETY_FLOORS.weeklyLoadPct
  const absCap = region === 'upper' ? SAFETY_FLOORS.upperCapKg : SAFETY_FLOORS.lowerCapKg
  return Math.min(pctCap, absCap)
}

/**
 * Clamp a prescription against every numeric HARD floor plus the P01 beginner default.
 * Returns the safe prescription and the rule_ids that fired. RIR is only ever RAISED,
 * never lowered — the engine meets the exercise Min RIR, it never eases below it.
 */
export function clampPrescription(
  rxIn: Prescription,
  ex: ExerciseSafetyMeta,
  user: UserSafetyContext,
): ClampResult {
  const rx: Prescription = { ...rxIn }
  const applied: string[] = []
  const raiseRir = (floor: number, id: string) => {
    if (rx.rir_min < floor) { rx.rir_min = floor; applied.push(id) }
  }

  // S02: Power is never taken near failure.
  if (ex.prescription_class === 'Power') raiseRir(SAFETY_FLOORS.powerRirMin, 'S02')

  // S03: Failure-not-allowed exercises stop at (or above) their Min RIR.
  if (!ex.failure_allowed) raiseRir(ex.min_rir, 'S03')
  // Min RIR is a floor for every exercise regardless (never taken past it).
  raiseRir(ex.min_rir, 'MIN_RIR')

  // S04: Load class never below 4 reps or above 88% 1RM.
  if (ex.prescription_class === 'Load') {
    if (rx.reps_min !== undefined && rx.reps_min < SAFETY_FLOORS.loadRepsMin) {
      rx.reps_min = SAFETY_FLOORS.loadRepsMin
      applied.push('S04')
    }
    if (rx.pct_1rm_max !== undefined && rx.pct_1rm_max > SAFETY_FLOORS.loadPct1rmMax) {
      rx.pct_1rm_max = SAFETY_FLOORS.loadPct1rmMax
      if (!applied.includes('S04')) applied.push('S04')
    }
  }

  // P01: beginner first 4 weeks → rir_min ≥ 2 (Power/Advanced already blocked upstream).
  const beginnerPhase =
    user.experience === 'Beginner' && user.weeks_trained < SAFETY_FLOORS.beginnerFirstWeeks
  if (beginnerPhase) raiseRir(SAFETY_FLOORS.beginnerRirMin, 'P01')

  // P02: minimum rest floor outside Fat Loss circuits / Interval work (a default).
  if ((ex.prescription_class === 'Load' || ex.prescription_class === 'Rep') &&
      rx.rest_sec_min !== undefined && rx.rest_sec_min < SAFETY_FLOORS.minRestSec) {
    rx.rest_sec_min = SAFETY_FLOORS.minRestSec
    applied.push('P02')
  }

  // P03: cap timed holds at 60s (a preference, not a safety fact).
  if (ex.prescription_class === 'Time' &&
      rx.duration_sec_max !== undefined && rx.duration_sec_max > SAFETY_FLOORS.timeCapSec) {
    rx.duration_sec_max = SAFETY_FLOORS.timeCapSec
    applied.push('P03')
  }

  return { rx, applied }
}

export { SAFETY_FLOORS }
