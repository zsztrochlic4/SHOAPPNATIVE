/**
 * Generator Flow step 3 — pick the split.
 * Source: sheets "Split Selector" (decision table, first match wins) + "Splits".
 * Match on days_per_week, then experience, then goal. 'All' matches everything.
 */

import { SPLIT_SELECTOR } from '../data/splitSelector'
import { SPLITS } from '../data/splits'
import type { Split } from '../data/types'
import type { BackendExperience, BackendGoal } from '../schema'

function tokenMatch(tokens: string[], value: string): boolean {
  return tokens.includes('All') || tokens.includes(value)
}

export interface SelectedSplit {
  split: Split
  dayStructure: string[]
  reason: string
}

/** First matching selector row wins. `days` is clamped to the 1–6 the table covers. */
export function selectSplit(days: number, experience: BackendExperience, goal: BackendGoal): SelectedSplit {
  const clamped = Math.max(1, Math.min(6, Math.round(days)))
  const row = SPLIT_SELECTOR.find(
    (r) => r.daysPerWeek === clamped && tokenMatch(r.experience, experience) && tokenMatch(r.goal, goal),
  )
  if (!row) throw new Error(`No split for ${clamped} days / ${experience} / ${goal}`)
  const split = SPLITS.find((s) => s.splitId === row.splitId)
  if (!split) throw new Error(`Split ${row.splitId} not found in Splits sheet`)
  return { split, dayStructure: [...split.dayStructure], reason: row.reason }
}
