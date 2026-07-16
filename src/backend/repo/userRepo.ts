/**
 * Firestore persistence for the canonical `users` document (Build Backlog P0 #5b).
 *
 * Source of truth: workbook "Data Schemas" (users collection). The onboarding mapping
 * module builds the `UserDoc`; this repo reads/writes it to Firestore so the generator and
 * any server-side context (Cloud Functions) can load the same canonical record the app
 * holds in `state.backendUser`.
 *
 * Storage location: `users/{uid}.backendUser`. The app already owns the `users/{uid}` root
 * document (see store/cloudRepo.ts, which persists the whole AppState there — including
 * `backendUser`). To avoid two competing writers of that document, this repo does a MERGE
 * write of only the `backendUser` field, so it never clobbers the app's other root fields.
 * (Naming note: the workbook calls the collection `users`; the app got there first, so the
 * canonical doc lives under the `backendUser` field of that same doc rather than at its top
 * level. Flagged in BUILD_STATUS.)
 *
 * Every function is a safe no-op when Firebase is not configured (demo mode), where the
 * canonical doc still round-trips via the store's AsyncStorage persistence.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { UserDoc } from '../schema'

const COL = 'users'
const FIELD = 'backendUser'

/** Strip `undefined` (Firestore rejects it) via a plain-data round-trip. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Write the canonical user document to Firestore (merge — only the `backendUser` field).
 * No-op without Firebase. Call this on onboarding completion and after any edit that
 * rebuilds the doc through the mapping module.
 */
export async function writeBackendUser(uid: string, user: UserDoc): Promise<void> {
  if (!db || !uid || uid === 'local') return
  await setDoc(doc(db, COL, uid), { [FIELD]: clean(user) }, { merge: true })
}

/**
 * Read the canonical user document from Firestore. Returns null when absent or when
 * Firebase isn't configured. The generator reads this at Generator Flow step 1/2.
 */
export async function readBackendUser(uid: string): Promise<UserDoc | null> {
  if (!db || !uid || uid === 'local') return null
  const snap = await getDoc(doc(db, COL, uid))
  if (!snap.exists()) return null
  const data = snap.data() as Record<string, unknown>
  return (data[FIELD] as UserDoc | undefined) ?? null
}
