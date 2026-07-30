/**
 * Pure circuit logic for the time-based quick-workout player (ActiveWorkout).
 *
 * Quick workouts are circuits: each `set` index across the exercises is one round,
 * and a round runs every station before the next round begins. Kept free of React
 * Native imports so it can be unit-tested in Node (see test/unit/quickCircuit).
 */
import type { WorkoutSession } from '../store/types'

export type Cursor = { exIdx: number; setIdx: number }

/** True when this is a time-based circuit (bodyweight quick workout). */
export function isTimeSession(s: WorkoutSession): boolean {
  return s.exercises.some((e) => e.measure === 'time')
}

/**
 * Circuit advance: run round-major (finish every station at the current set index —
 * one round — before moving to the next). Returns the next not-done station,
 * preferring the current round, then later rounds, then anything missed earlier.
 */
export function nextCircuitCursor(s: WorkoutSession, exIdx: number, setIdx: number): Cursor | null {
  const maxSets = Math.max(0, ...s.exercises.map((e) => e.sets.length))
  // Rest of the current round (later stations).
  for (let i = exIdx + 1; i < s.exercises.length; i++) if (!s.exercises[i].sets[setIdx]?.done) return { exIdx: i, setIdx }
  // Later rounds, from the first station.
  for (let sj = setIdx + 1; sj < maxSets; sj++)
    for (let i = 0; i < s.exercises.length; i++) if (!s.exercises[i].sets[sj]?.done) return { exIdx: i, setIdx: sj }
  // Anything missed earlier in the current round (e.g. resumed out of order).
  for (let i = 0; i <= exIdx; i++) if (!s.exercises[i].sets[setIdx]?.done) return { exIdx: i, setIdx }
  return null
}

/**
 * Rest (seconds) after finishing the station at `doneExIdx`/`fromSetIdx`, given the
 * `upcoming` station: the full round rest when a new round begins, else the station's
 * short transition rest.
 */
export function circuitRestSec(s: WorkoutSession, doneExIdx: number, fromSetIdx: number, upcoming: Cursor): number {
  const roundBoundary = upcoming.setIdx > fromSetIdx
  return roundBoundary ? s.roundRestSec ?? 60 : s.exercises[doneExIdx].restSec ?? 15
}
