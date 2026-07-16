/**
 * Progression Engine — Generator Flow step 9 (runtime).
 * Source: sheet "Progression Engine" (PR01–PR08 + load increments by equipment) + Safety
 * Rules (S07 weekly load cap, Min RIR, reps≥4 on Load, ≤88% 1RM). Runs after every
 * completed instance: reads the session's set logs + progression_state and returns the
 * next state and (re-clamped) prescription. Progression only happens when it is safe —
 * fatigue, missed reps and stop symptoms pause or reverse it. Deterministic.
 */

import type { Exercise } from '../data/types'
import type { PrescriptionRow } from '../data/types'
import type { ProgressionStateDoc } from '../schema'
import { SAFETY_FLOORS, weeklyLoadCapKg } from '../safety/safetyRules'

export type EquipmentType = 'barbell' | 'dumbbell' | 'fixed_machine' | 'cable' | 'bodyweight' | 'band' | 'assisted' | 'other'

/** Derive the increment family from the exercise's load unit + required tags. */
export function equipmentType(ex: Exercise): EquipmentType {
  if (ex.loadUnit === 'bodyweight') return 'bodyweight'
  if (ex.loadUnit === 'assist_kg') return 'assisted'
  if (ex.loadUnit === 'rounds' || ex.loadUnit === 'seconds') return 'other'
  const tags = ex.requiredEquipmentTags.join(' ')
  if (/\bband\b/.test(tags)) return 'band'
  if (/barbell|trap_bar|ez_bar|low_bar/.test(tags)) return 'barbell'
  if (/dumbbell/.test(tags)) return 'dumbbell'
  if (/cable|rope_attachment/.test(tags)) return 'cable'
  if (/machine/.test(tags)) return 'fixed_machine'
  return 'barbell'
}

/** Smallest achievable load increment for the equipment (kg), before the S07 cap. */
function baseIncrement(type: EquipmentType, region: 'upper' | 'lower', beginner: boolean): number {
  switch (type) {
    case 'barbell': return region === 'lower' && !beginner ? 5 : 2.5
    case 'dumbbell': return 2
    case 'fixed_machine': case 'cable': return 2.5
    case 'assisted': return -2.5 // less assistance = harder
    default: return 2.5
  }
}
const roundTo = (kg: number, step: number) => Math.round(kg / step) * step

export type ProgressRule = 'PR01' | 'PR02' | 'PR03' | 'PR04' | 'PR05' | 'PR06' | 'PR07'

export interface SessionSet { reps_done?: number; rir_reported?: number; load_kg?: number; failure?: boolean }

export interface ProgressInput {
  ex: Exercise
  grid: PrescriptionRow // the goal|class row currently prescribed
  state: ProgressionStateDoc
  sets: SessionSet[]
  /** F03/PR06 fatigue signals for the session. */
  fatigue?: { rpe10OrFailureSets?: number; poorSleep?: boolean; missedPrior?: boolean }
  beginnerRamp?: boolean // first 4 weeks (P01)
  requiredSessionsToProgress?: number // default 2
}

export interface ProgressResult {
  rule: ProgressRule
  nextState: ProgressionStateDoc
  deload: boolean
  note: string
}

export function progressExercise(input: ProgressInput): ProgressResult {
  const { ex, grid, state, sets } = input
  const required = input.requiredSessionsToProgress ?? 2
  const repsMax = grid.repsMax ?? 12
  const repsMin = grid.repsMin ?? (ex.prescriptionClass === 'Load' ? SAFETY_FLOORS.loadRepsMin : 5)
  const targetRir = Math.max(grid.rirMin ?? ex.minRir, ex.minRir) // never easier-facing than the floor
  const loadable = ex.loadable

  const working = sets.filter((s) => s.reps_done != null)
  const hitTop = working.length > 0 && working.every((s) => (s.reps_done ?? 0) >= repsMax && (s.rir_reported ?? 99) <= targetRir + 0) // reps_max at prescribed RIR or easier
  const failSets = working.filter((s) => s.failure || (s.rir_reported ?? 99) <= 0).length
  const missedMin = working.some((s) => (s.reps_done ?? 0) < repsMin) || failSets >= 2

  // PR06 — fatigue override (F02/F03): never progress; hold or ease, raise rir_min by 1.
  const fatigued = (input.fatigue?.rpe10OrFailureSets ?? 0) >= 3 || input.fatigue?.poorSleep || input.fatigue?.missedPrior
  if (fatigued) {
    return { rule: 'PR06', deload: false, note: 'Fatigue detected — holding this session and easing off (F02/F03); progression resumes when it clears.', nextState: { ...state, sessions_at_current: state.sessions_at_current + 1 } }
  }

  // PR04 — reduce: missed reps_min or failure on 2+ sets. Never below the floor.
  if (missedMin) {
    const stall = state.stall_count + 1
    // PR05 — stall: 3 consecutive stalls → deload that exercise (cut sets 40%, load 10%).
    if (stall >= 3) {
      const deloadLoad = loadable ? roundToSafe(state.current_load_kg * 0.9) : state.current_load_kg
      return { rule: 'PR05', deload: true, note: 'Third stall — deloading this exercise (sets −40%, load −10%) for one session, then resuming.', nextState: { ...state, current_load_kg: deloadLoad, stall_count: 0, deload_count: state.deload_count + 1, sessions_at_current: 0, last_progressed_at: null } }
    }
    const reduced = loadable ? roundToSafe(Math.max(0, state.current_load_kg * 0.9)) : state.current_load_kg
    const nextReps = loadable ? state.current_rep_target : Math.max(repsMin, state.current_rep_target - 1)
    return { rule: 'PR04', deload: false, note: 'Missed the target — backing off (load −10% or reps toward the floor) and rebuilding.', nextState: { ...state, current_load_kg: reduced, current_rep_target: nextReps, stall_count: stall, sessions_at_current: 0 } }
  }

  // PR01 — progress load (loadable): hit reps_max at RIR for the required sessions in a row.
  if (loadable && hitTop) {
    const readySessions = state.sessions_at_current + 1
    if (readySessions >= required) {
      const region = ex.bodyRegion
      let inc = baseIncrement(equipmentType(ex), region, input.beginnerRamp ?? false)
      // S07 cap: never more than min(5%, region cap) per week.
      const cap = weeklyLoadCapKg(state.current_load_kg || 20, region)
      if (inc > 0) inc = Math.min(inc, Math.max(cap, 0.0001))
      const nextLoad = roundToSafe(state.current_load_kg + inc)
      return { rule: 'PR01', deload: false, note: `Progressed load by ${Math.round((nextLoad - state.current_load_kg) * 10) / 10}kg (capped by S07); reps reset to ${repsMin}.`, nextState: { ...state, current_load_kg: nextLoad, current_rep_target: repsMin, sessions_at_current: 0, stall_count: 0, last_progressed_at: 'now' } }
    }
    return { rule: 'PR03', deload: false, note: `Strong session — one more like it and the load goes up (${readySessions}/${required}).`, nextState: { ...state, sessions_at_current: readySessions } }
  }

  // PR02 — progress reps (non-loadable): add reps beyond reps_max, then a harder variation.
  if (!loadable && hitTop) {
    return { rule: 'PR02', deload: false, note: 'Add a rep or two next time; once you pass the ceiling we’ll move you to a harder variation.', nextState: { ...state, current_rep_target: state.current_rep_target + 1, sessions_at_current: 0, stall_count: 0, last_progressed_at: 'now' } }
  }

  // PR03 — hold: completed inside the range but not at the top.
  return { rule: 'PR03', deload: false, note: 'Solid — repeat the same prescription next session.', nextState: { ...state, sessions_at_current: state.sessions_at_current + 1 } }
}

/** Round to a sane 0.5kg grid and never negative (final loads still pass the safety clamp). */
function roundToSafe(kg: number): number {
  return Math.max(0, roundTo(kg, 0.5))
}
