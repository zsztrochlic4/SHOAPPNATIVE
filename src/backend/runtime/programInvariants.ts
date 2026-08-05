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
import { equipmentTagsSatisfied } from '../data/equipmentInventory'
import type { StoredProgram, StoredDay, StoredExercise } from './activate'
import type { InjuryRegion, UserDoc } from '../schema'

const TIER_RANK: Record<string, number> = { Bodyweight: 0, 'Basic Gym': 1, 'Full Gym': 2 }
const SKILL_RANK: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 }

export interface InvariantViolation {
  code: 'injury' | 'exclusion' | 'equipment' | 'skill' | 'duplicate' | 'unknown_exercise' | 'duration' | 'sparse' | 'empty_program'
  exerciseId?: string
  weekday?: string
  detail: string
}

export interface InvariantResult {
  ok: boolean
  violations: InvariantViolation[]
  /** Estimated minutes per day (weekday → minutes) — surfaced for duration-aware callers. */
  estimatedMinutesByDay: Record<string, number>
  /** Weekdays whose estimated time exceeds the promised session budget (U-014 — honest messaging). */
  daysOverBudget: string[]
}

/**
 * Session-length TARGET tolerance (audit U-014): the product target is +10%. Kept as the tolerance
 * the opt-in `enforceDuration` flag checks. The resolver does NOT hard-enforce it (the generator's
 * short-session time model overshoots and is a separate owner-tracked defect, IP-10); instead it
 * reports `daysOverBudget` so the coach never falsely claims a plan "fits" the promised time.
 */
export const DURATION_TARGET_TOLERANCE = 1.10

/** Fixed per-session overhead the earlier estimate omitted (U-014): general warm-up + transitions. */
export const SESSION_OVERHEAD_SEC = 300

/** Minimum exercises a scheduled training day must contain — fewer is a sparse/unfilled plan (U-011). */
export const MIN_EXERCISES_PER_TRAINING_DAY = 2

function equipmentOk(ex: Exercise, user: UserDoc): boolean {
  if ((TIER_RANK[ex.equipmentTier] ?? 9) > (TIER_RANK[user.equipment_tier] ?? 0)) return false
  return equipmentTagsSatisfied(ex.requiredEquipmentTags, user.equipment_tags)
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
  // Include the whole-session warm-up/transition overhead the earlier estimate omitted (U-014).
  const sec = SESSION_OVERHEAD_SEC + day.exercises.reduce((n, e) => n + estimateExerciseSeconds(e), 0)
  return Math.round(sec / 60)
}

export interface ValidateOptions {
  /** Treat a day running over `session_length_min * DURATION_TARGET_TOLERANCE` as a hard violation.
   *  Opt-in only (tests / future generator work) — the resolver does NOT set this. */
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
  const daysOverBudget: string[] = []
  const durationCapMin = user.session_length_min * DURATION_TARGET_TOLERANCE

  // U-011: an empty program (no scheduled days) is never a valid plan.
  if (program.days.length === 0) {
    violations.push({ code: 'empty_program', detail: 'The plan has no scheduled training days.' })
  }

  for (const day of program.days) {
    // U-011: a scheduled training day must not be empty / near-empty (an unfilled/sparse plan —
    // the harm behind the bodyweight required-slot defect). Rest days are not in program.days.
    if (day.exercises.length < MIN_EXERCISES_PER_TRAINING_DAY) {
      violations.push({ code: 'sparse', weekday: day.weekday, detail: `${day.weekday} has only ${day.exercises.length} exercise(s) — an incomplete plan.` })
    }
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
    // Over the PROMISED budget at all → surfaced so the coach is honest (U-014), never a false "fits".
    if (minutes > user.session_length_min) daysOverBudget.push(day.weekday)
    if (opts.enforceDuration && minutes > durationCapMin) {
      violations.push({ code: 'duration', weekday: day.weekday, detail: `${day.weekday} is ~${minutes} min, over the ${user.session_length_min} min budget (+${Math.round((DURATION_TARGET_TOLERANCE - 1) * 100)}% target).` })
    }
  }

  return { ok: violations.length === 0, violations, estimatedMinutesByDay, daysOverBudget }
}

/** Compact one-line summary for logs / action-journal reason codes (no PII). */
export function summarizeViolations(violations: InvariantViolation[]): string {
  if (!violations.length) return 'ok'
  const counts: Record<string, number> = {}
  for (const v of violations) counts[v.code] = (counts[v.code] ?? 0) + 1
  return Object.entries(counts).map(([code, n]) => `${code}:${n}`).join(',')
}

export interface DurationFitResult {
  /** The program with over-budget days trimmed of trailing accessory work. */
  program: StoredProgram
  /** Every exercise removed to fit, so callers can mirror the change into workout instances. */
  removed: { weekday: string; exerciseId: string }[]
  /** Worst single-day estimate after trimming. */
  worstMinutes: number
  /** True when every day now sits within `targetMin * tolerance`. */
  fits: boolean
}

/**
 * Fit a program to a session-time target (audit R5-009). When a user asks for a specific session
 * length we must respect it, not just disclose the overshoot. This removes the lowest-priority
 * ACCESSORY work (an isolation / non-Load exercise, else the last exercise) from the worst
 * over-budget day, re-estimating after each removal, until every day is within
 * `targetMin * tolerance` or no day can be trimmed further without dropping below the minimum
 * viable exercise count. Compound (Load) movements are preserved wherever possible so the plan
 * keeps its primary stimulus. Pure — never mutates the input program.
 */
export function fitProgramToDuration(
  program: StoredProgram,
  targetMin: number,
  tolerance: number = DURATION_TARGET_TOLERANCE,
): DurationFitResult {
  const cap = targetMin * tolerance
  const days: StoredDay[] = program.days.map((d) => ({ ...d, exercises: [...d.exercises] }))
  const removed: { weekday: string; exerciseId: string }[] = []

  // Bounded loop: at most one removal per iteration, capped well above any real exercise count.
  for (let guard = 0; guard < 500; guard++) {
    let worst: StoredDay | null = null
    let worstMin = 0
    for (const d of days) {
      const m = estimateDayMinutes(d)
      if (m > worstMin) { worstMin = m; worst = d }
    }
    if (!worst || worstMin <= cap) break
    if (worst.exercises.length <= MIN_EXERCISES_PER_TRAINING_DAY) break // can't trim this day further
    // Prefer the last non-Load (accessory/isolation) exercise; fall back to the last exercise.
    let idx = -1
    for (let i = worst.exercises.length - 1; i >= 0; i--) {
      if (worst.exercises[i].prescriptionClass !== 'Load') { idx = i; break }
    }
    if (idx === -1) idx = worst.exercises.length - 1
    const [gone] = worst.exercises.splice(idx, 1)
    removed.push({ weekday: worst.weekday, exerciseId: gone.exerciseId })
  }

  const weeklySetsByMuscle: Record<string, number> = {}
  for (const m of Object.keys(program.weeklySetsByMuscle)) {
    weeklySetsByMuscle[m] = days.reduce(
      (n, d) => n + d.exercises.filter((e) => e.muscleGroup === m).reduce((a, e) => a + e.sets, 0),
      0,
    )
  }
  const worstMinutes = days.reduce((mx, d) => Math.max(mx, estimateDayMinutes(d)), 0)
  return {
    program: { ...program, days, weeklySetsByMuscle },
    removed,
    worstMinutes,
    fits: worstMinutes <= cap,
  }
}
