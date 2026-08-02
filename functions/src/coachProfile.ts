import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { APP_CHECK_ENFORCED, requireVerifiedUser } from './lib/guards'
import { getWorkspaceSummary } from './coachWorkspace'

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
  async (req: CallableRequest) => getWorkspaceSummary(requireVerifiedUser(req)),
)

export const grantCoachConsent = onCall<ConsentInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<ConsentInput>) => {
    const uid = requireVerifiedUser(req)
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
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 60 },
  async (req: CallableRequest) => {
    const uid = requireVerifiedUser(req)
    const db = getFirestore()
    await db.recursiveDelete(db.collection('coachUsers').doc(uid))
    await db.collection('coachSafety').doc(uid).delete()
    return getWorkspaceSummary(uid)
  },
)

export const updateCoachPreferences = onCall<PreferenceInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<PreferenceInput>) => {
    const uid = requireVerifiedUser(req)
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
    const uid = requireVerifiedUser(req)
    if (!validId(req.data?.id)) throw new HttpsError('invalid-argument', 'Invalid memory id.')
    await getFirestore().collection('coachUsers').doc(uid).collection('memories').doc(req.data.id).delete()
    return { ok: true }
  },
)

export const clearCoachMemories = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 60 },
  async (req: CallableRequest) => {
    const uid = requireVerifiedUser(req)
    await getFirestore().recursiveDelete(getFirestore().collection('coachUsers').doc(uid).collection('memories'))
    return { ok: true }
  },
)

export const respondToCoachProposal = onCall<ProposalDecisionInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30 },
  async (req: CallableRequest<ProposalDecisionInput>) => {
    const uid = requireVerifiedUser(req)
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
        outcome: decision === 'confirm' ? 'approved_by_user' : 'rejected_by_user',
        payload: data.payload ?? {},
        createdAt: FieldValue.serverTimestamp(),
      })
      return { id, kind: data.kind, payload: data.payload ?? {}, status: decision === 'confirm' ? 'confirmed' : 'rejected' }
    })
    return result
  },
)
