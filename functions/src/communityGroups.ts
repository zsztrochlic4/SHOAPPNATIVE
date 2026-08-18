/**
 * Private friend groups — server-authoritative backend (create / join / leave /
 * delete / goal / cheer). Groups are the second half of the community hub; like
 * leagues, every mutation goes through these authenticated functions and clients
 * only READ (membership-gated) — see firestore.rules.
 *
 * Data model:
 *   groupDirectory/{groupId}                  → { name, nameLower, icon, color, memberCount }  (searchable, secret-free)
 *   groups/{groupId}                          → { name, nameLower, passcode, ownerUid, ownerUsername, icon, color, weeklyGoal, memberCount, createdAt }
 *   groups/{groupId}/members/{uid}            → { username, joinedAt, odometer, streak, bestStreak, volume7, volume30, sessionsThisWeek }
 *   groups/{groupId}/cheers/{activityId}      → { count }
 *   groups/{groupId}/cheers/{activityId}/users/{uid} → {}
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
import { screenGroupName } from './_shared/community/contentModeration'

const REGION = 'australia-southeast2'
const NAME_MIN = 2
const NAME_MAX = 30
const MAX_GROUPS = 10 // per user: generous for real overlap (gym/dorm/friends), bounds sync fan-out

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

interface CreateInput { name?: string; icon?: string; color?: string; visibility?: string }

/** Reserve a unique passcode → groupId lookup so a PRIVATE group (absent from the
 *  searchable directory) can still be joined by its short code. Retries on the
 *  (astronomically rare) collision. Returns the claimed code. */
async function reserveUniqueCode(db: FirebaseFirestore.Firestore): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generatePasscode()
    if (!(await db.collection('groupCodes').doc(code).get()).exists) return code
  }
  throw new HttpsError('resource-exhausted', 'Could not allocate a group code. Try again.')
}

export const createGroup = onCall<CreateInput>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const name = (req.data?.name ?? '').trim()
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new HttpsError('invalid-argument', `Group name must be ${NAME_MIN}–${NAME_MAX} characters.`)
  }
  const nameScreen = screenGroupName(name)
  if (!nameScreen.ok) throw new HttpsError('invalid-argument', nameScreen.reason)
  // Private by default; only an explicit opt-in lists the group in the searchable
  // directory. Both kinds are joinable by their short code.
  const visibility = req.data?.visibility === 'public' ? 'public' : 'private'
  const db = getFirestore()
  const prof = await requireProfile(uid)
  if ((prof.get('groupIds')?.length ?? 0) >= MAX_GROUPS) {
    throw new HttpsError('resource-exhausted', "You're in too many groups.")
  }

  const groupRef = db.collection('groups').doc()
  const groupId = groupRef.id
  const passcode = await reserveUniqueCode(db)
  const icon = typeof req.data?.icon === 'string' ? req.data.icon : 'dumbbell'
  const color = typeof req.data?.color === 'string' ? req.data.color : '#7ED957'
  const now = FieldValue.serverTimestamp()

  const batch = db.batch()
  batch.set(groupRef, {
    name, nameLower: name.toLowerCase(), passcode, visibility, ownerUid: uid,
    ownerUsername: prof.get('username'), icon, color, weeklyGoal: 12, memberCount: 1, createdAt: now,
  })
  batch.set(db.collection('groupCodes').doc(passcode), { groupId })
  // The directory carries `visibility`; firestore.rules only allows LISTing public
  // rows, so a private group's entry is never returned by search (get-by-id only).
  batch.set(db.collection('groupDirectory').doc(groupId), {
    name, nameLower: name.toLowerCase(), icon, color, memberCount: 1, visibility,
  })
  batch.set(groupRef.collection('members').doc(uid), { ...memberStatsFrom(prof), joinedAt: now })
  batch.set(db.collection('communityProfiles').doc(uid), { groupIds: FieldValue.arrayUnion(groupId) }, { merge: true })
  await batch.commit()

  return { ok: true, groupId, passcode, visibility }
})

/* ---------------------------------- join ----------------------------------- */

/** Add `uid` to `group` as a member (shared by the passcode + code join paths).
 *  Assumes the caller has already authorised the join. Idempotent. */
async function performJoin(
  db: FirebaseFirestore.Firestore,
  uid: string,
  prof: DocumentSnapshot,
  groupRef: FirebaseFirestore.DocumentReference,
  group: DocumentSnapshot,
): Promise<{ ok: true; groupId: string; name: unknown; already?: boolean }> {
  const groupId = groupRef.id
  const memberRef = groupRef.collection('members').doc(uid)
  if ((await memberRef.get()).exists) return { ok: true, groupId, name: group.get('name'), already: true }

  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  batch.set(memberRef, { ...memberStatsFrom(prof), joinedAt: now })
  batch.set(groupRef, { memberCount: FieldValue.increment(1) }, { merge: true })
  batch.set(db.collection('groupDirectory').doc(groupId), { memberCount: FieldValue.increment(1) }, { merge: true })
  batch.set(db.collection('communityProfiles').doc(uid), { groupIds: FieldValue.arrayUnion(groupId) }, { merge: true })
  await batch.commit()
  return { ok: true, groupId, name: group.get('name') }
}

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

  if (normalizeCode((group.get('passcode') as string) ?? '') !== code) {
    throw new HttpsError('permission-denied', "That code doesn't match this group.")
  }
  return performJoin(db, uid, prof, groupRef, group)
})

/** Join by short code alone — the path for PRIVATE groups (not in the directory,
 *  so the client has no groupId to pass). Resolves groupCodes/{code} → group. */
export const joinGroupByCode = onCall<{ code?: string }>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED, maxInstances: 1 }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const code = normalizeCode(req.data?.code ?? '')
  if (!code) throw new HttpsError('invalid-argument', 'A code is required.')

  const db = getFirestore()
  const prof = await requireProfile(uid)
  const codeSnap = await db.collection('groupCodes').doc(code).get()
  if (!codeSnap.exists) throw new HttpsError('not-found', "That code doesn't match any group.")
  const groupRef = db.collection('groups').doc(String(codeSnap.get('groupId')))
  const group = await groupRef.get()
  if (!group.exists) throw new HttpsError('not-found', 'That group no longer exists.')
  return performJoin(db, uid, prof, groupRef, group)
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
  const code = normalizeCode((group.get('passcode') as string) ?? '')
  if (code) batch.delete(db.collection('groupCodes').doc(code))
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

/* ---------------------------------- cheer ---------------------------------- */

interface CheerInput { groupId?: string; activityId?: string }

export const cheerGroupActivity = onCall<CheerInput>({ region: REGION, enforceAppCheck: APP_CHECK_ENFORCED }, async (req) => {
  const uid = requireVerifiedUser(req, 'communityGroups')
  const groupId = (req.data?.groupId ?? '').trim()
  const activityId = (req.data?.activityId ?? '').trim()
  if (!groupId || !activityId) throw new HttpsError('invalid-argument', 'A group and activity are required.')

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
