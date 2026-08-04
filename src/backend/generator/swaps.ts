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
import { prescribe, injuryStressRegions, injuryExcludeIds, type BuildContext, type PrescribedFields } from './build'
import { equipmentTagsSatisfied } from '../data/equipmentInventory'
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
    equipmentTagsSatisfied(ex.requiredEquipmentTags, ctx.equipmentTags) &&
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
 * Resolve swap candidates. Walks the from-exercise's substitutions in priority order and
 * collects up to `limit` eligible options; pain swaps additionally skip anything loading a
 * flagged region; too-hard swaps stay at/below skill, too-easy at/above. Each option is
 * re-prescribed AND re-clamped by the Safety Rules. Returns [] if nothing compatible exists.
 * `swapExercise` (first option) is the single-answer form used by the generator.
 */
export function swapCandidates(fromId: string, reason: SwapReason, ctx: BuildContext, extraExclude: Set<string> = new Set(), limit = 1): SwapResult[] {
  const from = EXERCISE_BY_ID[fromId]
  if (!from) return []
  // C-002 (P0): injury hard-exclusions apply to EVERY candidate for EVERY reason — never only
  // for a model-chosen `pain` label. A dislike/variety/specific swap can no longer route into a
  // lift the user's injury table hard-excludes.
  const injExcl = injuryExcludeIds(ctx.affectedRegions)
  const exclude = new Set<string>([...ctx.excludedIds, ...injExcl, ...extraExclude, fromId])
  // Stress-region avoidance: always steer away from exercises loading a flagged region; for a
  // pain swap it is a hard skip (below), for other reasons the excludeIds above are the hard gate.
  const injuryRegions = injuryStressRegions(ctx.affectedRegions).concat(ctx.affectedRegions as InjuryRegion[])

  const out: SwapResult[] = []
  for (const id of substitutesFor(fromId)) {
    if (out.length >= limit) break
    const ex = EXERCISE_BY_ID[id]
    if (!ex || !eligibleForUser(ex, ctx, exclude)) continue
    // Pain (SW02): never swap into an exercise that loads the aggravated region.
    if (reason === 'pain' && ex.stressRegions.some((r) => injuryRegions.includes(r))) continue
    // Too hard (SW05): don't swap up in skill.
    if (reason === 'too_hard' && (SKILL_RANK[ex.skillLevel] ?? 0) > (SKILL_RANK[from.skillLevel] ?? 0)) continue
    // Too easy (SW06): same group at equal-or-higher skill.
    if (reason === 'too_easy' && (SKILL_RANK[ex.skillLevel] ?? 0) < (SKILL_RANK[from.skillLevel] ?? 0)) continue

    out.push({
      fromId, toId: ex.id, toName: ex.name, reasonCode: REASON_CODE[reason],
      prescribed: prescribe(ex, ctx), // re-worked AND re-clamped by the Safety Rules
      excludeOriginal: reason === 'dislike' || reason === 'pain',
      note: `Swapped ${from.name} → ${ex.name} (${REASON_CODE[reason]}). Re-worked into a safety-clamped recommendation for the new lift.`,
    })
  }
  return out
}

/**
 * Resolve a single swap — the first eligible option. Returns null only if nothing
 * compatible exists. Thin wrapper over `swapCandidates` so the two can never diverge.
 */
export function swapExercise(fromId: string, reason: SwapReason, ctx: BuildContext, extraExclude: Set<string> = new Set()): SwapResult | null {
  return swapCandidates(fromId, reason, ctx, extraExclude, 1)[0] ?? null
}

/** Is `wantedId` an approved substitute for `fromId` (curated list OR same muscle+pattern+type)? */
export function isCompatibleSwap(fromId: string, wantedId: string): boolean {
  if (fromId === wantedId) return false
  if (substitutesFor(fromId).includes(wantedId)) return true
  const from = EXERCISE_BY_ID[fromId]
  const to = EXERCISE_BY_ID[wantedId]
  if (!from || !to) return false
  return from.muscleGroup === to.muscleGroup && from.movementPattern === to.movementPattern && from.type === to.type
}

/**
 * SW07 — the user names a specific exercise. Place it only if it exists, is a COMPATIBLE
 * substitute for the lift being replaced (C-004), passes their equipment/skill filters, is
 * not injury-hard-excluded (C-002), is not on their excluded list, and is not already in the
 * program (`avoid`, C-004). Otherwise return why (the caller explains and offers the closest
 * valid option via swapExercise).
 */
export function requestSpecific(fromId: string, wantedId: string, ctx: BuildContext, avoid: Set<string> = new Set()): SwapResult | { ok: false; reason: string } {
  const ex = EXERCISE_BY_ID[wantedId]
  if (!ex) return { ok: false, reason: 'not_in_database' }
  // C-004: the requested lift must be an approved substitute for the one it replaces, so a
  // swap can't quietly unbalance the plan by dropping in an unrelated movement.
  if (!isCompatibleSwap(fromId, wantedId)) return { ok: false, reason: 'not_compatible' }
  // C-004: never place a lift already in the program (would duplicate it).
  if (avoid.has(wantedId)) return { ok: false, reason: 'already_in_program' }
  // C-002: injury hard-exclusions apply here too, independent of any reason label.
  const injExcl = injuryExcludeIds(ctx.affectedRegions)
  if (injExcl.has(wantedId)) return { ok: false, reason: 'injury_excluded' }
  const exclude = new Set<string>([...ctx.excludedIds, ...injExcl, ...avoid])
  if (!eligibleForUser(ex, ctx, exclude)) return { ok: false, reason: 'fails_equipment_or_skill' }
  return {
    fromId, toId: ex.id, toName: ex.name, reasonCode: REASON_CODE.specific,
    prescribed: prescribe(ex, ctx), excludeOriginal: false,
    note: `Placed ${ex.name} on request (SW07), re-worked into a safety-clamped recommendation.`,
  }
}
