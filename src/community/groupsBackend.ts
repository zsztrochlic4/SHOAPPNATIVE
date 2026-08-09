/**
 * Firestore-backed adapter for private friend groups â€” the live counterpart to
 * the local simulation in service.ts, talking to functions/src/communityGroups.ts
 * and the membership-gated collections in firestore.rules.
 *
 * Loaded ONLY via dynamic import() when COMMUNITY_BACKEND is on (see backendConfig
 * .ts), so the community bundle never pulls firebase while the flag is off. Not
 * yet wired into the screens â€” a follow-up will route groups.tsx through here the
 * same way LeagueScreen/UsernameSheet route through backend.ts.
 */
import { httpsCallable } from 'firebase/functions'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAt, endAt } from 'firebase/firestore'
import { auth, db, firebaseEnabled, functions } from '../lib/firebase'
import type { CommunityGroup, GroupMember } from '../store/types'

function call<I, O>(name: string) {
  if (!firebaseEnabled || !functions) throw new Error('Community backend is not configured')
  return httpsCallable<I, O>(functions, name, { timeout: 20_000 })
}

/* --------------------------------- writes ---------------------------------- */

export async function createGroupRemote(name: string, icon: string, color: string): Promise<{ groupId: string; passcode: string }> {
  const res = await call<{ name: string; icon: string; color: string }, { ok: true; groupId: string; passcode: string }>('createGroup')({ name, icon, color })
  return { groupId: res.data.groupId, passcode: res.data.passcode }
}

export async function joinGroupRemote(groupId: string, passcode: string): Promise<{ groupId: string; name: string }> {
  const res = await call<{ groupId: string; passcode: string }, { ok: true; groupId: string; name: string }>('joinGroupByPasscode')({ groupId, passcode })
  return { groupId: res.data.groupId, name: res.data.name }
}

export const leaveGroupRemote = (groupId: string) => call<{ groupId: string }, { ok: true }>('leaveGroup')({ groupId }).then(() => {})
export const deleteGroupRemote = (groupId: string) => call<{ groupId: string }, { ok: true }>('deleteGroup')({ groupId }).then(() => {})
export const setGroupGoalRemote = (groupId: string, goal: number) => call<{ groupId: string; goal: number }, { ok: true; goal: number }>('setGroupGoal')({ groupId, goal }).then((r) => r.data.goal)

/** Hand ownership of a group to another member. `newOwnerUid` is the member's uid
 *  (the members-subcollection doc id — GroupMember.id on a server-loaded group). */
export const transferOwnershipRemote = (groupId: string, newOwnerUid: string) =>
  call<{ groupId: string; newOwnerUid: string }, { ok: true }>('transferGroupOwnership')({ groupId, newOwnerUid }).then(() => {})

/** Add/remove one of the caller's emoji reactions on an activity event (toggle). */
export async function reactRemote(groupId: string, activityId: string, emoji: string): Promise<{ emoji: string; mine: boolean; count: number }> {
  const res = await call<{ groupId: string; activityId: string; emoji: string }, { ok: true; emoji: string; mine: boolean; count: number }>('reactGroupActivity')({ groupId, activityId, emoji })
  return { emoji: res.data.emoji, mine: res.data.mine, count: res.data.count }
}

/* ---------------------------------- reads ---------------------------------- */

export interface DirectoryHit { id: string; name: string; icon: string; color: string; memberCount: number }

/** Prefix-search the public group directory by name (case-insensitive). */
export async function searchGroupsRemote(q: string): Promise<DirectoryHit[]> {
  if (!db) return []
  const term = q.trim().toLowerCase()
  const base = collection(db, 'groupDirectory')
  const qy = term
    ? query(base, orderBy('nameLower'), startAt(term), endAt(term + 'ï£¿'), limit(20))
    : query(base, orderBy('memberCount', 'desc'), limit(20))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({
    id: d.id,
    name: String(d.get('name') ?? ''),
    icon: String(d.get('icon') ?? 'dumbbell'),
    color: String(d.get('color') ?? '#7ED957'),
    memberCount: Number(d.get('memberCount') ?? 0),
  }))
}

function memberFrom(id: string, data: Record<string, unknown>, myUid?: string): GroupMember {
  const n = (k: string) => (typeof data[k] === 'number' ? (data[k] as number) : 0)
  const s = data.status
  return {
    id,
    username: String(data.username ?? ''),
    isYou: id === myUid,
    odometer: n('odometer'),
    streak: n('streak'),
    bestStreak: n('bestStreak'),
    volume7: n('volume7'),
    volume30: n('volume30'),
    sessionsThisWeek: n('sessionsThisWeek'),
    // Server already zeroes a non-ok member's metrics; carry status so the UI can
    // label "under review" instead of ranking them (F-003).
    status: s === 'held' || s === 'provisional' ? s : 'ok',
  }
}

/** Load a full group the user belongs to (doc + members), shaped like the store's
 *  CommunityGroup. Returns null if not found or not a member (rules deny the read). */
export async function loadGroupRemote(groupId: string): Promise<CommunityGroup | null> {
  if (!db) return null
  const myUid = auth?.currentUser?.uid
  const gSnap = await getDoc(doc(db, 'groups', groupId))
  if (!gSnap.exists()) return null
  const mSnap = await getDocs(collection(db, `groups/${groupId}/members`))
  const members = mSnap.docs.map((d) => memberFrom(d.id, d.data(), myUid))
  return {
    id: groupId,
    name: String(gSnap.get('name') ?? ''),
    passcode: String(gSnap.get('passcode') ?? ''),
    ownerUsername: String(gSnap.get('ownerUsername') ?? ''),
    createdAtKey: '',
    members,
    icon: (gSnap.get('icon') as string) ?? undefined,
    color: (gSnap.get('color') as string) ?? undefined,
    weeklyGoal: (gSnap.get('weeklyGoal') as number) ?? undefined,
  }
}

/** The groups the signed-in user belongs to (from communityProfiles.groupIds). */
export async function loadMyGroupsRemote(): Promise<CommunityGroup[]> {
  if (!db) return []
  const uid = auth?.currentUser?.uid
  if (!uid) return []
  const prof = await getDoc(doc(db, 'communityProfiles', uid))
  const ids: string[] = Array.isArray(prof.get('groupIds')) ? prof.get('groupIds') : []
  const groups = await Promise.all(ids.map((id) => loadGroupRemote(id)))
  return groups.filter((g): g is CommunityGroup => g !== null)
}
