import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

/**
 * Simple per-user, per-day rate limit backed by Firestore.
 *
 * Counters live in a server-only `rateLimits` collection — it isn't in the client
 * allowlist, so firestore.rules default-denies clients, while the Admin SDK here
 * bypasses rules. Throws `resource-exhausted` once the cap is hit. This is the
 * cost/abuse guard the test report flagged as missing for client-side AI.
 */
export async function enforceDailyLimit(key: string, uid: string, max: number): Promise<void> {
  const db = getFirestore()
  const day = new Date().toISOString().slice(0, 10) // UTC day bucket
  const ref = db.collection('rateLimits').doc(`${key}_${uid}_${day}`)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const count = snap.exists ? Number(snap.get('count')) || 0 : 0
    if (count >= max) {
      throw new HttpsError('resource-exhausted', 'Daily limit reached. Please try again tomorrow.')
    }
    tx.set(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  })
}
