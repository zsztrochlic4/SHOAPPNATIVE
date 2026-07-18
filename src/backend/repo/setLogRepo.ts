/**
 * Firestore persistence for the set-by-set logging path.
 *
 * Storage location (owner-only per the deployed rules — no rule change needed):
 *   users/{uid}/set_logs/{log_id}
 *   users/{uid}/progression_state/{uid}_{exercise_id}
 *   users/{uid}/workout_instances/{instance_id}   ← status flips to 'done'
 *
 * When a program session is finished, this records one `SetLogDoc` per completed set (keyed
 * by the backend `exercise_id`) and then runs the Progression Engine for each exercise:
 * read the prior `progression_state`, feed in the completed sets, and write back the next
 * state. The engine re-clamps the next prescription through the Safety Rules, so nothing
 * here can raise a load past the S07 weekly cap or drop reps/RIR below their floors.
 *
 * Every function is a safe no-op when Firebase is not configured (demo mode) or for the
 * anonymous/local uid, where the store's AsyncStorage persistence covers the render state.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { buildSetLogs, progressionFromSession, type LoggedSetInput } from '../runtime/logging'
import type { ProgressionStateDoc, UserDoc, WorkoutInstanceDoc } from '../schema'

/** Strip `undefined` (Firestore rejects it) via a plain-data round-trip. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

const progressionDocId = (uid: string, exerciseId: string) => `${uid}_${exerciseId}`

/**
 * Persist a finished program session: the completed set logs, and the resulting per-exercise
 * progression. No-op without Firebase or for the local uid. Idempotent — set-log and
 * progression ids are stable, so re-finishing a session overwrites cleanly rather than
 * doubling up.
 */
export async function logCompletedProgramSession(
  uid: string,
  user: Pick<UserDoc, 'goal'>,
  instance: WorkoutInstanceDoc,
  loggedByExerciseId: Record<string, LoggedSetInput[]>,
  now: string = new Date().toISOString(),
): Promise<void> {
  if (!db || !uid || uid === 'local') return

  // 1. Set logs (one document per completed set, keyed by the backend exercise_id).
  const logs = buildSetLogs(uid, instance, loggedByExerciseId, now)
  await Promise.all(
    logs.map((log) => setDoc(doc(db!, 'users', uid, 'set_logs', log.log_id), clean(log), { merge: true })),
  )

  // 2. Read the prior progression_state for each performed exercise.
  const performedIds = Array.from(
    new Set(
      instance.exercises
        .map((e) => e.exercise_id)
        .filter((id) => (loggedByExerciseId[id] ?? []).some((r) => r.done)),
    ),
  )
  const priorStates: Record<string, ProgressionStateDoc> = {}
  await Promise.all(
    performedIds.map(async (id) => {
      const snap = await getDoc(doc(db!, 'users', uid, 'progression_state', progressionDocId(uid, id)))
      if (snap.exists()) priorStates[id] = snap.data() as ProgressionStateDoc
    }),
  )

  // 3. Run the Progression Engine (re-clamps through the Safety Rules) and persist next state.
  const progressions = progressionFromSession(uid, user.goal, instance, loggedByExerciseId, priorStates)
  await Promise.all(
    progressions.map(({ exerciseId, result }) => {
      const next: ProgressionStateDoc = { ...result.nextState, uid, exercise_id: exerciseId }
      return setDoc(
        doc(db!, 'users', uid, 'progression_state', progressionDocId(uid, exerciseId)),
        clean(next),
        { merge: true },
      )
    }),
  )

  // 4. Mark the instance done so a re-open reflects it (undated template: status only).
  await setDoc(
    doc(db!, 'users', uid, 'workout_instances', instance.instance_id),
    { status: 'done' },
    { merge: true },
  )
}
