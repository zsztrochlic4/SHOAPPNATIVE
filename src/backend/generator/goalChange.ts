/**
 * Goal Change — Generator Flow step 14 (runtime).
 * Source: sheet "Goal Change" (GC01–GC09). Re-runs the goal-dependent steps (split
 * selection, volume budget, prescription) while preserving what doesn't depend on goal
 * (logged loads / progression_state, schedule, screening). Intensity never spikes: one easy
 * transition week runs at rir_min + 1 (GC07). A goal change always versions the program
 * (GC09). Every re-prescription is re-clamped by the Safety Rules (via generateProgram).
 *
 * Deterministic. Does NOT touch progression_state — current loads carry into the new
 * prescription; only the rep/set targets around them move (GC06).
 */

import type { BackendGoal, UserDoc } from '../schema'
import { generateProgram, type GeneratedProgram } from './generate'

export interface GoalChangeResult {
  ok: true
  previousGoal: BackendGoal
  newGoal: BackendGoal
  version: number
  /** GC07: first week runs one RIR easier than target, then settles. */
  transitionWeekRirBump: 1
  program: GeneratedProgram
  transitionProgram: GeneratedProgram
  notes: string[]
}

/** Copy a program with every prescription one RIR easier — the GC07 transition week. */
function withTransitionWeek(p: GeneratedProgram): GeneratedProgram {
  return { ...p, days: p.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, rirMin: e.rirMin + 1, appliedRules: [...e.appliedRules, 'GC07'] })) })) }
}

export function changeGoal(
  user: UserDoc,
  newGoal: BackendGoal,
  currentVersion = 1,
): GoalChangeResult | { ok: false; reason: string } {
  if (newGoal === user.goal) return { ok: false, reason: 'same_goal' }
  // GC02–GC05: re-select split, re-budget volume, re-prescribe (re-clamped inside).
  const gen = generateProgram({ ...user, goal: newGoal })
  if (!gen.ok) return { ok: false, reason: gen.reason }

  return {
    ok: true,
    previousGoal: user.goal,
    newGoal,
    version: currentVersion + 1, // GC09: new version; caller sets superseded_by on the old one
    transitionWeekRirBump: 1,
    program: gen.program,
    transitionProgram: withTransitionWeek(gen.program),
    notes: [
      'GC06: progression_state is untouched — your logged loads carry into the new prescription; only the rep/set targets move.',
      'GC05: load is the last thing cut — the main compounds stay; accessory volume shifts first.',
      'GC07: week one runs one RIR easier than target, then settles (no intensity spike).',
      'GC08: confirm nothing health-relevant has changed; if it has, re-run screening before applying.',
      `GC09: created program version ${currentVersion + 1}; the previous version stays in history.`,
    ],
  }
}
