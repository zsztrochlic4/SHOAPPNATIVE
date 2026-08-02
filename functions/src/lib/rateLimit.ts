import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

/**
 * Simple per-user, per-day rate limit backed by Firestore.
 *
 * Counters live in a server-only `rateLimits` collection — it isn't in the client
 * allowlist, so firestore.rules default-denies clients, while the Admin SDK here
 * bypasses rules. Throws `resource-exhausted` once the cap is hit.
 *
 * Each doc carries an `expiresAt` so a Firestore TTL policy on that field auto-
 * deletes yesterday's buckets — otherwise the collection grows by one doc per
 * active user per day, forever. Set the policy once (owner): see
 * docs/RATE_LIMITS.md. The day bucket is UTC; a per-user local day would only
 * matter to someone hitting the cap near midnight, which the generous limits make
 * rare — kept simple on purpose.
 */

/** UTC day bucket (YYYY-MM-DD) for a timestamp. */
export function dayBucket(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

/** Deterministic doc id for a user's daily counter. */
export function rateLimitDocId(key: string, uid: string, nowMs: number): string {
  return `${key}_${uid}_${dayBucket(nowMs)}`
}

/** When a counter doc may be auto-deleted — a couple of days out, so a live bucket
 *  is never collected mid-use even across timezones/clock skew. */
export function rateLimitExpiryMs(nowMs: number, ttlDays = 2): number {
  return nowMs + ttlDays * 24 * 60 * 60 * 1000
}

export async function enforceDailyLimit(key: string, uid: string, max: number): Promise<void> {
  const db = getFirestore()
  const now = Date.now()
  const ref = db.collection('rateLimits').doc(rateLimitDocId(key, uid, now))
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const count = snap.exists ? Number(snap.get('count')) || 0 : 0
    if (count >= max) {
      throw new HttpsError('resource-exhausted', 'Daily limit reached. Please try again tomorrow.')
    }
    tx.set(
      ref,
      {
        count: count + 1,
        // The owner uid, queryable so account deletion can purge live buckets
        // (audit F-013) — the doc id embeds it but ids can't be queried by part.
        uid,
        updatedAt: FieldValue.serverTimestamp(),
        // TTL field — a Firestore TTL policy on `rateLimits.expiresAt` reaps old buckets.
        expiresAt: Timestamp.fromMillis(rateLimitExpiryMs(now)),
      },
      { merge: true },
    )
  })
}
