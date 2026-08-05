/**
 * Private friend groups — server-authoritative backend (create / join / leave /
 * delete / goal / cheer). Groups are the second half of the community hub; like
 * leagues, every mutation goes through these authenticated functions and clients
 * only READ (membership-gated) — see firestore.rules.
 *
 * Data model:
 *   groupDirectory/{groupId}                  → { name, nameLower, icon, color, memberCount }  (searchable, secret-free)
 *   groups/{groupId}                          → { name, nameLower, passcode, ownerUid, ownerUsername, icon, color, weeklyGoal, memberCount, status, createdAt }
 *   groups/{groupId}/members/{uid}            → { username, joinedAt, odometer, streak, bestStreak, volume7, volume30, sessionsThisWeek }
 *   groups/{groupId}/cheers/{activityId}      → { count }
 *   groups/{groupId}/cheers/{activityId}/users/{uid} → {}
 *
 * Member stats are denormalised snapshots of the user's communityProfiles doc,
 * kept fresh by syncCommunityStats' fan-out. Nothing sensitive is stored — a
 * handle plus consistency numbers, never bodies or logs.
 *
 * INTEGRITY (audit F-002 / F-006): membership transitions that touch the bounded
 * per-user slot list (communityProfiles/{uid}.groupIds), the member document and
 * the group/directory counts run inside ONE Firestore transaction, so concurrent
 * requests serialise on the profile doc and counts can't drift or double-count.
 * Every callable audits App Check (monitor while enforcement is off) and applies
 * a per-user daily rate limit, and each callable pins maxInstances to bound cost
 * (audit F-008 / F-024).
 *
 * STATUS: client feature-flagged OFF. Emulator-test the rules + functions and
 * review before enabling + deploying. Callables run in australia-southeast2.
 */
import { FieldValue, getFirestore, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireAuth, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'
import { enforceDailyLimit } from './lib/rateLimit'

const REGION = 'australia-southeast2'
const NAME_MIN = 2
const NAME_MAX = 30
// Per-user group cap. NOTE: the 2026-08-05 audit (F-002) assumed a "five-group"
// product rule; the shipped design uses 50 (matches the sync fan-out cap) and no
// UI/spec text states five. Kept at 50 — change here (one constant) if the owner
// decides the contractual limit is five. The important fix is that the cap is now
// enforced transactionally on create AND join, not the number itself.
const MAX_GROUPS = 50
// Hard cap on active members per group (audit F-010 / F-018): detail reads and
// deletion scale with membership, so bound it. Revisit with evidence.
const MAX_MEMBERS = 500
// Cost bound for the callables (audit F-024) — community is low-QPS; a modest
// ceiling caps runaway fan-out/abuse spend without throttling real use.
const MAX_INSTANCES = 10
const CALL_OPTS = { region: REGION, enforceAppCheck: APP_CHECK_ENFORCED, maxInstances: MAX_INSTANCES }

/** Unambiguous 6-char passcode (no O/0/1/I/L), generated server-side. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function generatePasscode(): string {
  let c = ''
  for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return c
}
const normalizeCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Denormalised member-stats snapshot from a communityProfiles document. */
function memberStatsFrom(prof: DocumentSnapshot): Record<string, unknown> {
  const n = (k: string) => (typeof prof.get(k) === 'number' ? (prof.get(k) as number) : 0)
  return {
    username: (prof.get('username') as string) ?? '',
    odometer: n('points'),
    streak: n('streakCurrent'),
    bestStreak: n('streakBest'),
    volume7: n('volume7'),
    volume30: n('volume30'),
    sessionsThisWeek: n('sessionsThisWeek'),
  }
}

/** Read a profile inside a transaction and assert it has a claimed username. */
async function requireProfileTx(tx: Transaction, uid: string): Promise<DocumentSnapshot> {
  const prof = await tx.get(getFirestore().collection('communityProfiles').doc(uid))
  if (!prof.exists || !prof.get('username')) {
    throw new HttpsError('failed-precondition', 'Claim a username first.')
  }
  return prof
}

const groupIdsOf = (prof: DocumentSnapshot): string[] =>
  Array.isArray(prof.get('groupIds')) ? (prof.get('groupIds') as string[]) : []

/* --------------------------------- create ---------------------------------- */

interface CreateInput { name?: string; icon?: string; color?: string }

export const createGroup = onCall<CreateInput>(CALL_OPTS, async (req) => {
  const uid = requireAuth(req)
  auditAppCheck(req, 'createGroup')
  await enforceDailyLimit('group.create', uid, 20)
  const name = (req.data?.name ?? '').trim()
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new HttpsError('invalid-argument', `Group name must be ${NAME_MIN}–${NAME_MAX} characters.`)
  }
  const db = getFirestore()
  const groupRef = db.collection('groups').doc()
  const groupId = groupRef.id
  const passcode = generatePasscode()
  const icon = typeof req.data?.icon === 'string' ? req.data.icon : 'dumbbell'
  const color = typeof req.data?.color === 'string' ? req.data.color : '#7ED957'

  // One transaction reserves the slot (cap check) and writes every representation
  // together, so two concurrent creates can't both pass a stale count (audit F-002).
  await db.runTransaction(async (tx) => {
    const prof = await requireProfileTx(tx, uid)
    if (groupIdsOf(prof).length >= MAX_GROUPS) {
      throw new HttpsError('resource-exhausted', "You're in too many groups.")
    }
    const now = FieldValue.serverTimestamp()
    tx.set(groupRef, {
      name, nameLower: name.toLowerCase(), passcode, ownerUid: uid,
      ownerUsername: prof.get('username'), icon, color, weeklyGoal: 12,
      memberCount: 1, status: 'active', createdAt: now,
    })
    tx.set(db.collection('groupDirectory').doc(groupId), {
      name, nameLower: name.toLowerCase(), icon, color, memberCount: 1,
    })
    tx.set(groupRef.collection('members').doc(uid), { ...memberStatsFrom(prof), joinedAt: now })
    tx.set(db.collection('communityProfiles').doc(uid), { groupIds: FieldValue.arrayUnion(groupId) }, { merge: true })
  })

  return { ok: true, groupId, passcode }
})

/* ---------------------------------- join ----------------------------------- */

interface JoinInput { groupId?: string; passcode?: string }

export const joinGroupByPasscode = onCall<JoinInput>(CALL_OPTS, async (req) => {
  const uid = requireAuth(req)
  auditAppCheck(req, 'joinGroupByPasscode')
  // Bounds passcode brute-forcing + directory scraping (audit F-008).
  await enforceDailyLimit('group.join', uid, 60)
  const groupId = (req.data?.groupId ?? '').trim()
  const code = normalizeCode(req.data?.passcode ?? '')
  if (!groupId || !code) throw new HttpsError('invalid-argument', 'A group and passcode are required.')

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  const memberRef = groupRef.collection('members').doc(uid)

  // Everything (slot cap, capacity, passcode, membership, counts) decided inside
  // one transaction so concurrent joins can't over-fill or double-count (F-002/F-006).
  const result = await db.runTransaction(async (tx) => {
    const prof = await requireProfileTx(tx, uid)
    const group = await tx.get(groupRef)
    const member = await tx.get(memberRef)
    if (!group.exists || group.get('status') === 'deleting') {
      throw new HttpsError('not-found', 'That group no longer exists.')
    }
    if (member.exists) return { ok: true as const, groupId, name: group.get('name'), already: true }
    if (groupIdsOf(prof).length >= MAX_GROUPS) {
      throw new HttpsError('resource-exhausted', "You're in too many groups.")
    }
    const count = typeof group.get('memberCount') === 'number' ? (group.get('memberCount') as number) : 0
    if (count >= MAX_MEMBERS) {
      throw new HttpsError('failed-precondition', 'This group is full.')
    }
    if (normalizeCode((group.get('passcode') as string) ?? '') !== code) {
      throw new HttpsError('permission-denied', "That code doesn't match this group.")
    }
    const now = FieldValue.serverTimestamp()
    tx.set(memberRef, { ...memberStatsFrom(prof), joinedAt: now })
    tx.set(groupRef, { memberCount: FieldValue.increment(1) }, { merge: true })
    tx.set(db.collection('groupDirectory').doc(groupId), { memberCount: FieldValue.increment(1) }, { merge: true })
    tx.set(db.collection('communityProfiles').doc(uid), { groupIds: FieldValue.arrayUnion(groupId) }, { merge: true })
    return { ok: true as const, groupId, name: group.get('name') }
  })

  return result
})

/* ---------------------------------- leave ---------------------------------- */

export const leaveGroup = onCall<{ groupId?: string }>(CALL_OPTS, async (req) => {
  const uid = requireAuth(req)
  auditAppCheck(req, 'leaveGroup')
  const groupId = (req.data?.groupId ?? '').trim()
  if (!groupId) throw new HttpsError('invalid-argument', 'A group is required.')

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  const memberRef = groupRef.collection('members').doc(uid)

  const result = await db.runTransaction(async (tx) => {
    const group = await tx.get(groupRef)
    const member = await tx.get(memberRef)
    if (!member.exists) return { ok: true as const, already: true }
    // Owners can't silently orphan a group by leaving (audit F-007) — they must
    // transfer ownership (future) or delete it. Authorisation is by uid, not handle.
    if (group.exists && group.get('ownerUid') === uid) {
      throw new HttpsError('failed-precondition', 'Transfer ownership or delete the group before leaving.')
    }
    tx.delete(memberRef)
    tx.set(groupRef, { memberCount: FieldValue.increment(-1) }, { merge: true })
    tx.set(db.collection('groupDirectory').doc(groupId), { memberCount: FieldValue.increment(-1) }, { merge: true })
    tx.set(db.collection('communityProfiles').doc(uid), { groupIds: FieldValue.arrayRemove(groupId) }, { merge: true })
    return { ok: true as const }
  })

  return result
})

/* --------------------------------- delete ---------------------------------- */

export const deleteGroup = onCall<{ groupId?: string }>(CALL_OPTS, async (req) => {
  const uid = requireAuth(req)
  auditAppCheck(req, 'deleteGroup')
  const groupId = (req.data?.groupId ?? '').trim()
  if (!groupId) throw new HttpsError('invalid-argument', 'A group is required.')

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  const group = await groupRef.get()
  if (!group.exists) return { ok: true, already: true }
  if (group.get('ownerUid') !== uid) {
    throw new HttpsError('permission-denied', 'Only the group owner can delete it.')
  }

  // Mark the group `deleting` and remove the directory entry FIRST so no new join
  // can land mid-cleanup (join checks status/existence) — audit F-018.
  await groupRef.set({ status: 'deleting' }, { merge: true })
  await db.collection('groupDirectory').doc(groupId).delete().catch(() => {})

  // Pull the group id from every member's profile (paginated batches), then
  // recursively remove the group and all its subcollections.
  const members = await groupRef.collection('members').listDocuments()
  let batch = db.batch()
  let ops = 0
  for (const m of members) {
    batch.set(db.collection('communityProfiles').doc(m.id), { groupIds: FieldValue.arrayRemove(groupId) }, { merge: true })
    if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
  }
  if (ops > 0) await batch.commit()
  await db.recursiveDelete(groupRef)

  return { ok: true }
})

/* -------------------------------- set goal --------------------------------- */

export const setGroupGoal = onCall<{ groupId?: string; goal?: number }>(CALL_OPTS, async (req) => {
  const uid = requireAuth(req)
  auditAppCheck(req, 'setGroupGoal')
  const groupId = (req.data?.groupId ?? '').trim()
  const goal = Math.max(1, Math.min(200, Math.round(typeof req.data?.goal === 'number' ? req.data.goal : 12)))
  if (!groupId) throw new HttpsError('invalid-argument', 'A group is required.')

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  const group = await groupRef.get()
  if (!group.exists) throw new HttpsError('not-found', 'That group no longer exists.')
  if (group.get('ownerUid') !== uid) {
    throw new HttpsError('permission-denied', 'Only the group owner can change the goal.')
  }
  await groupRef.set({ weeklyGoal: goal }, { merge: true })
  return { ok: true, goal }
})

/* ---------------------------------- cheer ---------------------------------- */

interface CheerInput { groupId?: string; activityId?: string }

// A cheer activity id is a short, opaque token. Bound its length/charset so a
// modified client can't create unbounded arbitrary counter documents (audit F-019).
const ACTIVITY_ID_RE = /^[A-Za-z0-9._:-]{1,64}$/

export const cheerGroupActivity = onCall<CheerInput>(CALL_OPTS, async (req) => {
  const uid = requireAuth(req)
  auditAppCheck(req, 'cheerGroupActivity')
  await enforceDailyLimit('group.cheer', uid, 400)
  const groupId = (req.data?.groupId ?? '').trim()
  const activityId = (req.data?.activityId ?? '').trim()
  if (!groupId || !activityId) throw new HttpsError('invalid-argument', 'A group and activity are required.')
  if (!ACTIVITY_ID_RE.test(activityId)) {
    throw new HttpsError('invalid-argument', 'Invalid activity.')
  }

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  // Membership check — only members may cheer.
  if (!(await groupRef.collection('members').doc(uid).get()).exists) {
    throw new HttpsError('permission-denied', 'Join the group to cheer.')
  }

  const cheerRef = groupRef.collection('cheers').doc(activityId)
  const userRef = cheerRef.collection('users').doc(uid)
  const result = await db.runTransaction(async (tx) => {
    const [cheerSnap, userSnap] = await Promise.all([tx.get(cheerRef), tx.get(userRef)])
    const current = typeof cheerSnap.get('count') === 'number' ? (cheerSnap.get('count') as number) : 0
    if (userSnap.exists) {
      tx.delete(userRef)
      tx.set(cheerRef, { count: Math.max(0, current - 1) }, { merge: true })
      return { mine: false, count: Math.max(0, current - 1) }
    }
    tx.set(userRef, { at: FieldValue.serverTimestamp() })
    tx.set(cheerRef, { count: current + 1 }, { merge: true })
    return { mine: true, count: current + 1 }
  })
  return { ok: true, ...result }
})
