import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAuth } from 'firebase-admin/auth'
import { requireAuth, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'

/**
 * Complete, authoritative account deletion (audit F-002 / F-013).
 *
 * Runs with Admin privileges, so it does the parts the client can't: hard-deletes
 * the root `users/{uid}` doc (client rules block that by design), every
 * subcollection under it, the coach workspace and safety state, the entitlement
 * record, rate-limit buckets, any Storage objects, and the login itself — no
 * "recent login" re-auth required.
 *
 * This is the ONLY deletion path: the client no longer has a destructive
 * fallback (the old one could delete data and then fail `deleteUser` on
 * requires-recent-login, leaving a live login with no data — worse than failing).
 *
 * The job is IDEMPOTENT and RESUMABLE: a `deletionJobs/{uid}` tombstone is
 * written first, each step tolerates already-deleted resources, and a retry
 * after a partial failure finishes the remainder. The tombstone (uid +
 * timestamps + status only, no personal content) is retained as the deletion
 * audit record — the documented retention exception (see docs/PRIVACY.md).
 */

/**
 * Deletion registry — every UID-bearing Firestore location (audit F-013). Keep
 * this list in sync with firestore.rules; anything new that stores a uid MUST
 * be added here (and to the export in src/store/cloudRepo.ts where
 * client-readable).
 */
const RECURSIVE_DOCS = ['users', 'coachUsers'] as const // root doc + all subcollections
const SINGLE_DOCS = ['coachSafety', 'entitlements'] as const

export const deleteAccount = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 300, memory: '512MiB' },
  async (req: CallableRequest): Promise<{ ok: true }> => {
    auditAppCheck(req, 'deleteAccount')
    const uid = requireAuth(req)
    const db = getFirestore()

    // 0. Tombstone FIRST: the job is accepted before anything is destroyed, so
    // a partial failure is visibly in_progress and a retry resumes it.
    const job = db.collection('deletionJobs').doc(uid)
    await job.set(
      { uid, status: 'in_progress', startedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )

    // 1. All Firestore data. Every step is a no-op when already deleted.
    for (const col of RECURSIVE_DOCS) {
      await db.recursiveDelete(db.collection(col).doc(uid))
    }
    for (const col of SINGLE_DOCS) {
      await db.collection(col).doc(uid).delete()
    }
    // Rate-limit buckets carry a `uid` field precisely so deletion can find
    // them (their doc ids embed the uid + day). TTL would reap them within
    // days anyway; this makes "delete all my data" literally true now.
    const buckets = await db.collection('rateLimits').where('uid', '==', uid).get()
    for (const d of buckets.docs) await d.ref.delete()

    // 2. Any Storage objects for this user (best-effort; none are stored today).
    try {
      await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` })
    } catch {
      /* no bucket/objects, or storage not provisioned — non-fatal */
    }

    // 3. Remove the login itself (admin — no recent-login requirement).
    // Idempotent: a retry after the login is already gone must still succeed.
    try {
      await getAuth().deleteUser(uid)
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code !== 'auth/user-not-found') {
        // Data is gone but the login remains — leave the job in_progress so a
        // retry (the session token stays valid briefly) can finish it.
        throw new HttpsError('internal', 'Could not fully delete the account. Please try again.')
      }
    }

    // 4. Mark the job complete — this doubles as the minimal audit record.
    await job.set(
      { status: 'complete', completedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )

    return { ok: true }
  },
)
