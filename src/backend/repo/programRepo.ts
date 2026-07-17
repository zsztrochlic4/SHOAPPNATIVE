/**
 * Firestore persistence for the generated program and its per-day instances.
 *
 * Storage location (owner-only per the deployed rules — no rule change needed):
 *   users/{uid}/programs/{program_id}
 *   users/{uid}/workout_instances/{instance_id}
 *
 * These are the canonical schema.ts records the server and the (future) set-by-set
 * logging path read. The app also keeps a compact render projection in AppState
 * (`generatedProgram`) for display; these documents are the source of truth.
 *
 * Every function is a safe no-op when Firebase is not configured (demo mode), where the
 * store's AsyncStorage persistence covers the render projection.
 */

import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { ProgramDoc, WorkoutInstanceDoc } from '../schema'

/** Strip `undefined` (Firestore rejects it) via a plain-data round-trip. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Persist the active program document and its scheduled-day instances. No-op without
 * Firebase or for the anonymous/local uid. Writes are merges keyed by the stable
 * program/instance ids, so re-activating (e.g. regeneration) overwrites cleanly.
 */
export async function writeActiveProgram(
  uid: string,
  program: ProgramDoc,
  instances: WorkoutInstanceDoc[],
): Promise<void> {
  if (!db || !uid || uid === 'local') return
  await setDoc(doc(db, 'users', uid, 'programs', program.program_id), clean(program), { merge: true })
  await Promise.all(
    instances.map((inst) =>
      setDoc(doc(db!, 'users', uid, 'workout_instances', inst.instance_id), clean(inst), { merge: true }),
    ),
  )
}
