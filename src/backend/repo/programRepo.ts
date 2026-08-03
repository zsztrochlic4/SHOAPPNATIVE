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

import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { ProgramDoc, UserDoc, WorkoutInstanceDoc } from '../schema'

/** Strip `undefined` (Firestore rejects it) via a plain-data round-trip. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Persist the active program document and its scheduled-day instances ATOMICALLY, removing any
 * obsolete instances left by a previous schedule (C-005).
 *
 * Instance ids are keyed by weekday (`${program_id}_${weekday}`), so a Mon/Wed/Fri → Tue/Thu
 * change used to write the new Tue/Thu docs while the stale Mon/Wed/Fri docs lingered, leaving
 * contradictory canonical data (schedule/export/sync disagree). We now write the program doc,
 * write the new instances, AND delete every existing instance for this program that is not in
 * the new set — all in a single batched commit so the canonical state can never be half-updated.
 *
 * No-op without Firebase or for the anonymous/local uid.
 */
export async function writeActiveProgram(
  uid: string,
  program: ProgramDoc,
  instances: WorkoutInstanceDoc[],
): Promise<void> {
  if (!db || !uid || uid === 'local') return
  const instancesCol = collection(db, 'users', uid, 'workout_instances')

  // Find instances currently stored for this program so we can drop the ones the new schedule
  // no longer includes. Best-effort: if the query fails we still write the new set below.
  const keep = new Set(instances.map((i) => i.instance_id))
  let stale: string[] = []
  try {
    const existing = await getDocs(query(instancesCol, where('program_id', '==', program.program_id)))
    stale = existing.docs.map((d) => d.id).filter((id) => !keep.has(id))
  } catch {
    stale = []
  }

  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid, 'programs', program.program_id), clean(program), { merge: true })
  for (const inst of instances) {
    batch.set(doc(instancesCol, inst.instance_id), clean(inst), { merge: false })
  }
  for (const id of stale) batch.delete(doc(instancesCol, id))
  await batch.commit()
}

/**
 * ATOMIC commit of a whole coach action (audit U-001 / U-008): the canonical user doc, the program
 * doc, the new instances AND the deletion of obsolete instances all land in ONE Firestore batch, so
 * a signed-in user can never end up with the profile changed but the program not (or vice-versa), and
 * a stale schedule can never linger.
 *
 * FAIL CLOSED (U-008): the obsolete-instance discovery query is NOT swallowed — if it throws, this
 * throws and the caller keeps the prior plan, rather than committing a write that could orphan docs.
 *
 * No-op without Firebase or for the anonymous/local uid.
 */
export async function commitCoachAction(
  uid: string,
  backendUser: UserDoc,
  program: ProgramDoc,
  instances: WorkoutInstanceDoc[],
): Promise<void> {
  if (!db || !uid || uid === 'local') return
  const instancesCol = collection(db, 'users', uid, 'workout_instances')
  const keep = new Set(instances.map((i) => i.instance_id))
  // Discover obsolete instances; a failure here ABORTS the commit (fail closed) — no try/catch.
  const existing = await getDocs(query(instancesCol, where('program_id', '==', program.program_id)))
  const stale = existing.docs.map((d) => d.id).filter((id) => !keep.has(id))

  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), { backendUser: clean(backendUser) }, { merge: true })
  batch.set(doc(db, 'users', uid, 'programs', program.program_id), clean(program), { merge: true })
  for (const inst of instances) batch.set(doc(instancesCol, inst.instance_id), clean(inst), { merge: false })
  for (const id of stale) batch.delete(doc(instancesCol, id))
  await batch.commit()
}
