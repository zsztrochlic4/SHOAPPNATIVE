/**
 * Private friend groups — server-authoritative backend (create / join / leave /
 * delete / goal / transfer / react). Groups are the second half of the community
 * hub; like leagues, every mutation goes through these authenticated functions and
 * clients only READ (membership-gated) — see firestore.rules.
 *
 * Data model:
 *   groupDirectory/{groupId}                  → { name, nameLower, icon, color, memberCount }  (searchable, secret-free)
 *   groups/{groupId}                          → { name, nameLower, passcode, ownerUid, ownerUsername, icon, color, weeklyGoal, memberCount, createdAt }
 *   groups/{groupId}/members/{uid}            → { username, joinedAt, odometer, streak, bestStreak, volume7, volume30, sessionsThisWeek }
 *   groups/{groupId}/reactions/{activityId}/emojis/{emoji}            → { count }
 *   groups/{groupId}/reactions/{activityId}/emojis/{emoji}/users/{uid} → {}
 *
 * Member stats are denormalised snapshots of the user's communityProfiles doc,
 * kept fresh by syncCommunityStats' fan-out. Nothing sensitive is stored — a
 * handle plus consistency numbers, never bodies or logs.
 *
 * STATUS: first implementation, client feature-flagged OFF. Emulator-test the
 * rules + functions and review before enabling + deploying. Callables run in
 * australia-southeast2 (matching the app).
 */
import { FieldValue, getFirestore, type DocumentSnapshot } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { requireVerifiedUser, APP_CHECK_ENFORCED } from './lib/guards'

const REGION = 'australia-southeast2'
const NAME_MIN = 2
const NAME_MAX = 30
const MAX_GROUPS = 50 // per user, matches the sync fan-out cap

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

async function requireProfile(uid: string): Promise<DocumentSnapshot> {
  const prof = await getFirestore().collection('communityProfiles').doc(uid).get()
  if (!prof.exists || !prof.get('username')) {
    throw new HttpsError('failed-precondition', 'Claim a username first.')
  }
  return prof
}

/* --------------------------------- create ---------------------------------- */

interface CreateInput { name?: string; icon?: string; color?: string }

export const createGroup = onCall<CreateInput>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const name = (req.data?.name ?? '').trim()
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new HttpsError('invalid-argument', `Group name must be ${NAME_MIN}–${NAME_MAX} characters.`)
  }
  const db = getFirestore()
  const prof = await requireProfile(uid)
  if ((prof.get('groupIds')?.length ?? 0) >= MAX_GROUPS) {
    throw new HttpsError('resource-exhausted', "You're in too many groups.")
  }

  const groupRef = db.collection('groups').doc()
  const groupId = groupRef.id
  const passcode = generatePasscode()
  const icon = typeof req.data?.icon === 'string' ? req.data.icon : 'dumbbell'
  const color = typeof req.data?.color === 'string' ? req.data.color : '#7ED957'
  const now = FieldValue.serverTimestamp()

  const batch = db.batch()
  batch.set(groupRef, {
    name, nameLower: name.toLowerCase(), passcode, ownerUid: uid,
    ownerUsername: prof.get('username'), icon, color, weeklyGoal: 0, memberCount: 1, createdAt: now,
  })
  batch.set(db.collection('groupDirectory').doc(groupId), {
    name, nameLower: name.toLowerCase(), icon, color, memberCount: 1,
  })
  batch.set(groupRef.collection('members').doc(uid), { ...memberStatsFrom(prof), joinedAt: now })
  batch.set(db.collection('communityProfiles').doc(uid), { groupIds: FieldValue.arrayUnion(groupId) }, { merge: true })
  await batch.commit()

  return { ok: true, groupId, passcode }
})

/* ---------------------------------- join ----------------------------------- */

interface JoinInput { groupId?: string; passcode?: string }

export const joinGroupByPasscode = onCall<JoinInput>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const groupId = (req.data?.groupId ?? '').trim()
  const code = normalizeCode(req.data?.passcode ?? '')
  if (!groupId || !code) throw new HttpsError('invalid-argument', 'A group and passcode are required.')

  const db = getFirestore()
  const prof = await requireProfile(uid)
  const groupRef = db.collection('groups').doc(groupId)
  const group = await groupRef.get()
  if (!group.exists) throw new HttpsError('not-found', 'That group no longer exists.')

  const memberRef = groupRef.collection('members').doc(uid)
  if ((await memberRef.get()).exists) return { ok: true, groupId, name: group.get('name'), already: true }

  if (normalizeCode((group.get('passcode') as string) ?? '') !== code) {
    throw new HttpsError('permission-denied', "That code doesn't match this group.")
  }

  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  batch.set(memberRef, { ...memberStatsFrom(prof), joinedAt: now })
  batch.set(groupRef, { memberCount: FieldValue.increment(1) }, { merge: true })
  batch.set(db.collection('groupDirectory').doc(groupId), { memberCount: FieldValue.increment(1) }, { merge: true })
  batch.set(db.collection('communityProfiles').doc(uid), { groupIds: FieldValue.arrayUnion(groupId) }, { merge: true })
  await batch.commit()

  return { ok: true, groupId, name: group.get('name') }
})

/* ---------------------------------- leave ---------------------------------- */

export const leaveGroup = onCall<{ groupId?: string }>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const groupId = (req.data?.groupId ?? '').trim()
  if (!groupId) throw new HttpsError('invalid-argument', 'A group is required.')

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  const memberRef = groupRef.collection('members').doc(uid)
  if (!(await memberRef.get()).exists) return { ok: true, already: true }

  const batch = db.batch()
  batch.delete(memberRef)
  batch.set(groupRef, { memberCount: FieldValue.increment(-1) }, { merge: true })
  batch.set(db.collection('groupDirectory').doc(groupId), { memberCount: FieldValue.increment(-1) }, { merge: true })
  batch.set(db.collection('communityProfiles').doc(uid), { groupIds: FieldValue.arrayRemove(groupId) }, { merge: true })
  await batch.commit()

  return { ok: true }
})

/* --------------------------------- delete ---------------------------------- */

export const deleteGroup = onCall<{ groupId?: string }>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const groupId = (req.data?.groupId ?? '').trim()
  if (!groupId) throw new HttpsError('invalid-argument', 'A group is required.')

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  const group = await groupRef.get()
  if (!group.exists) return { ok: true, already: true }
  if (group.get('ownerUid') !== uid) {
    throw new HttpsError('permission-denied', 'Only the group owner can delete it.')
  }

  // Pull the group id from every member's profile, delete the directory entry,
  // then recursively remove the group and all its subcollections.
  const members = await groupRef.collection('members').listDocuments()
  let batch = db.batch()
  let ops = 0
  for (const m of members) {
    batch.set(db.collection('communityProfiles').doc(m.id), { groupIds: FieldValue.arrayRemove(groupId) }, { merge: true })
    if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
  }
  batch.delete(db.collection('groupDirectory').doc(groupId))
  await batch.commit()
  await db.recursiveDelete(groupRef)

  return { ok: true }
})

/* -------------------------------- set goal --------------------------------- */

export const setGroupGoal = onCall<{ groupId?: string; goal?: number }>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
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

/* -------------------------- transfer ownership ----------------------------- */

interface TransferInput { groupId?: string; newOwnerUid?: string }

/** Hand ownership of a group to another current member. Owner-only. The previous
 *  owner STAYS in the group — this is the "Make group owner" action, and also the
 *  first half of an owner-leaves-with-successor flow (the client then calls
 *  leaveGroup). Updates the group doc + the directory-visible ownerUsername. */
export const transferGroupOwnership = onCall<TransferInput>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const groupId = (req.data?.groupId ?? '').trim()
  const newOwnerUid = (req.data?.newOwnerUid ?? '').trim()
  if (!groupId || !newOwnerUid) throw new HttpsError('invalid-argument', 'A group and new owner are required.')

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  const [group, newMember] = await Promise.all([
    groupRef.get(),
    groupRef.collection('members').doc(newOwnerUid).get(),
  ])
  if (!group.exists) throw new HttpsError('not-found', 'That group no longer exists.')
  // Owner-only — checked BEFORE the self-transfer no-op so a non-owner can never
  // get a silent ok by naming themselves.
  if (group.get('ownerUid') !== uid) {
    throw new HttpsError('permission-denied', 'Only the group owner can hand it over.')
  }
  if (newOwnerUid === uid) return { ok: true, already: true } // owner → self is a no-op
  if (!newMember.exists) {
    throw new HttpsError('failed-precondition', 'The new owner must be a member of the group.')
  }

  await groupRef.set({ ownerUid: newOwnerUid, ownerUsername: newMember.get('username') ?? '' }, { merge: true })
  return { ok: true }
})

/* --------------------------------- react ----------------------------------- */

// The fixed set of emoji reactions (mirrors REACTION_EMOJIS on the client). Kept
// server-side so a forged emoji can't create an arbitrary reaction bucket.
const REACTION_EMOJIS = new Set(['💪', '🔥', '👏', '🙌', '⚡', '🏆'])

interface ReactInput { groupId?: string; activityId?: string; emoji?: string }

export const reactGroupActivity = onCall<ReactInput>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const groupId = (req.data?.groupId ?? '').trim()
  const activityId = (req.data?.activityId ?? '').trim()
  const emoji = (req.data?.emoji ?? '').trim()
  if (!groupId || !activityId) throw new HttpsError('invalid-argument', 'A group and activity are required.')
  if (!REACTION_EMOJIS.has(emoji)) throw new HttpsError('invalid-argument', 'Unsupported reaction.')

  const db = getFirestore()
  const groupRef = db.collection('groups').doc(groupId)
  // Membership check — only members may react.
  if (!(await groupRef.collection('members').doc(uid).get()).exists) {
    throw new HttpsError('permission-denied', 'Join the group to react.')
  }

  const emojiRef = groupRef.collection('reactions').doc(activityId).collection('emojis').doc(emoji)
  const userRef = emojiRef.collection('users').doc(uid)
  const result = await db.runTransaction(async (tx) => {
    const [emojiSnap, userSnap] = await Promise.all([tx.get(emojiRef), tx.get(userRef)])
    const current = typeof emojiSnap.get('count') === 'number' ? (emojiSnap.get('count') as number) : 0
    if (userSnap.exists) {
      tx.delete(userRef)
      tx.set(emojiRef, { count: Math.max(0, current - 1) }, { merge: true })
      return { mine: false, count: Math.max(0, current - 1) }
    }
    tx.set(userRef, { at: FieldValue.serverTimestamp() })
    tx.set(emojiRef, { count: current + 1 }, { merge: true })
    return { mine: true, count: current + 1 }
  })
  return { ok: true, emoji, ...result }
})
