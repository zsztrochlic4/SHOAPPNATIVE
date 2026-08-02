import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAuth } from 'firebase-admin/auth'
import { requireAuth, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'

/**
 * Complete, authoritative account deletion (DEVELOPMENT_PLAN.md Phase B).
 *
 * Runs with Admin privileges, so it does the parts the client can't: hard-deletes
 * the root `users/{uid}` doc (client rules block that by design), every
 * subcollection under it, any Storage objects, and the login itself — no
 * "recent login" re-auth required. Writes a minimal deletion audit record.
 *
 * The client's cloudRepo.deleteUserData remains as a fallback for when the backend
 * is unreachable; this is the preferred, complete path.
 */
export const deleteAccount = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 300, memory: '512MiB' },
  async (req: CallableRequest): Promise<{ ok: true }> => {
    auditAppCheck(req, 'deleteAccount')
    const uid = requireAuth(req)
    const db = getFirestore()

    // 1. All Firestore data: the root doc + every subcollection, in one pass.
    await db.recursiveDelete(db.collection('users').doc(uid))
    await db.recursiveDelete(db.collection('coachUsers').doc(uid))
    await db.collection('coachSafety').doc(uid).delete()

    // 2. Any Storage objects for this user (best-effort; none are stored today).
    try {
      await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` })
    } catch {
      /* no bucket/objects, or storage not provisioned — non-fatal */
    }

    // 3. Remove the login itself (admin — no recent-login requirement).
    try {
      await getAuth().deleteUser(uid)
    } catch (err) {
      throw new HttpsError('internal', 'Could not fully delete the account. Please try again.')
    }

    // 4. Immutable audit record (uid + timestamp only — no personal content).
    try {
      await db.collection('deletionAudit').add({ uid, at: FieldValue.serverTimestamp() })
    } catch {
      /* non-fatal */
    }

    return { ok: true }
  },
)
