import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { requireVerifiedUser } from './lib/guards'

interface SendNotificationInput {
  /** Audience: a single uid, a saved segment id, or 'all'. */
  audience: string
  title: string
  body: string
  /** Optional deep link. */
  deepLink?: string
  /** Preview only — compute recipient counts without sending. */
  dryRun?: boolean
}

/**
 * STUB — the notification SENDER (owner/admin only).
 *
 * The device already schedules LOCAL reminders. This is the remote push side
 * (DEVELOPMENT_PLAN.md Phase D): a Cloud Scheduler + Tasks pipeline fans out to
 * Expo Push / FCM / APNs, sharded and idempotent (never a full user-base scan),
 * honouring each user's category prefs + quiet hours server-side, with receipts
 * and an immutable audit record. Must be restricted to an owner custom-claim +
 * confirmation for large audiences. Not implemented yet.
 */
export const sendNotification = onCall<SendNotificationInput>(
  { enforceAppCheck: true, timeoutSeconds: 120 },
  (req: CallableRequest<SendNotificationInput>) => {
    const uid = requireVerifiedUser(req)
    // TODO(Phase D): require an `owner` custom claim before allowing any send.
    void uid
    throw new HttpsError('unimplemented', 'sendNotification is scaffolded but not implemented yet.')
  },
)
