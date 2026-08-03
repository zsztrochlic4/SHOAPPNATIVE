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

import { doc, setDoc, runTransaction } from 'firebase/firestore'
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
 * progression. No-op without Firebase or for the local uid.
 *
 * ── Atomic + idempotent progression (audit SA-003) ─────────────────────────
 * Progression is read-advance-write: reading the prior `progression_state`, computing
 * the next state from THIS session's sets, and writing it back. Done naively that is
 * neither atomic (two concurrent retries/devices both read the pre-advance state and
 * both advance) nor idempotent (a plain retry re-reads the already-advanced state and
 * advances a SECOND time from the same performance — a double-advance).
 *
 * Both are closed by running the read/advance/write inside a single Firestore
 * transaction gated on a per-instance applied marker (`progression_applied` on the
 * `workout_instances/{instance_id}` doc — no new collection/rule needed):
 *   • Atomic: the transaction's optimistic concurrency serialises concurrent runs, so
 *     only one advance can commit; the loser retries, sees the marker, and no-ops.
 *   • Idempotent: once the marker is set, re-running skips the advance entirely.
 * Set logs (stable ids) and the instance status flip stay outside the transaction —
 * they are already merge-idempotent and re-writing them is harmless.
 */
export async function logCompletedProgramSession(
  uid: string,
  user: Pick<UserDoc, 'goal'>,
  instance: WorkoutInstanceDoc,
  loggedByExerciseId: Record<string, LoggedSetInput[]>,
  now: string = new Date().toISOString(),
): Promise<void> {
  if (!db || !uid || uid === 'local') return
  const database = db

  // 1. Set logs (one document per completed set, keyed by the backend exercise_id).
  //    Stable ids + merge → re-finishing overwrites cleanly rather than doubling up.
  const logs = buildSetLogs(uid, instance, loggedByExerciseId, now)
  await Promise.all(
    logs.map((log) => setDoc(doc(database, 'users', uid, 'set_logs', log.log_id), clean(log), { merge: true })),
  )

  const performedIds = Array.from(
    new Set(
      instance.exercises
        .map((e) => e.exercise_id)
        .filter((id) => (loggedByExerciseId[id] ?? []).some((r) => r.done)),
    ),
  )
  const instanceRef = doc(database, 'users', uid, 'workout_instances', instance.instance_id)

  // 2–3. Atomic, idempotent progression advance (see header). ALL reads happen before
  //      ANY write, as Firestore transactions require.
  await runTransaction(database, async (tx) => {
    const instSnap = await tx.get(instanceRef)
    const alreadyApplied = instSnap.exists() && instSnap.data()?.progression_applied === true

    // Read prior progression_state for each performed exercise (only when we still
    // need to advance — but always before writes to satisfy the read-before-write rule).
    const priorStates: Record<string, ProgressionStateDoc> = {}
    if (!alreadyApplied) {
      for (const id of performedIds) {
        const snap = await tx.get(doc(database, 'users', uid, 'progression_state', progressionDocId(uid, id)))
        if (snap.exists()) priorStates[id] = snap.data() as ProgressionStateDoc
      }
    }

    if (!alreadyApplied) {
      const progressions = progressionFromSession(uid, user.goal, instance, loggedByExerciseId, priorStates)
      for (const { exerciseId, result } of progressions) {
        const next: ProgressionStateDoc = { ...result.nextState, uid, exercise_id: exerciseId }
        tx.set(
          doc(database, 'users', uid, 'progression_state', progressionDocId(uid, exerciseId)),
          clean(next),
          { merge: true },
        )
      }
    }

    // Mark the instance done AND record that progression has been applied — the
    // idempotency marker for any later retry (this write, being in the transaction,
    // is what makes "advance at most once" atomic across concurrent runs).
    tx.set(
      instanceRef,
      clean({ uid, instance_id: instance.instance_id, status: 'done', progression_applied: true }),
      { merge: true },
    )
  })
}
