/**
 * Program activation — the runtime seam between onboarding and the app UI.
 *
 * Given the canonical `UserDoc`, this runs the HARD generation gate (`canGenerate`,
 * which combines Age Routing, the screening outcome, the waiver AND the accredited
 * professional sign-off) and, only when it opens, the deterministic generator. It
 * returns three things:
 *   - `status`   — whether generation is open, and if not, the machine-readable reason
 *                  (drives the "program being finalised" holding screen).
 *   - `program`  — a compact, serialisable projection for the app to render.
 *   - `programDoc` + `instances` — the canonical Firestore records (schema.ts) persisted
 *                  under `users/{uid}/…`, which the future logging path reads.
 *
 * Nothing here relaxes safety: if the gate is closed (e.g. the sign-off reviewer is still
 * blank) it returns `status.ok === false` and NO program. The generator itself already
 * clamps every prescription through the Safety Rules.
 */

import type { UserDoc, ProgramDoc, WorkoutInstanceDoc, PrescribedExercise, Weekday, DayType } from '../schema'
import { canGenerate } from '../mapping/onboardingContract'
import { generateProgram, type GeneratedProgram } from '../generator/generate'
import type { BuiltExercise } from '../generator/build'
import { EXERCISE_BY_ID } from '../data/index'

/* ------------------------------------------------------------------ */
/*  App-facing render projection (compact, plain data)                 */
/* ------------------------------------------------------------------ */

export interface StoredExercise {
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
  /** true when a HARD injury-modification raised this exercise's RIR floor (INJURY_RIR). */
  injuryAdjusted: boolean
}

export interface StoredDay {
  weekday: string
  dayType: string
  exercises: StoredExercise[]
}

export interface StoredProgram {
  programId: string
  splitId: string
  splitName: string
  dayStructure: string[]
  schedule: { weekday: string; dayType: string }[]
  restDays: string[]
  days: StoredDay[]
  weeklySetsByMuscle: Record<string, number>
  volumeTargets: Record<string, { min: number; max: number }>
  coverageNotes: string[]
  startingLoadNote: string
  recommendationNote: string
  createdAt: string
}

/** Machine-readable generation status. `reason` mirrors `canGenerate`/generator reasons. */
export interface ProgramStatus {
  ok: boolean
  reason: string | null
}

export interface ActivationResult {
  status: ProgramStatus
  program: StoredProgram | null
  programDoc: ProgramDoc | null
  instances: WorkoutInstanceDoc[]
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers                                                     */
/* ------------------------------------------------------------------ */

function toStoredExercise(e: BuiltExercise): StoredExercise {
  return {
    exerciseId: e.exerciseId,
    name: e.name,
    muscleGroup: e.muscleGroup,
    prescriptionClass: e.prescriptionClass,
    sets: e.sets,
    repsMin: e.repsMin,
    repsMax: e.repsMax,
    durationSecMax: e.durationSecMax,
    rirMin: e.rirMin,
    restSecMin: e.restSecMin,
    pct1rmMax: e.pct1rmMax,
    injuryAdjusted: e.appliedRules.includes('INJURY_RIR'),
  }
}

function toPrescribedExercise(e: BuiltExercise): PrescribedExercise {
  const ex = EXERCISE_BY_ID[e.exerciseId]
  return {
    slot_id: e.slotId,
    exercise_id: e.exerciseId,
    substituted_from: null,
    measurement_type: ex?.measurementType ?? 'weight_reps',
    sets: e.sets,
    reps_min: e.repsMin ?? undefined,
    reps_max: e.repsMax ?? undefined,
    duration_sec: e.durationSecMax ?? undefined,
    rest_sec: e.restSecMin ?? undefined,
    load_unit: ex?.loadUnit,
    rir_min: e.rirMin,
  }
}

function toStoredProgram(programId: string, createdAt: string, g: GeneratedProgram): StoredProgram {
  return {
    programId,
    splitId: g.splitId,
    splitName: g.splitName,
    dayStructure: g.dayStructure,
    schedule: g.placements.map((p) => ({ weekday: p.weekday, dayType: p.dayType })),
    restDays: g.restDays,
    days: g.days.map((d) => ({
      weekday: d.weekday,
      dayType: d.dayType,
      exercises: d.exercises.map(toStoredExercise),
    })),
    weeklySetsByMuscle: g.weeklySetsByMuscle,
    volumeTargets: g.volumeTargets,
    coverageNotes: g.coverageNotes,
    startingLoadNote: g.startingLoadNote,
    recommendationNote: g.recommendationNote,
    createdAt,
  }
}

function toProgramDoc(programId: string, createdAt: string, uid: string, g: GeneratedProgram): ProgramDoc {
  const schedule: Partial<Record<Weekday, DayType>> = {}
  for (const p of g.placements) schedule[p.weekday as Weekday] = p.dayType
  return {
    program_id: programId,
    uid,
    version: 1,
    split_id: g.splitId,
    day_structure: g.dayStructure.join('|'),
    custom: false,
    schedule,
    created_at: createdAt,
    active: true,
    superseded_by: null,
    generation_audit: [{ step: 14, rule_ids_applied: [], choices: g.audit }],
  }
}

function toInstances(programId: string, uid: string, g: GeneratedProgram): WorkoutInstanceDoc[] {
  return g.days.map((d) => ({
    instance_id: `${programId}_${d.weekday}`,
    program_id: programId,
    uid,
    scheduled_date: '', // Phase 1: undated plan template; the scheduler assigns dates at runtime.
    day_type: d.dayType,
    status: 'planned' as const,
    exercises: d.exercises.map(toPrescribedExercise),
  }))
}

/* ------------------------------------------------------------------ */
/*  The activation entry point                                         */
/* ------------------------------------------------------------------ */

const blocked = (reason: string | null): ActivationResult => ({
  status: { ok: false, reason },
  program: null,
  programDoc: null,
  instances: [],
})

/**
 * Run the gate, then (only if it opens) the generator. Deterministic. `createdAt` is
 * injectable so callers/tests can pin it; defaults to now.
 */
export function activateProgram(user: UserDoc, createdAt: string = new Date().toISOString()): ActivationResult {
  const gate = canGenerate(user)
  if (!gate.ok) return blocked(gate.reason)

  const gen = generateProgram(user)
  if (!gen.ok) return blocked(`generation_failed:${gen.reason}`)

  const programId = `${user.uid}_v1`
  return {
    status: { ok: true, reason: null },
    program: toStoredProgram(programId, createdAt, gen.program),
    programDoc: toProgramDoc(programId, createdAt, user.uid, gen.program),
    instances: toInstances(programId, user.uid, gen.program),
  }
}
