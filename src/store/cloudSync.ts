import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppState } from './types'

/**
 * Per-user cloud copy of the app state, stored at `users/{uid}` in Firestore.
 * This mirrors the existing AsyncStorage persistence (see store.tsx) but to the
 * cloud, so a signed-in user's data follows them across devices.
 *
 * Security is enforced by firestore.rules: a user can only touch their own doc.
 */
const COL = 'users'

/**
 * Progress photos are base64 data URLs that can exceed Firestore's 1MB/doc
 * limit, so they stay on-device for now. Cloud photo backup (Firebase Storage)
 * is a deliberate follow-up step.
 */
function stripForCloud(state: AppState): Omit<AppState, 'photos'> {
  const { photos: _photos, ...rest } = state
  return rest
}

/** Read the signed-in user's saved state, or null if they have none yet. */
export async function loadUserState(uid: string): Promise<Partial<AppState> | null> {
  if (!db) return null
  const snap = await getDoc(doc(db, COL, uid))
  if (!snap.exists()) return null
  const data = { ...(snap.data() as Record<string, unknown>) }
  delete data.updatedAt
  return data as Partial<AppState>
}

/** Write the signed-in user's state to the cloud (photos excluded — see above). */
export async function saveUserState(uid: string, state: AppState): Promise<void> {
  if (!db) return
  await setDoc(doc(db, COL, uid), { ...stripForCloud(state), updatedAt: serverTimestamp() })
}
