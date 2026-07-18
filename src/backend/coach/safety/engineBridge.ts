/**
 * Engine bridge — the ONLY place the coach-safety layer talks to the reviewed workout engine.
 *
 * Constraint: the coach never re-implements injury / age / screening / exercise-safety logic.
 * Where it needs those decisions it CALLS the existing, signed-off engine exports here, so the
 * engine stays the single source of truth (spec §6, §14, §16; "coach proposes, engine performs").
 *
 * This module only READS from the engine. It does not modify, wrap-with-new-logic, or shadow it.
 */

import type { CoachContext } from './types'
import type { InjuryRegion } from '../../schema'
import { routeByAge, ageFromDob, type AgeBand } from '../../safety/ageRouting'
import { injuryExcludeIds } from '../../generator/build'
import { EXERCISE_BY_ID } from '../../data'

const INJURY_REGION_SET: InjuryRegion[] = ['lower_back', 'knee', 'shoulder', 'wrist', 'hip', 'ankle']
function asRegions(regions: string[]): InjuryRegion[] {
  return regions.filter((r): r is InjuryRegion => (INJURY_REGION_SET as string[]).includes(r))
}

export interface AgeEligibility {
  band: AgeBand
  ageYears: number | null
  /** true → the 18+ gate blocks coaching for this stored profile (spec §20). */
  blocked: boolean
}

/** The engine's age routing on the stored DOB (spec §14/§20 — age verified, never defaulted). */
export function ageEligibility(ctx: CoachContext): AgeEligibility {
  const route = routeByAge(ctx.dateOfBirth)
  return { band: route.band, ageYears: route.ageYears, blocked: route.blocked }
}

export { ageFromDob }

/**
 * The set of exercise ids the engine excludes for this user's injuries — the authoritative
 * injury exclusion list (Injury Modifications). The coach must never re-add these (spec §6).
 * Combines the engine's region rules with any ids the caller already stored.
 */
export function engineExcludedExerciseIds(ctx: CoachContext): Set<string> {
  const fromEngine = injuryExcludeIds(asRegions(ctx.affectedRegions))
  for (const id of ctx.engineExcludedExerciseIds) fromEngine.add(id)
  return fromEngine
}

/**
 * Does an outgoing coach reply name an exercise the engine excluded for this user? Used by the
 * post-response validator to enforce "the coach never recommends what the engine would prohibit".
 */
export function replyRecommendsProhibited(replyText: string, ctx: CoachContext): boolean {
  const excluded = engineExcludedExerciseIds(ctx)
  if (excluded.size === 0) return false
  const lower = ` ${replyText.toLowerCase()} `
  for (const id of excluded) {
    const name = EXERCISE_BY_ID[id]?.name
    if (name && lower.includes(name.toLowerCase())) return true
  }
  return false
}
