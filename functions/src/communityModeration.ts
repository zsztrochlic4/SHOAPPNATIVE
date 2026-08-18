/**
 * Community content moderation — the REPORT + TRIAGE half (the blocklist half is
 * the shared, pure src/community/contentModeration.ts screen enforced in
 * claimUsername / createGroup). Users report an offensive username or group name;
 * reports queue in `contentReports/{id}` for the app owner to triage via
 * resolveContentReport (owner-claim gated). Written ONLY by these callables; the
 * queue is readable ONLY by a moderator (never the reporter or the subject).
 *
 * For launch, triage is callable/console-driven (no admin UI yet, by owner
 * decision): the owner lists `contentReports` (or uses resolveContentReport) and,
 * when a report is upheld, takes the actual action (clear a username, delete a
 * group) with the existing owner tools. Recording the disposition here keeps an
 * auditable trail.
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { requireAuth, requireOwner, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'
import { enforceDailyLimit } from './lib/rateLimit'

const REGION = 'australia-southeast2'
const TARGET_TYPES = ['user', 'group'] as const
const REASONS = ['offensive_name', 'harassment', 'impersonation', 'cheating', 'other'] as const
type TargetType = (typeof TARGET_TYPES)[number]

/** Firestore doc-id-safe token (no '/', no leading dots), bounded length. */
const idSafe = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128)

/* -------------------------------- reportContent ---------------------------- */

interface ReportInput {
  targetType?: string
  targetId?: string
  targetLabel?: string
  reason?: string
  note?: string
}

/** File a moderation report against a username or group. Idempotent per
 *  (reporter, target): a deterministic doc id means re-reporting the same target
 *  refreshes the one report rather than spamming the queue. Rate-limited. */
export const reportContent = onCall<ReportInput>(
  { region: REGION, enforceAppCheck: APP_CHECK_ENFORCED, maxInstances: 1 },
  async (req) => {
    const uid = requireAuth(req)
    auditAppCheck(req, 'reportContent')
    await enforceDailyLimit('community_report', uid, 30)

    const targetType = req.data?.targetType as TargetType
    if (!TARGET_TYPES.includes(targetType)) {
      throw new HttpsError('invalid-argument', 'targetType must be "user" or "group".')
    }
    const targetId = idSafe(typeof req.data?.targetId === 'string' ? req.data.targetId : '')
    if (!targetId) throw new HttpsError('invalid-argument', 'A target id is required.')
    if (targetType === 'user' && targetId === uid) {
      throw new HttpsError('invalid-argument', 'You cannot report yourself.')
    }
    const reason = REASONS.includes(req.data?.reason as (typeof REASONS)[number])
      ? (req.data!.reason as string)
      : 'other'
    const note = typeof req.data?.note === 'string' ? req.data.note.slice(0, 500) : ''
    const targetLabel = typeof req.data?.targetLabel === 'string' ? req.data.targetLabel.slice(0, 64) : ''

    const db = getFirestore()
    const reportId = `${idSafe(uid)}__${targetType}__${targetId}`
    const ref = db.collection('contentReports').doc(reportId)
    const existing = await ref.get()
    await ref.set(
      {
        reporterUid: uid,
        targetType,
        targetId,
        // targetLabel is client-provided (what the reporter saw) — informational.
        targetLabel,
        reason,
        note,
        status: 'pending',
        createdAt: existing.exists ? existing.get('createdAt') ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    logger.info('community.reportContent', { targetType, targetId, reason })
    return { ok: true as const }
  },
)

/* ----------------------------- resolveContentReport ------------------------ */

interface ResolveInput {
  reportId?: string
  disposition?: string
  note?: string
}

/** Owner-only: close a report with a disposition. `dismiss` = no action needed;
 *  `actioned` = the owner took the enforcement action (rename/remove) out of band.
 *  Records who/when/why for the audit trail. */
export const resolveContentReport = onCall<ResolveInput>(
  { region: REGION, enforceAppCheck: APP_CHECK_ENFORCED, maxInstances: 1 },
  async (req) => {
    const ownerUid = requireOwner(req)
    auditAppCheck(req, 'resolveContentReport')
    const reportId = typeof req.data?.reportId === 'string' ? req.data.reportId : ''
    const disposition = req.data?.disposition
    if (!reportId || (disposition !== 'dismiss' && disposition !== 'actioned')) {
      throw new HttpsError('invalid-argument', 'Provide a reportId and disposition of dismiss | actioned.')
    }
    const note = typeof req.data?.note === 'string' ? req.data.note.slice(0, 500) : ''

    const db = getFirestore()
    const ref = db.collection('contentReports').doc(reportId)
    if (!(await ref.get()).exists) throw new HttpsError('not-found', 'No such report.')
    await ref.set(
      {
        status: 'resolved',
        disposition,
        resolutionNote: note,
        resolvedBy: ownerUid,
        resolvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    logger.info('community.resolveContentReport', { reportId, disposition })
    return { ok: true as const }
  },
)
