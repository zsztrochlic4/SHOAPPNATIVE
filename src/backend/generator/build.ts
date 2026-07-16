/**
 * Generator Flow steps 6–7 — fill each day's Session Template slots and prescribe them.
 * Sources: sheets "Session Templates", "Exercise Database", "Prescription Logic",
 * "Injury Modifications", "Safety Rules".
 *
 * Selection per slot: hard-filter by equipment tier + tags, skill and exclusions, then
 * rank by injury-safety, Primary Goal Fit, type preference and focal points (deterministic
 * tiebreak). Required slots must fill — if injury exclusions empty a slot, walk the
 * Substitutions list to the first compatible, non-excluded option (Injury-Mod rule 4).
 * Every prescription is clamped by the Safety Rules engine.
 */

import { ACTIVE_EXERCISES, EXERCISE_BY_ID, toSafetyMeta } from '../data'
import { prescriptionFor } from '../data'
import { INJURY_MODIFICATIONS } from '../data/injuryModifications'
import type { Exercise, SessionSlot } from '../data/types'
import { clampPrescription, type Prescription, type UserSafetyContext } from '../safety/safetyRules'
import type { BackendGoal, FocalPoint, InjuryRegion } from '../schema'

const TIER_RANK: Record<string, number> = { Bodyweight: 0, 'Basic Gym': 1, 'Full Gym': 2 }
const SKILL_RANK: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 }

export interface BuildContext {
  goal: BackendGoal
  focalPoints: FocalPoint[]
  equipmentTier: string
  equipmentTags: string[]
  experience: string
  excludedIds: Set<string>       // user dislikes + pain
  affectedRegions: InjuryRegion[]
  safety: UserSafetyContext
}

export interface BuiltExercise {
  slotId: string
  slotName: string
  order: number
  required: boolean
  exerciseId: string
  name: string
  muscleGroup: string
  prescriptionClass: string
  sets: number
  repsMin: number | null
  repsMax: number | null
  durationSecMax: number | null
  rirMin: number
  restSecMin: number | null
  pct1rmMax: number | null
  appliedRules: string[]
}

/* ----------------------------- filters ----------------------------- */
function tierOk(ex: Exercise, tier: string) { return (TIER_RANK[ex.equipmentTier] ?? 9) <= (TIER_RANK[tier] ?? 0) }
function tagsOk(ex: Exercise, tags: string[]) {
  return ex.requiredEquipmentTags.every((t) => t.split('/').some((x) => tags.includes(x.trim())))
}
function skillOk(ex: Exercise, exp: string) { return (SKILL_RANK[ex.skillLevel] ?? 9) <= (SKILL_RANK[exp] ?? 0) }

interface ParsedSlot {
  muscles: string[] | null            // null = Any
  patterns: string[] | null           // null = Any
  allowTypes: ('Compound' | 'Isolation')[]
  preferType: 'Compound' | 'Isolation' | null
  classConstraint: string[] | null    // e.g. ['Interval','Power']
}

function parseSlot(slot: SessionSlot, focal: FocalPoint[]): ParsedSlot {
  // muscle filter
  let muscles: string[] | null = []
  for (const tok of slot.muscleGroupFilter.split('|').map((s) => s.trim())) {
    if (tok === 'Any') { muscles = null; break }
    if (tok === 'FOCAL_1') { if (focal[0]) muscles!.push(focal[0]) }
    else if (tok === 'FOCAL_2') { if (focal[1]) muscles!.push(focal[1]); else if (focal[0]) muscles!.push(focal[0]) }
    else if (tok.startsWith('Full Body')) muscles!.push('Full Body & Conditioning')
    else muscles!.push(tok)
  }
  if (muscles && muscles.length === 0) muscles = null

  // pattern filter (strip trailing prose after a comma)
  const patRaw = slot.movementPatternFilter.split(',')[0].trim()
  const patterns = patRaw === '' || patRaw === 'Any'
    ? null
    : patRaw.split('|').map((s) => s.trim()).filter(Boolean)

  // type filter
  const tf = slot.typeFilter
  let allowTypes: ('Compound' | 'Isolation')[] = ['Compound', 'Isolation']
  let preferType: 'Compound' | 'Isolation' | null = null
  if (tf.startsWith('Compound>Isolation')) { allowTypes = ['Compound', 'Isolation']; preferType = 'Compound' }
  else if (tf.startsWith('Isolation>Compound')) { allowTypes = ['Compound', 'Isolation']; preferType = 'Isolation' }
  else if (tf.startsWith('Compound')) allowTypes = ['Compound']
  else if (tf.startsWith('Isolation')) allowTypes = ['Isolation']

  // prescription-class constraint (Cond slots)
  let classConstraint: string[] | null = null
  const cc = `${slot.movementPatternFilter} ${slot.typeFilter}`
  if (/Prescription Class\s*=\s*Interval or Power/i.test(cc)) classConstraint = ['Interval', 'Power']
  else if (/Prescription Class\s*=\s*Interval/i.test(cc)) classConstraint = ['Interval']

  return { muscles, patterns, allowTypes, preferType, classConstraint }
}

function matches(ex: Exercise, p: ParsedSlot): boolean {
  if (p.muscles && !p.muscles.includes(ex.muscleGroup)) return false
  if (p.patterns && !p.patterns.includes(ex.movementPattern)) return false
  if (!p.allowTypes.includes(ex.type as 'Compound' | 'Isolation')) return false
  if (p.classConstraint && !p.classConstraint.includes(ex.prescriptionClass)) return false
  return true
}

/* --------------------------- ranking ------------------------------- */
const GOAL_NAME: Record<BackendGoal, string> = { Hypertrophy: 'Hypertrophy', 'Fat Loss': 'Fat Loss', Strength: 'Strength', 'General Fitness': 'General Fitness' }

function score(ex: Exercise, p: ParsedSlot, ctx: BuildContext, injuryRegions: string[]): number {
  let s = 0
  // Injury: prefer supported / low-impact and penalise exercises loading a flagged region.
  if (injuryRegions.length) {
    if (ex.stressRegions.some((r) => injuryRegions.includes(r))) s -= 6
    if (ex.supported) s += 3
    if (ex.impactLevel === 'Low') s += 2
  }
  // S09: strongly prefer a non-spotter option for a solo lifter (a cue is attached if one
  // is served anyway — see prescribe()).
  if (ctx.safety.trains_alone && ex.spotterRecommended) s -= 10
  if (ex.primaryGoalFit === GOAL_NAME[ctx.goal]) s += 5
  if (p.preferType && ex.type === p.preferType) s += 4
  if (ctx.focalPoints.includes(ex.muscleGroup as FocalPoint)) s += 3
  s += Math.min(ex.substitutionCount, 10) * 0.1 // stable, well-covered lifts break ties
  return s
}

/** Hard-eligible candidates for a slot, excluding the given ids. */
function candidates(p: ParsedSlot, ctx: BuildContext, exclude: Set<string>): Exercise[] {
  return ACTIVE_EXERCISES.filter((ex) =>
    !exclude.has(ex.id) && tierOk(ex, ctx.equipmentTier) && tagsOk(ex, ctx.equipmentTags) &&
    skillOk(ex, ctx.experience) && matches(ex, p),
  )
}

/** Region tokens the injury rows load (matches_stress_region) for the user's regions. */
export function injuryStressRegions(regions: InjuryRegion[]): string[] {
  return INJURY_MODIFICATIONS.filter((r) => regions.includes(r.region as InjuryRegion)).map((r) => r.matchesStressRegion)
}

/** exclude_ids from every flagged region (Injury-Mod rule 2). */
export function injuryExcludeIds(regions: InjuryRegion[]): Set<string> {
  const s = new Set<string>()
  for (const r of INJURY_MODIFICATIONS) if (regions.includes(r.region as InjuryRegion)) r.excludeIds.forEach((id) => s.add(id))
  return s
}

/**
 * Pick the exercise for one slot. Returns null only if nothing on the planet fits (an
 * optional slot then drops; a required slot failing is a coverage bug the sweep catches).
 */
export function pickForSlot(
  slot: SessionSlot,
  ctx: BuildContext,
  usedInDay: Set<string>,
  avoid?: Set<string>,
): { ex: Exercise; viaSub: boolean } | null {
  const p = parseSlot(slot, ctx.focalPoints)
  const injuryRegions = injuryStressRegions(ctx.affectedRegions)
  const injExcl = injuryExcludeIds(ctx.affectedRegions)
  const fullExclude = new Set<string>([...ctx.excludedIds, ...injExcl, ...usedInDay])

  let pool = candidates(p, ctx, fullExclude)
  // CS04 variety: on a repeated day type, prefer exercises not already used for that day
  // type this week — but only if doing so still leaves a candidate (required slots fill).
  if (avoid && avoid.size) {
    const fresh = pool.filter((ex) => !avoid.has(ex.id))
    if (fresh.length) pool = fresh
  }
  if (pool.length) {
    pool.sort((a, b) => score(b, p, ctx, injuryRegions) - score(a, p, ctx, injuryRegions) || a.id.localeCompare(b.id))
    return { ex: pool[0], viaSub: false }
  }

  // Injury emptied the slot → walk the best non-injury candidate's substitutions (rule 4).
  const baseExclude = new Set<string>([...ctx.excludedIds, ...usedInDay])
  const base = candidates(p, ctx, baseExclude)
  base.sort((a, b) => score(b, p, ctx, injuryRegions) - score(a, p, ctx, injuryRegions) || a.id.localeCompare(b.id))
  for (const cand of base) {
    for (const subId of cand.substitutionIds) {
      const sub = EXERCISE_BY_ID[subId]
      if (sub && sub.active && !fullExclude.has(sub.id) && tierOk(sub, ctx.equipmentTier) &&
          tagsOk(sub, ctx.equipmentTags) && skillOk(sub, ctx.experience) && matches(sub, p)) {
        return { ex: sub, viaSub: true }
      }
    }
  }
  return null
}

/* --------------------------- prescribe ----------------------------- */
export type PrescribedFields = Omit<BuiltExercise, 'slotId' | 'slotName' | 'order' | 'required'>

export function prescribe(ex: Exercise, ctx: BuildContext): PrescribedFields {
  const row = prescriptionFor(ctx.goal, ex.prescriptionClass)
  const base: Prescription = {
    sets: row?.setsMin ?? 3,
    reps_min: row?.repsMin ?? undefined,
    reps_max: row?.repsMax ?? undefined,
    rir_min: row?.rirMin ?? ex.minRir,
    pct_1rm_max: row?.pct1rmMax ?? undefined,
    rest_sec_min: row?.restSecMin ?? undefined,
    duration_sec_max: row?.durationSecMax ?? undefined,
  }
  const { rx, applied } = clampPrescription(base, toSafetyMeta(ex), ctx.safety)

  // S09: a spotter-recommended lift served to a solo lifter carries the safe-setup cue.
  if (ctx.safety.trains_alone && ex.spotterRecommended) applied.push('S09_CUE')

  // Injury rir bump: any exercise loading a flagged region trains a notch easier.
  const injuryRegions = injuryStressRegions(ctx.affectedRegions)
  if (ex.stressRegions.some((r) => injuryRegions.includes(r))) {
    const bump = INJURY_MODIFICATIONS.find((m) => ctx.affectedRegions.includes(m.region as InjuryRegion) && m.matchesStressRegion && ex.stressRegions.includes(m.matchesStressRegion))?.rirBump ?? 1
    rx.rir_min += bump
    applied.push('INJURY_RIR')
  }

  return {
    exerciseId: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    prescriptionClass: ex.prescriptionClass,
    sets: rx.sets,
    repsMin: rx.reps_min ?? null,
    repsMax: rx.reps_max ?? null,
    durationSecMax: rx.duration_sec_max ?? null,
    rirMin: rx.rir_min,
    restSecMin: rx.rest_sec_min ?? null,
    pct1rmMax: rx.pct_1rm_max ?? null,
    appliedRules: applied,
  }
}
