import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { requireOwner, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'
import { sendToAudience, type Audience, type SendResult } from './lib/send'
import type { PushCategory } from './lib/notify'

/**
 * The notification SENDER (owner/admin only) — Phase D / DEVELOPMENT_PLAN.md §D.
 *
 * The device schedules LOCAL reminders itself; this is the remote push side. It
 * resolves an audience to device tokens, honours each user's category prefs +
 * quiet hours server-side (src/lib/send.ts), fans out to the Expo Push API in
 * batches, prunes dead tokens, and records an idempotent audit. Restricted to an
 * `owner` custom claim.
 *
 * App Check is NOT enforced here (native App Check isn't set up — same as
 * analyzeMeal/deleteAccount); the owner claim is the real gate.
 *
 * Deferred (see plan): Cloud Scheduler + Tasks sharding for very large / scheduled
 * sends, saved segments, Expo receipt polling, and an in-app admin portal. The
 * owner's MVP entry point is scripts/send-notification.mjs.
 */

const MAX_TEXT = 500
const MAX_TITLE = 100

interface SendNotificationInput {
  /** A single uid, or the literal 'all' for a broadcast. */
  audience: string
  title: string
  body: string
  /** Optional deep link, delivered in the push payload. */
  deepLink?: string
  category?: PushCategory
  /** Deliver even inside a device's quiet window. */
  override?: boolean
  /** Preview only — compute recipient counts without sending. */
  dryRun?: boolean
  /** Idempotency key; generated if omitted. */
  sendId?: string
}

export const sendNotification = onCall<SendNotificationInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 300, memory: '512MiB' },
  async (req: CallableRequest<SendNotificationInput>): Promise<SendResult> => {
    auditAppCheck(req, 'sendNotification')
    requireOwner(req)

    const d = req.data ?? ({} as SendNotificationInput)
    const title = typeof d.title === 'string' ? d.title.trim() : ''
    const body = typeof d.body === 'string' ? d.body.trim() : ''
    if (!title || !body) throw new HttpsError('invalid-argument', 'A title and body are required.')
    if (title.length > MAX_TITLE || body.length > MAX_TEXT) {
      throw new HttpsError('invalid-argument', 'Title or body is too long.')
    }

    const audience: Audience = d.audience === 'all' ? { all: true } : { uid: String(d.audience ?? '') }
    if ('uid' in audience && !audience.uid) {
      throw new HttpsError('invalid-argument', "audience must be a uid or 'all'.")
    }

    return sendToAudience(
      { db: getFirestore(), fetchFn: fetch, now: new Date() },
      {
        audience,
        title,
        body,
        data: d.deepLink ? { deepLink: d.deepLink } : undefined,
        category: d.category,
        override: d.override === true,
        dryRun: d.dryRun === true,
        sendId: typeof d.sendId === 'string' && d.sendId ? d.sendId : randomUUID(),
      },
    )
  },
)

/**
 * One active owner per device token (audit F-005): when a token doc is written
 * under users/{uid}/pushTokens/{token}, remove the SAME token from every other
 * user. The client releases its old registration on sign-out/switch, but that
 * is best-effort (it cannot delete another account's doc once the session has
 * changed) — this trigger is the authoritative backstop, so a shared device
 * can never deliver user A's content while user B is signed in.
 */
export const dedupePushToken = onDocumentWritten(
  'users/{uid}/pushTokens/{token}',
  async (event) => {
    if (!event.data?.after.exists) return // deletion — nothing to dedupe
    const { uid, token } = event.params
    const db = getFirestore()
    const dupes = await db.collectionGroup('pushTokens').where('token', '==', token).get()
    await Promise.all(
      dupes.docs
        .filter((d) => d.ref.parent.parent?.id !== uid)
        .map((d) => d.ref.delete()),
    )
  },
)
