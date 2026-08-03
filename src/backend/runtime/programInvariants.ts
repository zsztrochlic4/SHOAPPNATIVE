/**
 * validateProgramForUser — the ONE shared post-transform safety gate (audit CA-002 / C-002,
 * C-004, C-011).
 *
 * The language model may choose INTENT (swap this, change that), but it may never choose the
 * SAFETY POLICY. After every program-changing transform (swap, regeneration, deload,
 * reschedule) the resulting plan is run through this gate BEFORE it is previewed to the user
 * and again BEFORE it is committed to storage. A plan that violates a hard user constraint is
 * rejected and the caller keeps the prior plan — we never surface or persist an illegal plan.
 *
 * Hard invariants (any violation ⇒ ok:false):
 *   - INJURY:     no exercise is in the injury hard-exclusion set for the user's affected
 *                 regions (Injury Modifications excludeIds), regardless of how it got there.
 *   - EXCLUSION:  no exercise is in the user's excluded_exercise_ids (dislikes / pain history).
 *   - EQUIPMENT:  every exercise fits the user's equipment tier + owned tags.
 *   - SKILL:      no exercise exceeds the user's skill level (S01).
 *   - DUPLICATE:  no exercise appears twice within a single day.
 *   - UNKNOWN:    every exercise id resolves in the Exercise Database.
 *
 * Soft checks (reported, and enforced by callers that opt in via `enforceDuration`):
 *   - DURATION:   each day's estimated time stays within the session budget + tolerance.
 *
 * PURE + dependency-light (data + schema only) so it can run app-side in the resolver and,
 * in future, server-side before an authoritative commit. Deterministic.
 */

import { EXERCISE_BY_ID } from '../data/index'
import type { Exercise } from '../data/types'
import { injuryExcludeIds } from '../generator/build'
import type { StoredProgram, StoredDay, StoredExercise } from './activate'
import type { InjuryRegion, UserDoc } from '../schema'

const TIER_RANK: Record<string, number> = { Bodyweight: 0, 'Basic Gym': 1, 'Full Gym': 2 }
const SKILL_RANK: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 }

export interface InvariantViolation {
  code: 'injury' | 'exclusion' | 'equipment' | 'skill' | 'duplicate' | 'unknown_exercise' | 'duration'
  exerciseId?: string
  weekday?: string
  detail: string
}

export interface InvariantResult {
  ok: boolean
  violations: InvariantViolation[]
  /** Estimated minutes per day (weekday → minutes) — surfaced for duration-aware callers. */
  estimatedMinutesByDay: Record<string, number>
}

/** Session-length tolerance: a generated/transformed day may run up to this factor over budget. */
export const DURATION_TOLERANCE = 1.25

function equipmentOk(ex: Exercise, user: UserDoc): boolean {
  if ((TIER_RANK[ex.equipmentTier] ?? 9) > (TIER_RANK[user.equipment_tier] ?? 0)) return false
  return ex.requiredEquipmentTags.every((t) => t.split('/').some((x) => user.equipment_tags.includes(x.trim())))
}

function skillOk(ex: Exercise, user: UserDoc): boolean {
  return (SKILL_RANK[ex.skillLevel] ?? 9) <= (SKILL_RANK[user.experience] ?? 0)
}

/**
 * Estimate a single day's wall-clock minutes. Per set ≈ work time + rest. Rep-based work is
 * costed at ~4 s/rep (concentric+eccentric+turnaround); timed work uses its duration; both
 * add the prescribed rest between sets. A light per-exercise setup overhead is included.
 * Deliberately conservative but bounded so a well-formed generated plan sits inside budget.
 */
export function estimateExerciseSeconds(e: StoredExercise): number {
  const setupSec = 45
  const reps = e.repsMax ?? e.repsMin ?? 10
  const workPerSetSec = e.durationSecMax != null ? e.durationSecMax : Math.max(20, reps * 4)
  const restSec = e.restSecMin ?? 75
  // `sets` work bouts, with rest after all but the last.
  const work = e.sets * workPerSetSec
  const rest = Math.max(0, e.sets - 1) * restSec
  return setupSec + work + rest
}

export function estimateDayMinutes(day: StoredDay): number {
  const sec = day.exercises.reduce((n, e) => n + estimateExerciseSeconds(e), 0)
  return Math.round(sec / 60)
}

export interface ValidateOptions {
  /** Treat a day running over `session_length_min * DURATION_TOLERANCE` as a hard violation. */
  enforceDuration?: boolean
}

/**
 * Run every hard invariant (and the duration check) over a projected program for a user.
 * Returns ok:false with the list of violations if any hard constraint is broken.
 */
export function validateProgramForUser(
  user: UserDoc,
  program: StoredProgram,
  opts: ValidateOptions = {},
): InvariantResult {
  const violations: InvariantViolation[] = []
  const injuryExcluded = injuryExcludeIds(user.affected_regions as InjuryRegion[])
  const userExcluded = new Set(user.excluded_exercise_ids)
  const estimatedMinutesByDay: Record<string, number> = {}
  const durationCapMin = user.session_length_min * DURATION_TOLERANCE

  for (const day of program.days) {
    const seenInDay = new Set<string>()
    for (const e of day.exercises) {
      const ex = EXERCISE_BY_ID[e.exerciseId]
      if (!ex) {
        violations.push({ code: 'unknown_exercise', exerciseId: e.exerciseId, weekday: day.weekday, detail: `${e.exerciseId} is not in the Exercise Database.` })
        continue
      }
      if (injuryExcluded.has(e.exerciseId)) {
        violations.push({ code: 'injury', exerciseId: e.exerciseId, weekday: day.weekday, detail: `${ex.name} is hard-excluded by an injury constraint.` })
      }
      if (userExcluded.has(e.exerciseId)) {
        violations.push({ code: 'exclusion', exerciseId: e.exerciseId, weekday: day.weekday, detail: `${ex.name} is on the user's excluded list.` })
      }
      if (!equipmentOk(ex, user)) {
        violations.push({ code: 'equipment', exerciseId: e.exerciseId, weekday: day.weekday, detail: `${ex.name} needs equipment the user doesn't have.` })
      }
      if (!skillOk(ex, user)) {
        violations.push({ code: 'skill', exerciseId: e.exerciseId, weekday: day.weekday, detail: `${ex.name} exceeds the user's skill level.` })
      }
      if (seenInDay.has(e.exerciseId)) {
        violations.push({ code: 'duplicate', exerciseId: e.exerciseId, weekday: day.weekday, detail: `${ex.name} appears twice on ${day.weekday}.` })
      }
      seenInDay.add(e.exerciseId)
    }
    const minutes = estimateDayMinutes(day)
    estimatedMinutesByDay[day.weekday] = minutes
    if (opts.enforceDuration && minutes > durationCapMin) {
      violations.push({ code: 'duration', weekday: day.weekday, detail: `${day.weekday} is ~${minutes} min, over the ${user.session_length_min} min budget (+${Math.round((DURATION_TOLERANCE - 1) * 100)}% tolerance).` })
    }
  }

  return { ok: violations.length === 0, violations, estimatedMinutesByDay }
}

/** Compact one-line summary for logs / action-journal reason codes (no PII). */
export function summarizeViolations(violations: InvariantViolation[]): string {
  if (!violations.length) return 'ok'
  const counts: Record<string, number> = {}
  for (const v of violations) counts[v.code] = (counts[v.code] ?? 0) + 1
  return Object.entries(counts).map(([code, n]) => `${code}:${n}`).join(',')
}
