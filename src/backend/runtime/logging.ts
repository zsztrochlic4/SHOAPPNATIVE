/**
 * Logging runtime — the seam between a generated program day and the set-by-set logger
 * (deferred item M3). Three concerns, all deterministic and app-independent so the
 * profile sweep can exercise them:
 *
 *   1. Resolver (M3 name↔id). Onboarding collects loved/avoided exercises as free text;
 *      here we resolve those names to Exercise Database ids, and resolve a stored
 *      `exercise_id` back to a loggable descriptor (name + measurement type). The
 *      onboarding search list is sourced from `ACTIVE_EXERCISE_NAMES` (the 113-exercise
 *      DB) rather than a hardcoded catalogue, so the names always resolve.
 *   2. Set logs. A completed loggable session becomes `SetLogDoc[]` keyed by the backend
 *      `exercise_id`, with the fields that match each exercise's measurement type.
 *   3. Progression. Those completed sets are fed straight into the Progression Engine
 *      (progress.ts), which re-clamps the next prescription through the Safety Rules.
 *
 * The app layer builds the on-screen `WorkoutSession`/`LoggedExercise` (with imagery) from
 * `loggableSlots()`; it never re-implements the resolution or the safety-facing maths.
 */

import { ACTIVE_EXERCISES, EXERCISE_BY_ID, prescriptionFor } from '../data'
import { progressExercise, type ProgressResult, type SessionSet } from '../generator/progress'
import type {
  BackendGoal, MeasurementType, PrescribedExercise, ProgressionStateDoc, SetLogDoc, WorkoutInstanceDoc,
} from '../schema'

/* ------------------------------------------------------------------ */
/*  1. Resolver (M3)                                                    */
/* ------------------------------------------------------------------ */

const normalise = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, ' ')

/** Every active exercise name, de-duped and sorted — the onboarding/search source list. */
export const ACTIVE_EXERCISE_NAMES: string[] = Array.from(
  new Set(ACTIVE_EXERCISES.map((e) => e.name)),
).sort((a, b) => a.localeCompare(b))

const ID_BY_NAME: Readonly<Record<string, string>> = Object.freeze(
  ACTIVE_EXERCISES.reduce<Record<string, string>>((acc, e) => {
    acc[normalise(e.name)] ??= e.id // first id wins on the rare duplicate name
    return acc
  }, {}),
)

/**
 * Resolve free-text exercise names (onboarding love/avoid) to Exercise Database ids.
 * Names typed by hand that don't match the DB are dropped — the generator only reasons
 * about known ids, so an unrecognised "favourite" simply has no effect. Order-preserving
 * and de-duped.
 */
export function resolveExerciseIdsByName(names: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const id = ID_BY_NAME[normalise(name)]
    if (id && !seen.has(id)) { seen.add(id); out.push(id) }
  }
  return out
}

/* ------------------------------------------------------------------ */
/*  2. Loggable slots (a program day → what the logger renders)        */
/* ------------------------------------------------------------------ */

export interface LoggableSlot {
  slotId: string
  exerciseId: string
  name: string
  muscleGroup: string
  measurementType: MeasurementType
  prescriptionClass: string
  loadable: boolean
  targetSets: number
  /** Human label for the target, e.g. "8–12 reps", "30s", "3 × 40s". */
  targetRepsLabel: string
  /** Starting values seeded into each set input. */
  seedLoadKg: number
  seedReps: number
  rirMin: number
}

/**
 * Bare target label for a prescription, chosen by the exercise's measurement type — bare so
 * the logger UI can append its own unit ("… reps"). Ranges → "8–12", timed → "30s", intervals
 * → "3 × 40s".
 */
export function targetRepsLabel(pe: PrescribedExercise): string {
  switch (pe.measurement_type) {
    case 'duration':
      return pe.duration_sec != null ? `${pe.duration_sec}s` : '—'
    case 'interval':
      if (pe.rounds != null && pe.work_sec != null) return `${pe.rounds} × ${pe.work_sec}s`
      if (pe.work_sec != null) return `${pe.work_sec}s work`
      return '—'
    default:
      if (pe.reps_min != null && pe.reps_max != null) return `${pe.reps_min}–${pe.reps_max}`
      if (pe.reps_min != null) return `${pe.reps_min}`
      return '—'
  }
}

/** Starting weight for a set input — the prescribed target load, or assistance for assisted. */
function seedLoadKg(pe: PrescribedExercise): number {
  if (pe.measurement_type === 'assisted') return pe.assistance_kg ?? 0
  return pe.load_kg_target ?? 0
}

/** Starting rep count for a set input — the bottom of the range, so logging starts honest. */
function seedReps(pe: PrescribedExercise): number {
  return pe.reps_min ?? 0
}

/**
 * Resolve one persisted `PrescribedExercise` (schema.ts) to a loggable slot. Falls back to
 * the stored `exercise_id` / `substituted_from` for the name if the id is somehow unknown,
 * so a rename in the DB can never leave a blank row.
 */
export function loggableSlot(pe: PrescribedExercise): LoggableSlot {
  const ex = EXERCISE_BY_ID[pe.exercise_id]
  return {
    slotId: pe.slot_id,
    exerciseId: pe.exercise_id,
    name: ex?.name ?? pe.substituted_from ?? pe.exercise_id,
    muscleGroup: ex?.muscleGroup ?? '',
    measurementType: pe.measurement_type,
    prescriptionClass: ex?.prescriptionClass ?? 'Rep',
    loadable: ex?.loadable ?? pe.measurement_type === 'weight_reps',
    targetSets: pe.sets,
    targetRepsLabel: targetRepsLabel(pe),
    seedLoadKg: seedLoadKg(pe),
    seedReps: seedReps(pe),
    rirMin: pe.rir_min,
  }
}

/** All loggable slots for a scheduled instance, in prescribed order. */
export function loggableSlots(instance: WorkoutInstanceDoc): LoggableSlot[] {
  return instance.exercises.map(loggableSlot)
}

/* ------------------------------------------------------------------ */
/*  3. Set logs (completed sets → SetLogDoc[])                          */
/* ------------------------------------------------------------------ */

/** One logged set as the app records it (weight+reps UI); `done` gates whether it counts. */
export interface LoggedSetInput {
  weightKg: number
  reps: number
  done: boolean
}

/**
 * Build `SetLogDoc[]` for every completed set, keyed by the backend `exercise_id` and
 * shaped by its measurement type. `loggedByExerciseId` maps an exercise id to the set rows
 * the user logged for it. Only `done` sets are recorded.
 */
export function buildSetLogs(
  uid: string,
  instance: WorkoutInstanceDoc,
  loggedByExerciseId: Record<string, LoggedSetInput[]>,
  now: string = new Date().toISOString(),
): SetLogDoc[] {
  const logs: SetLogDoc[] = []
  for (const pe of instance.exercises) {
    const rows = loggedByExerciseId[pe.exercise_id] ?? []
    let setNumber = 0
    for (const row of rows) {
      if (!row.done) continue
      setNumber += 1
      const log: SetLogDoc = {
        log_id: `${instance.instance_id}_${pe.exercise_id}_${setNumber}`,
        instance_id: instance.instance_id,
        uid,
        exercise_id: pe.exercise_id,
        set_number: setNumber,
        measurement_type: pe.measurement_type,
        timestamp: now,
        pain_flag: false,
        stop_symptom: false,
      }
      switch (pe.measurement_type) {
        case 'weight_reps':
          log.load_kg = row.weightKg
          log.load_unit = pe.load_unit ?? 'kg'
          log.reps_done = row.reps
          break
        case 'reps':
          log.reps_done = row.reps
          break
        case 'assisted':
          log.assistance_kg = row.weightKg
          log.reps_done = row.reps
          break
        case 'duration':
          log.duration_sec_done = pe.duration_sec
          break
        case 'interval':
          log.rounds_done = pe.rounds
          log.work_sec_done = pe.work_sec
          break
      }
      logs.push(log)
    }
  }
  return logs
}

/* ------------------------------------------------------------------ */
/*  4. Progression (completed sets → next progression_state)           */
/* ------------------------------------------------------------------ */

/** A fresh progression_state seeded from the prescription, for a first-ever session. */
export function seedProgressionState(uid: string, pe: PrescribedExercise): ProgressionStateDoc {
  return {
    uid,
    exercise_id: pe.exercise_id,
    current_load_kg: pe.load_kg_target ?? 0,
    current_rep_target: pe.reps_min ?? 5,
    last_progressed_at: null,
    sessions_at_current: 0,
    stall_count: 0,
    deload_count: 0,
  }
}

export interface ExerciseProgress {
  exerciseId: string
  result: ProgressResult
}

/**
 * Feed a completed session into the Progression Engine, one exercise at a time. For each
 * exercise the user logged sets for, we read the goal|class grid row, take the prior
 * `progression_state` (or seed one), and run `progressExercise` — which re-clamps the next
 * prescription through the Safety Rules (S04/S07, Min RIR). `rir_reported` defaults to the
 * prescribed floor since the weight+reps logger doesn't capture RIR yet. Returns the next
 * state per exercise; the caller persists it.
 */
export function progressionFromSession(
  uid: string,
  goal: BackendGoal,
  instance: WorkoutInstanceDoc,
  loggedByExerciseId: Record<string, LoggedSetInput[]>,
  priorStates: Record<string, ProgressionStateDoc> = {},
): ExerciseProgress[] {
  const out: ExerciseProgress[] = []
  for (const pe of instance.exercises) {
    const ex = EXERCISE_BY_ID[pe.exercise_id]
    if (!ex) continue
    const doneRows = (loggedByExerciseId[pe.exercise_id] ?? []).filter((r) => r.done)
    if (doneRows.length === 0) continue // never progress an exercise that wasn't performed
    const grid = prescriptionFor(goal, ex.prescriptionClass)
    if (!grid) continue
    const state = priorStates[pe.exercise_id] ?? seedProgressionState(uid, pe)
    const targetRir = Math.max(grid.rirMin ?? ex.minRir, ex.minRir)
    const sets: SessionSet[] = doneRows.map((r) => ({
      reps_done: r.reps,
      rir_reported: targetRir,
      load_kg: r.weightKg,
    }))
    const result = progressExercise({ ex, grid, state, sets })
    out.push({ exerciseId: pe.exercise_id, result })
  }
  return out
}
