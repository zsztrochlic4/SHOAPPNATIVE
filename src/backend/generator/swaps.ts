/**
 * Exercise Swaps — Generator Flow step 10 (runtime).
 * Source: sheet "Exercise Swaps" (SW01–SW08) + "Substitutions". Every swap is resolved by
 * walking the Substitutions list in priority order and returning the FIRST entry that
 * passes the user's equipment, skill and exclusion filters — never by inventing an
 * exercise. The new exercise is re-prescribed from the grid and RE-CLAMPED by the Safety
 * Rules (via prescribe). A reported stop symptom is never a swap — that's an S06 escalation
 * (stopSymptom.ts). Deterministic.
 */

import { EXERCISE_BY_ID, substitutesFor } from '../data'
import type { Exercise } from '../data/types'
import { prescribe, injuryStressRegions, type BuildContext, type PrescribedFields } from './build'
import type { InjuryRegion } from '../schema'

export type SwapReason = 'dislike' | 'pain' | 'equipment' | 'too_hard' | 'too_easy' | 'specific' | 'variety'
const REASON_CODE: Record<SwapReason, string> = {
  dislike: 'SW01', pain: 'SW02', equipment: 'SW04', too_hard: 'SW05', too_easy: 'SW06', specific: 'SW07', variety: 'SW08',
}

const TIER_RANK: Record<string, number> = { Bodyweight: 0, 'Basic Gym': 1, 'Full Gym': 2 }
const SKILL_RANK: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 }

/** The equipment/skill/exclusion hard filters a swap target must pass. */
export function eligibleForUser(ex: Exercise, ctx: BuildContext, exclude: Set<string>): boolean {
  return ex.active && !exclude.has(ex.id) &&
    (TIER_RANK[ex.equipmentTier] ?? 9) <= (TIER_RANK[ctx.equipmentTier] ?? 0) &&
    ex.requiredEquipmentTags.every((t) => t.split('/').some((x) => ctx.equipmentTags.includes(x.trim()))) &&
    (SKILL_RANK[ex.skillLevel] ?? 9) <= (SKILL_RANK[ctx.experience] ?? 0)
}

export interface SwapResult {
  fromId: string
  toId: string
  toName: string
  reasonCode: string
  prescribed: PrescribedFields
  /** dislike/pain swaps exclude the original from future selection. */
  excludeOriginal: boolean
  note: string
}

/**
 * Resolve a swap. Walks the from-exercise's substitutions to the first eligible option;
 * pain swaps additionally skip anything loading a flagged region; too-hard swaps prefer a
 * lower/equal skill, more supported option. Returns null only if nothing compatible exists.
 */
export function swapExercise(fromId: string, reason: SwapReason, ctx: BuildContext, extraExclude: Set<string> = new Set()): SwapResult | null {
  const from = EXERCISE_BY_ID[fromId]
  if (!from) return null
  const exclude = new Set<string>([...ctx.excludedIds, ...extraExclude, fromId])
  const injuryRegions = reason === 'pain'
    ? injuryStressRegions(ctx.affectedRegions).concat(ctx.affectedRegions as InjuryRegion[])
    : injuryStressRegions(ctx.affectedRegions)

  const candidateIds = substitutesFor(fromId)
  for (const id of candidateIds) {
    const ex = EXERCISE_BY_ID[id]
    if (!ex || !eligibleForUser(ex, ctx, exclude)) continue
    // Pain (SW02): never swap into an exercise that loads the aggravated region.
    if (reason === 'pain' && ex.stressRegions.some((r) => injuryRegions.includes(r))) continue
    // Too hard (SW05): don't swap up in skill.
    if (reason === 'too_hard' && (SKILL_RANK[ex.skillLevel] ?? 0) > (SKILL_RANK[from.skillLevel] ?? 0)) continue
    // Too easy (SW06): same group at equal-or-higher skill.
    if (reason === 'too_easy' && (SKILL_RANK[ex.skillLevel] ?? 0) < (SKILL_RANK[from.skillLevel] ?? 0)) continue

    return {
      fromId, toId: ex.id, toName: ex.name, reasonCode: REASON_CODE[reason],
      prescribed: prescribe(ex, ctx), // re-worked AND re-clamped by the Safety Rules
      excludeOriginal: reason === 'dislike' || reason === 'pain',
      note: `Swapped ${from.name} → ${ex.name} (${REASON_CODE[reason]}). Re-worked into a safety-clamped recommendation for the new lift.`,
    }
  }
  return null
}

/**
 * SW07 — the user names a specific exercise. Place it only if it exists, passes their
 * equipment/skill filters, and isn't excluded; otherwise return why (the caller explains
 * and offers the closest valid option via swapExercise).
 */
export function requestSpecific(fromId: string, wantedId: string, ctx: BuildContext): SwapResult | { ok: false; reason: string } {
  const ex = EXERCISE_BY_ID[wantedId]
  if (!ex) return { ok: false, reason: 'not_in_database' }
  if (!eligibleForUser(ex, ctx, new Set(ctx.excludedIds))) return { ok: false, reason: 'fails_equipment_or_skill' }
  return {
    fromId, toId: ex.id, toName: ex.name, reasonCode: REASON_CODE.specific,
    prescribed: prescribe(ex, ctx), excludeOriginal: false,
    note: `Placed ${ex.name} on request (SW07), re-worked into a safety-clamped recommendation.`,
  }
}
