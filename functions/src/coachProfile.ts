import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { APP_CHECK_ENFORCED, requireVerifiedUser } from './lib/guards'
import { getWorkspaceSummary } from './coachWorkspace'
import { sanitizeMultiline } from './_shared/lib/sanitize'

interface PreferenceInput {
  memoryEnabled?: boolean
  proactiveEnabled?: boolean
  coachingStyle?: 'supportive' | 'direct' | 'balanced'
}

interface ConsentInput { memoryEnabled?: boolean }

interface IdInput { id?: string }
interface ProposalDecisionInput extends IdInput { decision?: 'confirm' | 'reject' }

const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value)

export const getCoachWorkspace = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest) => getWorkspaceSummary(requireVerifiedUser(req, 'getCoachWorkspace')),
)

export const grantCoachConsent = onCall<ConsentInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<ConsentInput>) => {
    const uid = requireVerifiedUser(req, 'grantCoachConsent')
    await getFirestore().collection('coachUsers').doc(uid).set({
      schemaVersion: 1,
      consentVersion: 1,
      consentAt: FieldValue.serverTimestamp(),
      memoryEnabled: req.data?.memoryEnabled === true,
      proactiveEnabled: false,
      coachingStyle: 'balanced',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return getWorkspaceSummary(uid)
  },
)

export const revokeCoachConsent = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 120 },
  async (req: CallableRequest) => {
    const uid = requireVerifiedUser(req, 'revokeCoachConsent')
    const db = getFirestore()
    // "Turn off coach & delete coach data" must be literally true (audit
    // F-015): the coach workspace AND safety state AND the synced chat
    // transcripts (users/{uid}/chat + coachThread hold the coach conversation)
    // are all removed. The client clears its local copies alongside.
    await db.recursiveDelete(db.collection('coachUsers').doc(uid))
    await db.collection('coachSafety').doc(uid).delete()
    await db.recursiveDelete(db.collection('users').doc(uid).collection('chat'))
    await db.recursiveDelete(db.collection('users').doc(uid).collection('coachThread'))
    return getWorkspaceSummary(uid)
  },
)

export const updateCoachPreferences = onCall<PreferenceInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<PreferenceInput>) => {
    const uid = requireVerifiedUser(req, 'updateCoachPreferences')
    const input = req.data ?? {}
    const current = await getFirestore().collection('coachUsers').doc(uid).get()
    if (current.get('consentVersion') !== 1) throw new HttpsError('failed-precondition', 'Coach consent is required.')
    const patch: Record<string, unknown> = { schemaVersion: 1, updatedAt: FieldValue.serverTimestamp() }
    if (typeof input.memoryEnabled === 'boolean') patch.memoryEnabled = input.memoryEnabled
    if (typeof input.proactiveEnabled === 'boolean') patch.proactiveEnabled = input.proactiveEnabled
    if (input.coachingStyle && ['supportive', 'direct', 'balanced'].includes(input.coachingStyle)) {
      patch.coachingStyle = input.coachingStyle
    }
    if (Object.keys(patch).length === 2) throw new HttpsError('invalid-argument', 'No valid preference supplied.')
    await getFirestore().collection('coachUsers').doc(uid).set(patch, { merge: true })
    return getWorkspaceSummary(uid)
  },
)

export const deleteCoachMemory = onCall<IdInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<IdInput>) => {
    const uid = requireVerifiedUser(req, 'deleteCoachMemory')
    if (!validId(req.data?.id)) throw new HttpsError('invalid-argument', 'Invalid memory id.')
    await getFirestore().collection('coachUsers').doc(uid).collection('memories').doc(req.data.id).delete()
    return { ok: true }
  },
)

export const clearCoachMemories = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 60 },
  async (req: CallableRequest) => {
    const uid = requireVerifiedUser(req, 'clearCoachMemories')
    await getFirestore().recursiveDelete(getFirestore().collection('coachUsers').doc(uid).collection('memories'))
    return { ok: true }
  },
)

interface FeedbackInput { rating?: 'helpful' | 'not_helpful'; reason?: string }

/**
 * One end-of-chat rating. Writes coachUsers/{uid}/feedback/{id} server-side (Admin SDK, no client-write
 * rules needed; auto-created collection). This is the flywheel: a "not_helpful" rating is reviewed and
 * turned into a case in the coach eval harness, so real mistakes become permanent regression guards. No
 * new Firebase resources beyond deploying this callable at launch.
 */
export const recordCoachFeedback = onCall<FeedbackInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<FeedbackInput>) => {
    const uid = requireVerifiedUser(req, 'recordCoachFeedback')
    const rating = req.data?.rating
    if (rating !== 'helpful' && rating !== 'not_helpful') throw new HttpsError('invalid-argument', 'Invalid rating.')
    const reason = sanitizeMultiline(req.data?.reason ?? '', 500)
    await getFirestore().collection('coachUsers').doc(uid).collection('feedback').doc().set({
      rating,
      reason: reason || null,
      createdAt: FieldValue.serverTimestamp(),
    })
    return { ok: true }
  },
)

export const respondToCoachProposal = onCall<ProposalDecisionInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<ProposalDecisionInput>) => {
    const uid = requireVerifiedUser(req, 'respondToCoachProposal')
    const { id, decision } = req.data ?? {}
    if (!validId(id) || (decision !== 'confirm' && decision !== 'reject')) {
      throw new HttpsError('invalid-argument', 'Invalid proposal response.')
    }
    const ref = getFirestore().collection('coachUsers').doc(uid).collection('proposals').doc(id)
    const actionRef = getFirestore().collection('coachUsers').doc(uid).collection('actions').doc()
    const result = await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new HttpsError('not-found', 'Proposal not found.')
      const data = snap.data()!
      if (data.status !== 'pending') throw new HttpsError('failed-precondition', 'Proposal is no longer pending.')
      const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : Date.parse(String(data.expiresAt))
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        tx.update(ref, { status: 'expired', resolvedAt: FieldValue.serverTimestamp() })
        throw new HttpsError('failed-precondition', 'Proposal expired.')
      }
      tx.update(ref, { status: decision === 'confirm' ? 'confirmed' : 'rejected', resolvedAt: FieldValue.serverTimestamp() })
      tx.set(actionRef, {
        schemaVersion: 1,
        proposalId: id,
        kind: data.kind,
        decision,
        // Audit trail (C-018 / CA-008): a confirm records the APPROVAL and enters a
        // `pending_apply` terminal-pending state. The client reports the real terminal
        // outcome (applied / failed / rolled_back) via recordCoachActionOutcome, so the
        // journal reflects what actually happened, not merely that the user tapped confirm.
        approvedByUser: decision === 'confirm',
        outcome: decision === 'confirm' ? 'pending_apply' : 'rejected_by_user',
        payload: data.payload ?? {},
        createdAt: FieldValue.serverTimestamp(),
      })
      return { id, actionId: actionRef.id, kind: data.kind, payload: data.payload ?? {}, status: decision === 'confirm' ? 'confirmed' : 'rejected' }
    })
    return result
  },
)

/**
 * Record the TERMINAL outcome of a confirmed action (audit C-018 / CA-008). The client calls this
 * after it has applied (or failed to apply / rolled back) a confirmed program change, so the
 * server-side action journal reaches a durable applied/failed/rolled_back state instead of
 * stopping at "approved_by_user". Only a redacted reason CODE is stored — never free text or
 * user data. Idempotent: a terminal state can only advance to rolled_back, never regress.
 */
interface ActionOutcomeInput { actionId?: string; outcome?: 'applied' | 'failed' | 'rolled_back'; reasonCode?: string }
const OUTCOME_VALUES = ['applied', 'failed', 'rolled_back'] as const
const REASON_CODE = /^[a-z0-9_:,-]{1,120}$/

export const recordCoachActionOutcome = onCall<ActionOutcomeInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<ActionOutcomeInput>) => {
    const uid = requireVerifiedUser(req, 'recordCoachActionOutcome')
    const { actionId, outcome, reasonCode } = req.data ?? {}
    if (!validId(actionId) || !outcome || !(OUTCOME_VALUES as readonly string[]).includes(outcome)) {
      throw new HttpsError('invalid-argument', 'Invalid action outcome.')
    }
    if (reasonCode != null && !REASON_CODE.test(String(reasonCode))) {
      throw new HttpsError('invalid-argument', 'Invalid reason code.')
    }
    const ref = getFirestore().collection('coachUsers').doc(uid).collection('actions').doc(actionId)
    await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new HttpsError('not-found', 'Action not found.')
      const current = String(snap.get('outcome') ?? '')
      // Terminal states are final except that an already-applied action may still be rolled back.
      if ((current === 'applied' || current === 'failed') && outcome !== 'rolled_back') return
      if (current === 'rolled_back') return
      tx.update(ref, {
        outcome,
        ...(reasonCode ? { reasonCode: String(reasonCode) } : {}),
        terminalAt: FieldValue.serverTimestamp(),
      })
    })
    return { ok: true }
  },
)
