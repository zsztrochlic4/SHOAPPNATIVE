/**
 * Deload & fatigue adjustments — Generator Flow step 12 (runtime).
 * Source: sheet "Safety Rules" F01 (6-week deload / fatigue deload), F02 (RPE10 or 3+ fail
 * sets), F03 (poor sleep / missed session). A deload cuts sets ~40%, HOLDS load, and raises
 * rir_min by 1 — it never touches the stored loads. At 6 weeks it is OFFERED (accept or
 * defer once); on real fatigue signals it is APPLIED. Deterministic.
 */

import type { BuiltExercise } from './build'
import type { GeneratedProgram } from './generate'

export interface Adjustment { setMultiplier: number; rirBump: number; holdLoad: boolean }

/** Apply a set-multiplier + RIR bump to every recommended exercise (deload / transition). */
export function adjustProgram(program: GeneratedProgram, adj: Adjustment, tag: string): GeneratedProgram {
  const scale = (e: BuiltExercise): BuiltExercise => ({
    ...e,
    sets: Math.max(1, Math.round(e.sets * adj.setMultiplier)),
    rirMin: e.rirMin + adj.rirBump,
    appliedRules: [...e.appliedRules, tag],
  })
  const days = program.days.map((d) => ({ ...d, exercises: d.exercises.map(scale) }))
  const weeklySetsByMuscle: Record<string, number> = {}
  for (const m of Object.keys(program.weeklySetsByMuscle)) {
    weeklySetsByMuscle[m] = days.reduce((n, d) => n + d.exercises.filter((e) => e.muscleGroup === m).reduce((a, e) => a + e.sets, 0), 0)
  }
  return { ...program, days, weeklySetsByMuscle }
}

export const DELOAD: Adjustment = { setMultiplier: 0.6, rirBump: 1, holdLoad: true }

export interface FatigueSignals {
  completedWeeks?: number
  stalledWeeks?: number       // consecutive weeks of stalled progression
  risingRpe?: boolean
  persistentSoreness?: boolean
  rpe10OrFailSets?: number    // this session (F02)
  poorSleep?: boolean         // F03
  missedSession?: boolean     // F03
}

export type DeloadDecision =
  | { kind: 'apply_deload'; adjustment: Adjustment; note: string }
  | { kind: 'offer_deload'; adjustment: Adjustment; note: string }
  | { kind: 'f02_pullback'; setsDelta: -1; rirBump: 1; note: string }
  | { kind: 'f03_ease'; rirBump: 1; note: string }
  | { kind: 'none' }

/** Decide the fatigue response for the upcoming session/week (F01–F03). */
export function deloadDecision(s: FatigueSignals): DeloadDecision {
  // F01 — deload APPLIED on real fatigue signals; OFFERED at the 6-week mark.
  const fatigueConfirmed = (s.stalledWeeks ?? 0) >= 2 || s.risingRpe || s.persistentSoreness
  if (fatigueConfirmed) {
    return { kind: 'apply_deload', adjustment: DELOAD, note: 'Fatigue is showing (stalled progress / rising RPE / lingering soreness) — running an easy week: sets −40%, load held, one more RIR in the tank.' }
  }
  if ((s.completedWeeks ?? 0) >= 6 && (s.completedWeeks ?? 0) % 6 === 0) {
    return { kind: 'offer_deload', adjustment: DELOAD, note: 'You’re six weeks in — want an easy week? (sets −40%, load held, +1 RIR). Accept or carry on; we won’t nag.' }
  }
  // F02 — hard fatigue this session.
  if ((s.rpe10OrFailSets ?? 0) >= 3) {
    return { kind: 'f02_pullback', setsDelta: -1, rirBump: 1, note: 'Tough session logged — next one drops a set and eases off one RIR (F02).' }
  }
  // F03 — poor sleep or a missed session.
  if (s.poorSleep || s.missedSession) {
    return { kind: 'f03_ease', rirBump: 1, note: 'Rough day — this session runs one RIR easier (F03). An easier session done beats a hard one skipped.' }
  }
  return { kind: 'none' }
}
