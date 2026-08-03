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
import type { BuiltExercise, PrescribedFields } from '../generator/build'
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

/**
 * Project a clamped `PrescribedFields` (from the generator OR a runtime swap) into the
 * app-facing `StoredExercise`. SINGLE source of the render projection so a swapped
 * exercise (coachActionResolver.ts) can never diverge from a generated one.
 */
export function storedExerciseFromPrescription(p: PrescribedFields): StoredExercise {
  return {
    exerciseId: p.exerciseId,
    name: p.name,
    muscleGroup: p.muscleGroup,
    prescriptionClass: p.prescriptionClass,
    sets: p.sets,
    repsMin: p.repsMin,
    repsMax: p.repsMax,
    durationSecMax: p.durationSecMax,
    rirMin: p.rirMin,
    restSecMin: p.restSecMin,
    pct1rmMax: p.pct1rmMax,
    injuryAdjusted: p.appliedRules.includes('INJURY_RIR'),
  }
}

/** Project a clamped `PrescribedFields` into the canonical `PrescribedExercise` (instance). */
export function prescribedExerciseFromPrescription(slotId: string, p: PrescribedFields, substitutedFrom: string | null): PrescribedExercise {
  const ex = EXERCISE_BY_ID[p.exerciseId]
  return {
    slot_id: slotId,
    exercise_id: p.exerciseId,
    substituted_from: substitutedFrom,
    measurement_type: ex?.measurementType ?? 'weight_reps',
    sets: p.sets,
    reps_min: p.repsMin ?? undefined,
    reps_max: p.repsMax ?? undefined,
    duration_sec: p.durationSecMax ?? undefined,
    rest_sec: p.restSecMin ?? undefined,
    load_unit: ex?.loadUnit,
    rir_min: p.rirMin,
  }
}

const toStoredExercise = (e: BuiltExercise): StoredExercise => storedExerciseFromPrescription(e)
const toPrescribedExercise = (e: BuiltExercise): PrescribedExercise => prescribedExerciseFromPrescription(e.slotId, e, null)

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

function toProgramDoc(programId: string, createdAt: string, uid: string, g: GeneratedProgram, version = 1): ProgramDoc {
  const schedule: Partial<Record<Weekday, DayType>> = {}
  for (const p of g.placements) schedule[p.weekday as Weekday] = p.dayType
  return {
    program_id: programId,
    uid,
    version,
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
 * Project a (possibly runtime-adjusted, e.g. deloaded) `GeneratedProgram` into the three
 * stored records. Shared by `activateProgram` and the coach action resolver's deload path
 * so both produce identical projections. The program is already safety-clamped by the
 * generator; this only reshapes it.
 */
export function projectProgram(uid: string, createdAt: string, g: GeneratedProgram, version = 1): {
  program: StoredProgram
  programDoc: ProgramDoc
  instances: WorkoutInstanceDoc[]
} {
  const programId = `${uid}_v1`
  return {
    program: toStoredProgram(programId, createdAt, g),
    programDoc: toProgramDoc(programId, createdAt, uid, g, version),
    instances: toInstances(programId, uid, g),
  }
}

/**
 * Run the gate, then (only if it opens) the generator. Deterministic. `createdAt` is
 * injectable so callers/tests can pin it; defaults to now.
 */
export function activateProgram(user: UserDoc, createdAt: string = new Date().toISOString()): ActivationResult {
  const gate = canGenerate(user)
  if (!gate.ok) return blocked(gate.reason)

  const gen = generateProgram(user)
  if (!gen.ok) return blocked(`generation_failed:${gen.reason}`)

  const projected = projectProgram(user.uid, createdAt, gen.program)
  return { status: { ok: true, reason: null }, ...projected }
}
