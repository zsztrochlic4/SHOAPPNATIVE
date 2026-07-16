/**
 * Profile-sweep — the HARD gate for the generator (Build Backlog P0 #28 QA harness).
 * P1 is not "done" unless a program generates across every 4 goals × 3 experience levels ×
 * 2–6 days, plus the edge cases (consecutive training days, an injury flag, a commitment
 * that already covers conditioning), with ZERO safety-floor breaches and ZERO empty
 * required slots. Run `runProfileSweep()` and assert `passed`.
 *
 * Verifies, for every prescribed exercise: reps ≥ 4 on Load (S04), %1RM ≤ 88 (S04),
 * RIR ≥ the exercise Min RIR and ≥ the grid floor, Advanced lifts only for Advanced users
 * (S01), and a safe-setup cue on any spotter lift served to a solo lifter (S09); plus the
 * Weekly-Volume floor (≥4) and cap (≤20) on every major muscle.
 */

import { EXERCISE_BY_ID, prescriptionFor } from '../data'
import { BODYWEIGHT_TAGS, BASIC_GYM_TAGS, FULL_GYM_TAGS } from '../data/equipmentTags'
import { PROFESSIONAL_SIGNOFF, REQUIRED_REVIEW_SHEETS } from '../coach/signOff'
import { weeklyLoadCapKg } from '../safety/safetyRules'
import type {
  BackendExperience, BackendGoal, Commitment, EquipmentTier, FocalPoint, InjuryRegion,
  ProgressionStateDoc, ScreeningOutcome, UserDoc, Weekday,
} from '../schema'
import { generateProgram, contextForUser, type GeneratedProgram } from './generate'
import { swapExercise } from './swaps'
import { progressExercise } from './progress'
import { changeGoal } from './goalChange'

const SPREAD: Weekday[] = ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Tuesday', 'Thursday', 'Sunday']
const WEEK: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface UserOverrides {
  focal_points?: FocalPoint[]
  days_available?: Weekday[]
  session_length_min?: number
  equipment_tier?: EquipmentTier
  equipment_tags?: string[]
  trains_alone?: UserDoc['trains_alone']
  affected_regions?: InjuryRegion[]
  commitments?: Commitment[]
  outcome?: ScreeningOutcome
}

const TAGS_BY_TIER: Record<EquipmentTier, string[]> = { 'Full Gym': FULL_GYM_TAGS, 'Basic Gym': BASIC_GYM_TAGS, Bodyweight: BODYWEIGHT_TAGS }

function makeUser(goal: BackendGoal, experience: BackendExperience, days: number, o: UserOverrides = {}): UserDoc {
  const tier = o.equipment_tier ?? 'Full Gym'
  return {
    uid: 'sweep', display_name: 'Test', date_of_birth: '2000-01-01', age_verified: true, sex: 'male',
    height_cm: 180, weight_kg: 80, goal_weight_kg: 82, experience, goal, followed_structured_program: true,
    focal_points: o.focal_points ?? [],
    days_available: o.days_available ?? [...SPREAD.slice(0, days)].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b)),
    session_length_min: o.session_length_min ?? 60, equipment_tier: tier, equipment_tags: o.equipment_tags ?? TAGS_BY_TIER[tier],
    trains_alone: o.trains_alone ?? 'never', excluded_exercise_ids: [], preferred_exercise_ids: [],
    affected_regions: o.affected_regions ?? [], commitments: o.commitments ?? [],
    screening: { version: 'adult_v1', outcome: o.outcome ?? 'CLEAR', answers: {}, followups: {}, guardian_consent: false, clearance_confirmed: false, date: '', conditions: [], waiver_accepted: true },
    diet: [], tight_budget: false, motivation: null, notes: null, planned_absences: [], created_at: '2026-07-16', schema_version: 1,
  }
}

const MAJOR = ['Chest', 'Back', 'Quads', 'Hamstrings & Glutes', 'Shoulders']

function assertProgram(label: string, user: UserDoc, program: GeneratedProgram, fails: string[]) {
  const push = (ok: boolean, msg: string) => { if (!ok) fails.push(`${label}: ${msg}`) }
  push(!program.audit.some((a) => a.includes('UNFILLED')), 'has an unfilled required slot')
  for (const day of program.days) {
    for (const e of day.exercises) {
      const ex = EXERCISE_BY_ID[e.exerciseId]
      if (!ex) { fails.push(`${label}: unknown exercise ${e.exerciseId}`); continue }
      if (e.prescriptionClass === 'Load') {
        push(e.repsMin != null && e.repsMin >= 4, `${e.exerciseId} reps<4 (S04)`)
        push(e.pct1rmMax == null || e.pct1rmMax <= 88, `${e.exerciseId} %1RM>88 (S04)`)
      }
      push(e.rirMin >= ex.minRir, `${e.exerciseId} rir<minRIR`)
      const grid = prescriptionFor(user.goal, e.prescriptionClass)
      if (grid?.rirMin != null) push(e.rirMin >= grid.rirMin, `${e.exerciseId} rir<gridRir`)
      if (ex.skillLevel === 'Advanced') push(user.experience === 'Advanced', `${e.exerciseId} advanced lift to non-advanced (S01)`)
      const solo = user.trains_alone === 'always' || user.trains_alone === 'usually'
      if (solo && ex.spotterRecommended) push(e.appliedRules.includes('S09_CUE'), `${e.exerciseId} solo spotter without cue (S09)`)
    }
  }
  for (const m of MAJOR) {
    push((program.weeklySetsByMuscle[m] ?? 0) >= 4, `${m} below volume floor (4)`)
    push((program.weeklySetsByMuscle[m] ?? 0) <= 20, `${m} above volume cap (20)`)
  }
}

const GOAL_CLASS_FLOOR = (goal: BackendGoal, cls: string, exMinRir: number) => {
  const g = prescriptionFor(goal, cls)
  return Math.max(exMinRir, g?.rirMin ?? exMinRir)
}

/** Re-clamp checks shared by swaps, progression and goal change. */
function assertClamp(label: string, exId: string, goal: BackendGoal, rx: { repsMin: number | null; pct1rmMax: number | null; rirMin: number; prescriptionClass: string }, fails: string[]) {
  const ex = EXERCISE_BY_ID[exId]
  if (!ex) { fails.push(`${label}: unknown exercise ${exId}`); return }
  if (rx.prescriptionClass === 'Load') {
    if (!(rx.repsMin != null && rx.repsMin >= 4)) fails.push(`${label}: ${exId} reps<4 after re-clamp (S04)`)
    if (!(rx.pct1rmMax == null || rx.pct1rmMax <= 88)) fails.push(`${label}: ${exId} %1RM>88 after re-clamp (S04)`)
  }
  if (rx.rirMin < ex.minRir) fails.push(`${label}: ${exId} rir<minRIR after re-clamp`)
  if (rx.rirMin < GOAL_CLASS_FLOOR(goal, rx.prescriptionClass, ex.minRir)) fails.push(`${label}: ${exId} rir<gridFloor after re-clamp`)
}

/** Runtime paths — swaps, progression, goal change — all re-clamp through the safety rules. */
function assertRuntime(user: UserDoc, program: GeneratedProgram, fails: string[]) {
  const ctx = contextForUser(user)
  for (const day of program.days) {
    for (const e of day.exercises) {
      const ex = EXERCISE_BY_ID[e.exerciseId]
      if (!ex) continue

      // SW01 dislike swap → a different, safety-clamped exercise (when one exists).
      const s = swapExercise(e.exerciseId, 'dislike', ctx)
      if (s) {
        if (s.toId === e.exerciseId) fails.push(`swap/${e.exerciseId}: dislike swap returned the same exercise`)
        assertClamp('swap-dislike', s.toId, user.goal, s.prescribed, fails)
      }

      // Progression: a top-of-range session progresses within the S07 cap; a missed session
      // reduces and never below the floor; a fatigued session never progresses.
      const grid = prescriptionFor(user.goal, ex.prescriptionClass)
      if (grid && ex.loadable && grid.repsMax != null) {
        const state: ProgressionStateDoc = { uid: user.uid, exercise_id: ex.id, current_load_kg: 50, current_rep_target: grid.repsMin ?? 5, last_progressed_at: null, sessions_at_current: 1, stall_count: 0, deload_count: 0 }
        const top = progressExercise({ ex, grid, state, sets: [{ reps_done: grid.repsMax, rir_reported: grid.rirMin ?? ex.minRir }, { reps_done: grid.repsMax, rir_reported: grid.rirMin ?? ex.minRir }], requiredSessionsToProgress: 2 })
        if (top.rule === 'PR01') {
          const inc = top.nextState.current_load_kg - 50
          const cap = weeklyLoadCapKg(50, ex.bodyRegion)
          if (inc > cap + 1e-6) fails.push(`progress/${ex.id}: load jump ${inc}kg exceeds S07 cap ${cap}kg`)
          if ((grid.repsMin ?? 0) < 4) fails.push(`progress/${ex.id}: reps reset below 4 (S04)`) // grid guarantees, defensive
        }
        const missed = progressExercise({ ex, grid, state, sets: [{ reps_done: (grid.repsMin ?? 5) - 1, rir_reported: 0 }, { reps_done: (grid.repsMin ?? 5) - 1, rir_reported: 0 }] })
        if (!['PR04', 'PR05'].includes(missed.rule)) fails.push(`progress/${ex.id}: missed session did not reduce (got ${missed.rule})`)
        if (missed.nextState.current_load_kg < 0) fails.push(`progress/${ex.id}: reduced below zero`)
        const fatigued = progressExercise({ ex, grid, state, sets: [{ reps_done: grid.repsMax, rir_reported: 0 }], fatigue: { rpe10OrFailureSets: 3 } })
        if (fatigued.rule !== 'PR06' || fatigued.nextState.current_load_kg !== state.current_load_kg) fails.push(`progress/${ex.id}: fatigued session still progressed`)
      }
    }
  }

  // Goal change → a new, fully safety-clamped program for the new goal; transition week only raises RIR.
  const others: BackendGoal[] = (['Hypertrophy', 'Fat Loss', 'Strength', 'General Fitness'] as BackendGoal[]).filter((g) => g !== user.goal)
  const gc = changeGoal(user, others[0])
  if (!gc.ok) fails.push(`goalchange: failed (${gc.reason})`)
  else {
    assertProgram(`goalchange→${gc.newGoal}`, { ...user, goal: gc.newGoal }, gc.program, fails)
    for (let i = 0; i < gc.program.days.length; i++) {
      for (let j = 0; j < gc.program.days[i].exercises.length; j++) {
        if (gc.transitionProgram.days[i].exercises[j].rirMin < gc.program.days[i].exercises[j].rirMin) fails.push('goalchange: transition week lowered RIR')
      }
    }
  }
}

export interface SweepResult { passed: boolean; count: number; failures: string[] }

export function runProfileSweep(): SweepResult {
  const failures: string[] = []
  let count = 0
  // The platform sign-off gate is a deployment gate, not per-program safety — sign off for
  // the test only, and restore it so the sweep never enables the coach as a side effect.
  const prevSigned = PROFESSIONAL_SIGNOFF.signed
  const prevSheets = PROFESSIONAL_SIGNOFF.sheetsReviewed
  PROFESSIONAL_SIGNOFF.signed = true
  PROFESSIONAL_SIGNOFF.sheetsReviewed = [...REQUIRED_REVIEW_SHEETS]
  try {
    const goals: BackendGoal[] = ['Hypertrophy', 'Fat Loss', 'Strength', 'General Fitness']
    const exps: BackendExperience[] = ['Beginner', 'Intermediate', 'Advanced']
    for (const goal of goals) for (const exp of exps) for (let d = 2; d <= 6; d++) {
      const user = makeUser(goal, exp, d)
      const r = generateProgram(user); count++
      if (!r.ok) { failures.push(`${goal}/${exp}/${d}d: generation failed (${r.reason})`); continue }
      assertProgram(`${goal}/${exp}/${d}d`, user, r.program, failures)
    }

    // Runtime paths (swaps, progression, goal change) for a representative profile per goal.
    for (const goal of goals) {
      const user = makeUser(goal, 'Intermediate', 4)
      const r = generateProgram(user); count++
      if (r.ok) assertRuntime(user, r.program, failures)
    }
    // Pain swap must avoid the aggravated region.
    {
      const user = makeUser('Hypertrophy', 'Intermediate', 4, { affected_regions: ['knee'], outcome: 'MODIFY_AND_CONTINUE' })
      const r = generateProgram(user); count++
      if (r.ok) {
        const ctx = contextForUser(user)
        for (const e of r.program.days.flatMap((d) => d.exercises)) {
          const ex = EXERCISE_BY_ID[e.exerciseId]
          if (!ex || !ex.stressRegions.includes('knee')) continue
          const s = swapExercise(e.exerciseId, 'pain', ctx)
          if (s && (EXERCISE_BY_ID[s.toId]?.stressRegions.includes('knee'))) failures.push(`pain-swap/${e.exerciseId}: swapped into a knee-loading exercise`)
        }
      }
    }

    // Edge: consecutive training days.
    {
      const user = makeUser('Hypertrophy', 'Intermediate', 4, { days_available: ['Monday', 'Tuesday', 'Thursday', 'Friday'] })
      const r = generateProgram(user); count++
      if (!r.ok) failures.push(`edge/consecutive: failed (${r.reason})`)
      else { assertProgram('edge/consecutive', user, r.program, failures); if (new Set(r.program.placements.map((p) => p.weekday)).size !== 4) failures.push('edge/consecutive: did not place 4 distinct days') }
    }
    // Edge: injury flag (knee) — no excluded id may be served.
    {
      const user = makeUser('Hypertrophy', 'Intermediate', 4, { affected_regions: ['knee'], outcome: 'MODIFY_AND_CONTINUE' })
      const r = generateProgram(user); count++
      if (!r.ok) failures.push(`edge/injury: failed (${r.reason})`)
      else {
        assertProgram('edge/injury', user, r.program, failures)
        const served = new Set(r.program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))
        for (const id of ['QD13', 'FB03', 'FB08', 'FB10', 'HG06']) if (served.has(id)) failures.push(`edge/injury: served knee-excluded ${id}`)
      }
    }
    // Edge: a commitment that already covers conditioning (running).
    {
      const base = generateProgram(makeUser('Fat Loss', 'Intermediate', 4))
      const user = makeUser('Fat Loss', 'Intermediate', 4, { commitments: [{ day: 'Tuesday', commitment_type: 'running', intensity: 'hard' }] })
      const r = generateProgram(user); count++
      if (!r.ok || !base.ok) failures.push('edge/commitment: failed')
      else {
        assertProgram('edge/commitment', user, r.program, failures)
        if (r.program.volumeTargets.Quads.min > base.program.volumeTargets.Quads.min) failures.push('edge/commitment: quads not cut for a lower-body commitment')
      }
    }
  } finally {
    PROFESSIONAL_SIGNOFF.signed = prevSigned
    PROFESSIONAL_SIGNOFF.sheetsReviewed = prevSheets
  }
  return { passed: failures.length === 0, count, failures }
}
