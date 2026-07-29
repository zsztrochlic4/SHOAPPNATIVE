import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { requireVerifiedUser } from './lib/guards'

/**
 * STUB — complete, authoritative account deletion.
 *
 * The client already deletes the user's subcollections + login and scrubs the
 * root doc (src/store/cloudRepo.ts deleteUserData). This server function finishes
 * the job with the Admin SDK — the parts the client's rules can't do
 * (DEVELOPMENT_PLAN.md Phase B): hard-delete the root `users/{uid}` doc, remove
 * any Storage objects, and write an immutable deletion audit record. Bypasses the
 * `allow delete: if false` rule safely because it runs with admin privileges.
 * Not implemented yet.
 */
export const deleteAccount = onCall(
  { enforceAppCheck: true, timeoutSeconds: 120 },
  (req: CallableRequest) => {
    const uid = requireVerifiedUser(req)
    void uid
    throw new HttpsError('unimplemented', 'deleteAccount (server-side purge) is scaffolded but not implemented yet.')
  },
)
