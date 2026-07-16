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
import type {
  BackendExperience, BackendGoal, Commitment, EquipmentTier, FocalPoint, InjuryRegion,
  ScreeningOutcome, UserDoc, Weekday,
} from '../schema'
import { generateProgram, type GeneratedProgram } from './generate'

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
