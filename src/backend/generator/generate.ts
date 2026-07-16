/**
 * Generator Flow steps 1–8 — build an initial program end-to-end.
 * 1 Screen + gate → 2 collect → 3 pick split → 4 schedule → 5 budget volume →
 * 6 build each day → 7 prescribe → 8 light starting loads.
 * Runtime steps 9–14 (progression, swaps, calendar adaptation, deload, re-screen, goal
 * change) are separate.
 */

import { SESSION_TEMPLATES } from '../data/sessionTemplates'
import { ACTIVE_EXERCISES } from '../data'
import { prescriptionFor } from '../data'
import { canGenerate } from '../mapping/onboardingContract'
import { ageFromDob } from '../safety/ageRouting'
import type { UserDoc } from '../schema'
import { selectSplit } from './select'
import { buildSchedule, type Placement } from './schedule'
import { volumeTargets, MAJOR_MUSCLES, ALL_MUSCLES, FLOOR, CAP, type VolumeTargets } from './volume'
import {
  pickForSlot, prescribe, injuryExcludeIds, type BuildContext, type BuiltExercise,
} from './build'

export interface BuiltDay { dayType: string; weekday: string; exercises: BuiltExercise[] }

export interface GeneratedProgram {
  uid: string
  splitId: string
  splitName: string
  dayStructure: string[]
  placements: Placement[]
  restDays: string[]
  volumeTargets: VolumeTargets
  weeklySetsByMuscle: Record<string, number>
  days: BuiltDay[]
  /** Honest, user-facing notes about deliberate coverage tradeoffs (e.g. no direct calves). */
  coverageNotes: string[]
  startingLoadNote: string
  /** Framing: everything here is a recommendation, not a medical prescription. */
  recommendationNote: string
  audit: string[]
}

export type GenResult =
  | { ok: false; reason: string }
  | { ok: true; program: GeneratedProgram }

function maxExercises(sessionMin: number): number {
  if (sessionMin <= 30) return 4
  if (sessionMin <= 45) return 5
  if (sessionMin <= 60) return 6
  return 7
}

/**
 * Build the shared selection/prescription context from the canonical user doc. Exported so
 * the runtime paths (swaps, progression) prescribe against exactly the same context and
 * safety envelope as initial generation. `weeksTrained` defaults to 0 (week one, P01).
 */
export function contextForUser(user: UserDoc, weeksTrained = 0): BuildContext {
  const age = ageFromDob(user.date_of_birth)
  return {
    goal: user.goal,
    focalPoints: user.focal_points,
    equipmentTier: user.equipment_tier,
    equipmentTags: user.equipment_tags,
    experience: user.experience,
    excludedIds: new Set(user.excluded_exercise_ids),
    affectedRegions: user.affected_regions,
    safety: {
      experience: user.experience,
      trains_alone: user.trains_alone === 'always' || user.trains_alone === 'usually',
      weeks_trained: weeksTrained,
      young_person: age !== null && age >= 16 && age < 18,
    },
  }
}

export interface GenerateOptions {
  /** Override the split's day_structure (custom splits CS01, exam-maintenance FB2). */
  dayStructure?: string[]
}

export function generateProgram(user: UserDoc, opts: GenerateOptions = {}): GenResult {
  // Step 1 — screening + age + platform sign-off gate.
  const gate = canGenerate(user)
  if (!gate.ok) return { ok: false, reason: gate.reason ?? 'blocked' }

  // Step 2 — collect inputs from the canonical doc.
  const ctx = contextForUser(user)
  const audit: string[] = []

  // Step 3 — pick split (or use an explicit day_structure). Step 4 — schedule. SCH06
  // compression: if the rest floor leaves fewer usable lifting days than the split needs,
  // re-select for the reduced count.
  let sel = opts.dayStructure
    ? { split: { splitId: 'custom', name: 'Custom', daysMin: opts.dayStructure.length, daysMax: opts.dayStructure.length, dayStructure: opts.dayStructure, bestForGoals: ['All'], experience: ['All'], why: 'Custom structure' }, dayStructure: [...opts.dayStructure], reason: 'custom day_structure' }
    : selectSplit(user.days_available.length, user.experience, user.goal)
  let sched = buildSchedule(sel.dayStructure, user.days_available, user.commitments)
  if (!opts.dayStructure && sched.placements.length < sel.dayStructure.length && sched.placements.length >= 1) {
    audit.push(`SCH06 compression: usable days ${sched.placements.length} < split needs ${sel.dayStructure.length}; re-selecting`)
    sel = selectSplit(sched.placements.length, user.experience, user.goal)
    sched = buildSchedule(sel.dayStructure, user.days_available, user.commitments)
  }
  audit.push(`Split ${sel.split.splitId} (${sel.reason})`, ...sched.audit)

  // Step 5 — volume budget.
  const targets = volumeTargets(user.goal, user.experience, user.focal_points, user.commitments)

  // Step 6/7 — build + prescribe each scheduled day. CS04: repeated day types draw
  // different exercises, so week-used picks per day type are avoided on later occurrences.
  const budget = maxExercises(user.session_length_min)
  const weekUsedByDayType = new Map<string, Set<string>>()
  const days: BuiltDay[] = sched.placements.map((pl) => {
    const slots = SESSION_TEMPLATES.filter((s) => s.dayType === pl.dayType).sort((a, b) => a.order - b.order)
    const avoid = weekUsedByDayType.get(pl.dayType) ?? new Set<string>()
    const used = new Set<string>()
    const exercises: BuiltExercise[] = []
    for (const slot of slots) {
      const isOptional = !slot.required
      if (isOptional && exercises.length >= budget) continue
      const pick = pickForSlot(slot, ctx, used, avoid)
      if (!pick) { if (slot.required) audit.push(`UNFILLED required slot ${slot.slotId} on ${pl.dayType}`); continue }
      used.add(pick.ex.id)
      exercises.push({ slotId: slot.slotId, slotName: slot.slotName, order: slot.order, required: slot.required, ...prescribe(pick.ex, ctx) })
    }
    for (const id of used) avoid.add(id)
    weekUsedByDayType.set(pl.dayType, avoid)
    return { dayType: pl.dayType, weekday: pl.weekday, exercises }
  })

  // ---- Reconciliation (Weekly Volume rules 1, 2, 3, 7) ----
  const setsFor = (muscle: string) => days.reduce((n, d) => n + d.exercises.filter((e) => e.muscleGroup === muscle).reduce((a, e) => a + e.sets, 0), 0)
  const excl = new Set<string>([...ctx.excludedIds, ...injuryExcludeIds(ctx.affectedRegions)])
  const SKILL: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 }
  const eligible = (ex: (typeof ACTIVE_EXERCISES)[number], usedIds: Set<string>) =>
    !excl.has(ex.id) && !usedIds.has(ex.id) &&
    (ex.equipmentTier === 'Bodyweight' || (ex.equipmentTier === 'Basic Gym' && ctx.equipmentTier !== 'Bodyweight') || ctx.equipmentTier === 'Full Gym') &&
    (SKILL[ex.skillLevel] ?? 9) <= (SKILL[ctx.experience] ?? 0) && // S01: never add an Advanced lift for a non-Advanced user
    ex.requiredEquipmentTags.every((t) => t.split('/').some((x) => ctx.equipmentTags.includes(x.trim())))
  const daySizeCap = budget + 2 // reconciliation may push a day slightly past its base budget

  // Rule 2 — add one slot (isolation preferred) for an under-target muscle, on a day that
  // already trains it, respecting the day-size cap.
  const addSlot = (muscle: string): boolean => {
    const trains = days.filter((d) => d.exercises.some((e) => e.muscleGroup === muscle) && d.exercises.length < daySizeCap)
    const day = (trains.length ? trains : days.filter((d) => d.exercises.length < daySizeCap)).sort((a, b) => a.exercises.length - b.exercises.length)[0]
    if (!day) return false
    const usedIds = new Set(day.exercises.map((e) => e.exerciseId))
    const cand = ACTIVE_EXERCISES.find((ex) => ex.muscleGroup === muscle && ex.type === 'Isolation' && eligible(ex, usedIds))
      ?? ACTIVE_EXERCISES.find((ex) => ex.muscleGroup === muscle && eligible(ex, usedIds))
    if (!cand) return false
    day.exercises.push({ slotId: `${muscle}-added`, slotName: `${muscle} (volume)`, order: 90, required: true, ...prescribe(cand, ctx) })
    return true
  }

  const raiseToward = (muscle: string, target: number, guardMax: number) => {
    let guard = 0
    while (setsFor(muscle) < target && guard++ < guardMax) {
      const raisable = days.flatMap((d) => d.exercises).find((e) => e.muscleGroup === muscle && e.sets < (prescriptionFor(user.goal, e.prescriptionClass)?.setsMax ?? e.sets))
      if (raisable) { raisable.sets += 1; continue }
      if (!addSlot(muscle)) break
    }
  }

  // Pass 1 (rule 7 FLOOR, first) — guarantee every major muscle >=4 direct sets before any
  // muscle chases its full target, so a tiny split can never starve one below the floor.
  for (const muscle of MAJOR_MUSCLES) raiseToward(muscle, FLOOR, 12)
  // Pass 2 (rules 1 + 2 — fill toward min target) — focal muscles first (raised targets),
  // then majors, then arms/calves/core, within the remaining day capacity.
  const order = [...user.focal_points, ...MAJOR_MUSCLES, ...ALL_MUSCLES]
  for (const muscle of order) raiseToward(muscle, Math.max(FLOOR, targets[muscle]?.min ?? FLOOR), 40)

  // Rule 3 — trim overshoot toward the muscle's target max (bounded by the hard cap 20):
  // reduce later slots to sets_min, then drop added/optional slots, then convert one direct
  // slot to the week's most under-target muscle.
  // The muscle most in need of the converted set: anything below its min first, else the
  // one with the most headroom below its max.
  const conversionTarget = (exclude: string): string | null => {
    let best: string | null = null, score = 0
    for (const m of ALL_MUSCLES) {
      if (m === exclude || !targets[m]) continue
      const underMin = targets[m].min - setsFor(m)
      const underMax = targets[m].max - setsFor(m)
      const s = underMin > 0 ? 1000 + underMin : underMax
      if (s > score) { score = s; best = m }
    }
    return best
  }
  for (const muscle of ALL_MUSCLES) {
    const overMax = Math.min(CAP, targets[muscle]?.max ?? CAP)
    let guard = 0
    while (setsFor(muscle) > overMax && guard++ < 60) {
      const flat = days.flatMap((d) => d.exercises.map((e) => ({ d, e })))
      // (a) reduce a slot's sets toward sets_min
      const reduce = [...flat].reverse().find(({ e }) => e.muscleGroup === muscle && e.sets > (prescriptionFor(user.goal, e.prescriptionClass)?.setsMin ?? 1))
      if (reduce) { reduce.e.sets -= 1; continue }
      // (b) drop an added/optional slot for this muscle
      const dropIdx = [...flat].reverse().find(({ e }) => e.muscleGroup === muscle && (!e.required || e.slotId.includes('added')))
      if (dropIdx) { dropIdx.d.exercises = dropIdx.d.exercises.filter((x) => x !== dropIdx.e); continue }
      // (c) convert one direct slot to the most under-target muscle
      const target = conversionTarget(muscle)
      const slot = [...flat].reverse().find(({ e }) => e.muscleGroup === muscle)
      if (target && slot) {
        const usedIds = new Set(slot.d.exercises.map((e) => e.exerciseId))
        const cand = ACTIVE_EXERCISES.find((ex) => ex.muscleGroup === target && eligible(ex, usedIds))
        if (cand) { Object.assign(slot.e, { slotId: `${target}-converted`, slotName: `${target} (converted)`, ...prescribe(cand, ctx) }); continue }
      }
      break
    }
  }

  const weeklySetsByMuscle: Record<string, number> = {}
  for (const m of ALL_MUSCLES) weeklySetsByMuscle[m] = setsFor(m)

  // Honest coverage notes — surface deliberate tradeoffs instead of omitting silently. On
  // a short split some low-return muscles get no direct slot; say so and how to fix it.
  const coverageNotes: string[] = []
  if ((weeklySetsByMuscle.Calves ?? 0) === 0) {
    coverageNotes.push('On this split we prioritise your highest-return movements, so there’s no direct calf slot — your calves still get indirect work from squats and lunges. Add a third training day if you want direct calf work.')
  }

  return {
    ok: true,
    program: {
      uid: user.uid,
      splitId: sel.split.splitId,
      splitName: sel.split.name,
      dayStructure: sel.dayStructure,
      placements: sched.placements,
      restDays: sched.restDays,
      volumeTargets: targets,
      weeklySetsByMuscle,
      days,
      coverageNotes,
      startingLoadNote: 'Week one starts light (around RIR 4–5); the recommended working weight is found over the first two sessions (Generator Flow step 8 / Safety P01).',
      recommendationNote: 'These are recommended sets, reps and weights based on your inputs and logged performance — guidance to adjust to how you feel on the day, not a medical prescription.',
      audit,
    },
  }
}
