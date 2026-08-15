import { todayKey, dayKey, fromKey, toKey, now } from '../lib/date'
import { fmtWeightNum, weightUnit } from '../lib/format'
import { incrementFor } from '../data/catalog'
import { completedSessions } from './selectors'
import { activePeriod, plannedPeriods, upcomingPeriods } from './periods'
import type { AppState, Goal, WorkoutSession } from './types'

/* ----------------------- rep range parsing ----------------------- */
export function parseRepRange(target: string): { low: number; high: number } {
  const nums = (target.match(/\d+/g) ?? []).map(Number)
  if (nums.length === 0) return { low: 8, high: 8 }
  if (nums.length === 1) return { low: nums[0], high: nums[0] }
  return { low: Math.min(...nums), high: Math.max(...nums) }
}

export type Recommendation = {
  direction: 'up' | 'hold' | 'down'
  suggestedWeightKg: number
  suggestedReps: number
  lastWeightKg: number | null
  reason: string
  hasHistory: boolean
}

/**
 * Beginner-friendly, transparent progression.
 * Hit every rep last time, nudge up. Miss, hold or back off. Always overridable.
 */
export function nextSetRecommendation(
  s: AppState,
  defId: string,
  target: string,
  fallbackWeightKg: number,
): Recommendation {
  const units = s.settings.units
  const u = weightUnit(units)
  const { low, high } = parseRepRange(target)
  const inc = incrementFor(defId)

  const prior = completedSessions(s)
    .filter((x) => x.dateKey !== todayKey && x.exercises.some((e) => e.defId === defId))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))

  const last = prior[0]
  if (!last) {
    return {
      direction: 'hold',
      suggestedWeightKg: fallbackWeightKg,
      suggestedReps: low,
      lastWeightKg: null,
      reason: 'First time logging this one. Start light, find a weight you can control for every rep.',
      hasHistory: false,
    }
  }

  const ex = last.exercises.find((e) => e.defId === defId)!
  const sets = ex.sets
  const lastWeight = Math.max(...sets.map((x) => x.weightKg))
  const allHitHigh = sets.every((x) => x.reps >= high)
  const missedCount = sets.filter((x) => x.reps < low).length
  const reallyStruggled = missedCount > sets.length / 2
  const fmt = (kg: number) => `${fmtWeightNum(kg, units, units === 'imperial' ? 0 : 1)}${u}`

  if (allHitHigh) {
    const next = lastWeight + inc
    const repText = low === high ? `${low} reps` : `${low} to ${high} reps`
    return {
      direction: 'up',
      suggestedWeightKg: next,
      suggestedReps: low,
      lastWeightKg: lastWeight,
      reason: `You hit every rep at ${fmt(lastWeight)} last time. Let's try ${fmt(next)} for ${repText}.`,
      hasHistory: true,
    }
  }
  if (reallyStruggled) {
    const next = Math.max(inc, Math.floor((lastWeight * 0.9) / inc) * inc)
    return {
      direction: 'down',
      suggestedWeightKg: next,
      suggestedReps: low,
      lastWeightKg: lastWeight,
      reason: `Last time was a grind. We'll ease back to ${fmt(next)} and build from there. No pressure.`,
      hasHistory: true,
    }
  }
  return {
    direction: 'hold',
    suggestedWeightKg: lastWeight,
    suggestedReps: high,
    lastWeightKg: lastWeight,
    reason: `Stay at ${fmt(lastWeight)} and aim for one more rep than last time. Earn the jump.`,
    hasHistory: true,
  }
}

/* --------------------------- Exam mode --------------------------- */
export type ExamPhase = 'none' | 'approaching' | 'during' | 'recovering'
export type ExamState = {
  enabled: boolean
  active: boolean
  phase: ExamPhase
  daysUntil: number | null
  daysLeft: number | null
  startKey?: string
  endKey?: string
  /** The active period's mode id ('pause'|'maintenance'|'moving'|'fewer'|'deload'|'asis'), so
   *  consumers can apply mode-specific behaviour rather than a single "active" toggle. */
  mode?: string
}

function daysBetween(aKey: string, bKey: string) {
  return Math.round((fromKey(bKey).getTime() - fromKey(aKey).getTime()) / 86400000)
}

/**
 * Where the user sits relative to their declared busy periods (Plan Around Your
 * Life). `active` is deliberately true only *inside* a period and only when the
 * chosen mode actually changes training — "Keep it as is" is a promise that
 * nothing moves, so it must not quietly ease targets or trim sessions.
 */
export function examState(s: AppState): ExamState {
  const periods = plannedPeriods(s)
  if (periods.length === 0) return { enabled: false, active: false, phase: 'none', daysUntil: null, daysLeft: null }

  const current = activePeriod(s)
  if (current) {
    return {
      enabled: true,
      active: current.mode !== 'asis',
      phase: 'during',
      daysUntil: null,
      daysLeft: Math.max(0, daysBetween(todayKey, current.end)),
      startKey: current.start,
      endKey: current.end,
      mode: current.mode ?? undefined,
    }
  }

  const next = upcomingPeriods(s)[0]
  const toStart = next ? daysBetween(todayKey, next.start) : null
  if (next && toStart !== null && toStart <= 7) {
    return { enabled: true, active: false, phase: 'approaching', daysUntil: toStart, daysLeft: null, startKey: next.start, endKey: next.end }
  }

  // Just come out the other side: keep the "ramping back up" copy for a few days.
  const past = periods.filter((p) => p.end < todayKey).sort((a, b) => b.end.localeCompare(a.end))[0]
  if (past && daysBetween(past.end, todayKey) <= 4) {
    return { enabled: true, active: false, phase: 'recovering', daysUntil: toStart, daysLeft: null, startKey: past.start, endKey: past.end }
  }

  return { enabled: true, active: false, phase: 'none', daysUntil: toStart, daysLeft: null, startKey: next?.start, endKey: next?.end }
}

export type DailyTargets = {
  calorie: number
  protein: number
  carb: number
  fat: number
  waterL: number
  steps: number
  sleepH: number
  adjusted: boolean
}

/** Daily targets, dialled toward maintenance and recovery during exams. */
export function dailyTargets(s: AppState): DailyTargets {
  const p = s.profile
  const base: DailyTargets = {
    calorie: p.calorieTarget,
    protein: p.proteinTarget,
    carb: p.carbTarget,
    fat: p.fatTarget,
    waterL: p.waterTargetL,
    steps: p.stepTarget,
    sleepH: p.sleepTargetH,
    adjusted: false,
  }
  if (!examState(s).active) return base

  const calorieShift = shiftForGoal(p.goal)
  const calorie = p.calorieTarget + calorieShift
  // keep protein, move carbs to absorb most of the calorie change
  const carb = Math.max(120, Math.round(p.carbTarget + calorieShift / 4))
  return {
    calorie,
    protein: p.proteinTarget,
    carb,
    fat: p.fatTarget,
    waterL: p.waterTargetL,
    steps: Math.round(p.stepTarget * 0.7),
    sleepH: Math.min(9, p.sleepTargetH + 0.5),
    adjusted: true,
  }
}

function shiftForGoal(goal: Goal): number {
  if (goal === 'build-muscle' || goal === 'gain-strength') return -250 // surplus toward maintenance
  if (goal === 'lose-fat') return 150 // ease the deficit so training and study can coexist
  return 0
}

/**
 * Mode-aware busy-period trim (Plan Around Your Life). Each mode now behaves differently instead of
 * collapsing to one "active" trim:
 *  - 'pause' (Full pause) and 'moving' (Just keep moving, no lifting): nothing required — every
 *    exercise is optional (keptCount 0), so the day reads as rest / walk-only.
 *  - 'maintenance', 'fewer', 'deload' and any other active mode: keep the key lifts, rest optional.
 * "Keep it as is" (asis) stays inactive and trims nothing.
 */
export function examTrim(session: WorkoutSession, s: AppState): { optionalIds: Set<string>; keptCount: number } {
  const st = examState(s)
  if (!st.active) return { optionalIds: new Set(), keptCount: session.exercises.length }
  const noRequiredLifting = st.mode === 'pause' || st.mode === 'moving'
  const keep = noRequiredLifting ? 0 : Math.min(3, session.exercises.length)
  const optionalIds = new Set(session.exercises.slice(keep).map((e) => e.defId))
  return { optionalIds, keptCount: keep }
}

/* A sensible default exam window for the demo: roughly two weeks out. */
export function defaultExamWindow(): { startKey: string; endKey: string } {
  const start = new Date(now())
  start.setDate(start.getDate() + 12)
  const end = new Date(start)
  end.setDate(end.getDate() + 14)
  return { startKey: toKey(start), endKey: toKey(end) }
}

export { dayKey }
