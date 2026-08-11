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

const normalizeName = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Resolve a loose exercise reference — an exact id OR a human name — to a canonical exercise id, or
 * null when nothing matches. Used to safely turn a coach-supplied exercise reference into a real id
 * before opening its detail sheet: never trust an arbitrary model string, and a non-match must open
 * nothing rather than a blank sheet. Exact id and exact normalised-name matches win; a word-overlap
 * (e.g. "bench" → "Barbell Bench Press") is the last resort.
 */
export function resolveExerciseRef(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (EXERCISE_BY_ID[trimmed]) return trimmed // already a valid id
  const target = normalizeName(trimmed)
  if (target.length < 3) return null
  let partial: string | null = null
  for (const ex of EXERCISES) {
    const n = normalizeName(ex.name)
    if (n === target) return ex.id // exact name match wins outright
    if (!partial && (n.includes(target) || target.includes(n))) partial = ex.id
  }
  return partial
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
