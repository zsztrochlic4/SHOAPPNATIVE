/**
 * Static exercise data access — lookups over the generated seed.
 * The generated exercises.ts / substitutions.ts are plain data; helpers live here.
 */

import { EXERCISES } from './exercises'
import { SUBSTITUTIONS } from './substitutions'
import { PRESCRIPTION_GRID } from './prescriptionGrid'
import type { Exercise, PrescriptionRow, Substitution } from './types'
import type { ExerciseSafetyMeta } from '../safety/safetyRules'

export { EXERCISES, SUBSTITUTIONS, PRESCRIPTION_GRID }
export type { Exercise, Substitution, PrescriptionRow }

/** Prescription grid keyed by `${goal}|${class}` (Generator Flow step 7). */
export const PRESCRIPTION_BY_KEY: Readonly<Record<string, PrescriptionRow>> = Object.freeze(
  Object.fromEntries(PRESCRIPTION_GRID.map((r) => [r.key, r])),
)

/** Look up the grid row for a goal + prescription class. */
export function prescriptionFor(goal: string, prescriptionClass: string): PrescriptionRow | undefined {
  return PRESCRIPTION_BY_KEY[`${goal}|${prescriptionClass}`]
}

export const EXERCISE_BY_ID: Readonly<Record<string, Exercise>> = Object.freeze(
  Object.fromEntries(EXERCISES.map((e) => [e.id, e])),
)

export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_BY_ID[id]
}

/** Substitutes for each exercise, best-first (priority ascending). */
export const SUBSTITUTIONS_BY_EXERCISE: Readonly<Record<string, Substitution[]>> = Object.freeze(
  SUBSTITUTIONS.reduce<Record<string, Substitution[]>>((acc, s) => {
    ;(acc[s.exerciseId] ??= []).push(s)
    return acc
  }, {}),
)
for (const list of Object.values(SUBSTITUTIONS_BY_EXERCISE)) list.sort((a, b) => a.priority - b.priority)

/** Ordered best-first substitute exercise ids for a given exercise. */
export function substitutesFor(id: string): string[] {
  return (SUBSTITUTIONS_BY_EXERCISE[id] ?? []).map((s) => s.substituteId)
}

/** Adapt a seed Exercise to the shape the Safety Rules engine consumes. */
export function toSafetyMeta(ex: Exercise): ExerciseSafetyMeta {
  return {
    id: ex.id,
    skill_level: ex.skillLevel,
    prescription_class: ex.prescriptionClass,
    failure_allowed: ex.failureAllowed,
    min_rir: ex.minRir,
    spotter_recommended: ex.spotterRecommended,
    body_region: ex.bodyRegion,
  }
}

export const ACTIVE_EXERCISES = EXERCISES.filter((e) => e.active)
