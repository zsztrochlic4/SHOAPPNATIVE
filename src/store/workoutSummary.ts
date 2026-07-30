import { dayKey } from '../lib/date'
import type { AppState, WorkoutSession, WorkoutSummary } from './types'

/**
 * The workout-summary projection (Phase C Option B) and the pure re-derivations
 * of the all-time strength/volume charts from it.
 *
 * Kept free of React/Firebase and of selectors.ts (which imports THIS), so it
 * compiles under tsconfig.sweep.json and is unit-testable. `workoutPoints` is
 * the single source the four chart selectors read: it returns the stored
 * summaries once they cover the full history, else derives them on the fly from
 * whatever completed sessions are currently loaded — so output is identical
 * whether or not the backfill has run yet.
 */

/** Epley estimated 1RM. Matches the formula the selectors used before Option B. */
function epley(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

/** Project one completed session to its compact summary. */
export function summarizeSession(session: WorkoutSession): WorkoutSummary {
  const lifts: Record<string, number> = {}
  for (const ex of session.exercises) {
    let max = 0
    for (const set of ex.sets) {
      const est = epley(set.weightKg, set.reps)
      if (est > max) max = est
    }
    if (max > 0) lifts[ex.defId] = max
  }
  return { id: session.id, dateKey: session.dateKey, volumeKg: session.volumeKg, lifts }
}

/**
 * The points the charts read. Prefer the stored summaries once complete;
 * otherwise derive from the loaded completed sessions (the pre-Option-B path).
 */
export function workoutPoints(s: AppState): WorkoutSummary[] {
  if (s.workoutSummaryComplete && s.workoutSummaries) return s.workoutSummaries
  return s.sessions.filter((x) => x.completed).map(summarizeSession)
}

/** Rebuild every summary from the given (assumed complete) completed sessions. */
export function buildAllSummaries(sessions: WorkoutSession[]): WorkoutSummary[] {
  return sessions.filter((x) => x.completed).map(summarizeSession)
}

const CANONICAL_LIFTS = ['bench', 'squat', 'deadlift', 'ohp'] as const
const LIFT_NAMES: Record<string, string> = {
  bench: 'Bench Press',
  squat: 'Back Squat',
  deadlift: 'Deadlift',
  ohp: 'Overhead Press',
}

export interface StrengthProgressRow {
  id: string
  name: string
  from: number
  to: number
  pct: number
}

/** Featured-lift 4-week progress. Mirrors the old strengthProgress math, minus
 *  the cosmetic `image` (the selector attaches that from loaded sessions). */
export function strengthProgressFromPoints(points: WorkoutSummary[]): StrengthProgressRow[] {
  const done = [...points].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const fourWeeksAgo = dayKey(28)
  const rows: StrengthProgressRow[] = []
  for (const id of CANONICAL_LIFTS) {
    const withLift = done.filter((p) => p.lifts[id] != null)
    if (withLift.length === 0) continue
    const latest = withLift[withLift.length - 1]
    const past = withLift.find((p) => p.dateKey >= fourWeeksAgo) ?? withLift[0]
    const to = latest.lifts[id]
    const from = past.lifts[id]
    if (!to || !from) continue
    rows.push({
      id,
      name: LIFT_NAMES[id],
      from: Math.round(from / 2.5) * 2.5,
      to: Math.round(to / 2.5) * 2.5,
      pct: Math.round(((to - from) / from) * 100),
    })
  }
  return rows
}

/** Estimated-1RM series for a lift, chronological, rounded to 2.5kg. */
export function oneRMSeriesFromPoints(points: WorkoutSummary[], defId: string) {
  return points
    .filter((p) => p.lifts[defId] != null)
    .slice()
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((p) => ({ dateKey: p.dateKey, kg: Math.round(p.lifts[defId] / 2.5) * 2.5 }))
    .filter((p) => p.kg > 0)
}

/** The lift with the most logged sessions (default strength chart). */
export function bestLiftIdFromPoints(points: WorkoutSummary[]): string | null {
  const candidates = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown']
  let best: string | null = null
  let n = 0
  for (const id of candidates) {
    const c = points.filter((p) => p.lifts[id] != null).length
    if (c > n) {
      n = c
      best = id
    }
  }
  return best
}

/** Total training volume bucketed into the last `weeks` weeks (oldest → newest). */
export function volumeByWeekFromPoints(points: WorkoutSummary[], weeks = 8) {
  const out: { label: string; volume: number }[] = []
  for (let wk = weeks - 1; wk >= 0; wk--) {
    const start = dayKey(wk * 7 + 6)
    const end = dayKey(wk * 7)
    const volume = points
      .filter((p) => p.dateKey >= start && p.dateKey <= end)
      .reduce((a, p) => a + p.volumeKg, 0)
    out.push({ label: wk === 0 ? 'Now' : `${wk}w`, volume: Math.round(volume) })
  }
  return out
}
