/**
 * App-facing bridge from a generated program day to the set-by-set logger.
 *
 * The backend `logging.ts` resolves each stored `PrescribedExercise` to a loggable slot
 * (name, measurement type, target, seed values) and owns all safety-facing maths. This
 * module is the thin app layer on top: it turns a `WorkoutInstanceDoc` into the
 * `WorkoutSession`/`LoggedExercise` shape the existing logger renders, adding only
 * presentation (imagery, day naming). Nothing here re-implements resolution or prescription.
 */

import { loggableSlots } from '../backend/runtime/logging'
import { EXERCISE_BY_ID } from '../backend/data'
import type { WorkoutInstanceDoc } from '../backend/schema'
import { img, exById, exerciseDetail, type ExerciseDetail } from '../data/catalog'
import { fromKey } from '../lib/date'
import type { LoggedExercise, SetLog, WorkoutSession } from './types'

/** JS `Date.getDay()` (0=Sun) → the backend full weekday name used in instance ids. */
const FULL_WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Full weekday name ('Monday'…) for a 'YYYY-MM-DD' key — matches `WorkoutInstanceDoc` ids. */
export function fullWeekday(dateKey: string): string {
  return FULL_WEEKDAY[fromKey(dateKey).getDay()]
}

/** A stable, presentational image per muscle group (the DB carries no imagery of its own). */
const IMAGE_BY_MUSCLE: Record<string, string> = {
  Chest: img.bench,
  Back: img.row,
  Shoulders: img.shoulder,
  Quads: img.squat,
  'Hamstrings & Glutes': img.deadlift,
  Biceps: img.curl,
  Triceps: img.tricep,
  Core: img.heroWorkout,
  Calves: img.legpress,
  'Full Body & Conditioning': img.pushDay,
}
export function imageForMuscle(muscleGroup: string): string {
  return IMAGE_BY_MUSCLE[muscleGroup] ?? img.heroWorkout
}

/** A friendly session title from a day-type token ('Push' → 'Push Day'; 'Rest' stays). */
function dayTypeName(dayType: string): string {
  if (!dayType || /day|rest|recovery|full body|conditioning/i.test(dayType)) return dayType || 'Workout'
  return `${dayType} Day`
}

export interface SessionBuildOptions {
  /** Preferred session length in minutes (the user's `session_length_min`). */
  durationMin?: number
}

/**
 * Build a loggable `WorkoutSession` from a scheduled program instance for a given day.
 * The session id is date-scoped (`${instance_id}_${dateKey}`) so each day logs its own
 * history, while `instanceId` links back to the prescription for set-log + progression
 * persistence on completion. Returns null for an instance with no exercises (a rest day).
 */
export function sessionFromInstance(
  instance: WorkoutInstanceDoc,
  dateKey: string,
  opts: SessionBuildOptions = {},
): WorkoutSession | null {
  const slots = loggableSlots(instance)
  if (slots.length === 0) return null

  const exercises: LoggedExercise[] = slots.map((s) => {
    const count = Math.max(1, s.targetSets)
    const sets: SetLog[] = Array.from({ length: count }, () => ({
      weightKg: s.seedLoadKg,
      reps: s.seedReps,
      done: false,
    }))
    return {
      defId: s.exerciseId,
      name: s.name,
      image: imageForMuscle(s.muscleGroup),
      targetSets: s.targetSets,
      targetReps: s.targetRepsLabel,
      sets,
    }
  })

  // A focus line from the distinct muscle groups trained, capped so it stays glanceable.
  const muscles = Array.from(new Set(slots.map((s) => s.muscleGroup).filter(Boolean)))
  const focus = muscles.slice(0, 3).join(' · ') || instance.day_type

  return {
    id: `${instance.instance_id}_${dateKey}`,
    instanceId: instance.instance_id,
    dateKey,
    name: dayTypeName(instance.day_type),
    focus,
    image: exercises[0]?.image ?? img.heroWorkout,
    durationMin: opts.durationMin ?? 45,
    volumeKg: 0,
    calories: Math.round((opts.durationMin ?? 45) * 9),
    exercises,
    completed: false,
  }
}

/* ------------------------------------------------------------------ */
/*  Exercise detail view — catalogue first, Exercise Database second   */
/* ------------------------------------------------------------------ */

export interface ExerciseView {
  name: string
  muscle: string
  image: string
  detail: ExerciseDetail
}

/**
 * Resolve an exercise id for the technique sheet. The demo/seed data uses the ~20-item app
 * catalogue; a generated program uses backend ids (CH02, QD01…). Try the catalogue first,
 * then fall back to the 113-exercise Database so a generated-program row never opens blank.
 */
export function exerciseView(defId: string): ExerciseView | null {
  const cat = exById(defId)
  if (cat) return { name: cat.name, muscle: cat.muscle, image: cat.image, detail: exerciseDetail(defId) }

  const ex = EXERCISE_BY_ID[defId]
  if (!ex) return null
  return {
    name: ex.name,
    muscle: ex.muscleGroup,
    image: imageForMuscle(ex.muscleGroup),
    detail: {
      desc: ex.whatItDoes,
      cues: ex.steps,
      commonMistake: ex.commonMistake,
      ifTaken: ex.safetyNote || 'Swap to a similar machine or free-weight variation that’s free.',
      beginnerFriendly: ex.skillLevel === 'Beginner',
    },
  }
}
