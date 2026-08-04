/**
 * Firestore-backed community adapter (leagues + forgiving streaks).
 *
 * This is the live counterpart to the local simulation in service.ts. It talks to
 * the Cloud Functions + collections defined in functions/src/community.ts and
 * firestore.rules. It is intentionally NOT wired into the running app yet — the
 * feature flag below is OFF — so behaviour is unchanged until the backend has been
 * emulator-tested and deployed. To go live:
 *   1. Deploy: `firebase deploy --only firestore:rules,functions`
 *   2. Emulator-test the rules + functions (test/rules, functions emulator).
 *   3. Flip COMMUNITY_BACKEND to true and route service.ts through these calls.
 */
import { httpsCallable } from 'firebase/functions'
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { auth, db, firebaseEnabled, functions } from '../lib/firebase'
import { COMMUNITY_BACKEND } from './backendConfig'

/** True only when the flag is on AND Firebase is actually configured. */
export function isCommunityBackendOn(): boolean {
  return COMMUNITY_BACKEND && firebaseEnabled && !!functions && !!db
}

function call<I, O>(name: string) {
  if (!firebaseEnabled || !functions) throw new Error('Community backend is not configured')
  return httpsCallable<I, O>(functions, name, { timeout: 20_000 })
}

/* -------------------------------- reads: name ------------------------------ */

/** Is this (canonical, lowercased) username already owned by SOMEONE ELSE?
 *  Reads the `usernames/{name}` uniqueness map. A doc owned by the current user
 *  is not "taken" (lets them re-save their own name). */
export async function isUsernameTakenRemote(canonical: string): Promise<boolean> {
  if (!db) return false
  const snap = await getDoc(doc(db, 'usernames', canonical))
  if (!snap.exists()) return false
  return snap.get('uid') !== auth?.currentUser?.uid
}

/* --------------------------------- writes ---------------------------------- */

/** Claim a unique username (transactional, server-enforced). Throws a
 *  FirebaseError with code `functions/already-exists` when taken. */
export async function claimUsernameRemote(username: string): Promise<{ ok: true; username: string }> {
  const res = await call<{ username: string }, { ok: true; username: string }>('claimUsername')({ username })
  return res.data
}

/** Push this device's honest weekly consistency + streak to the server, which
 *  mirrors it into the current week's league standings. */
export async function syncStatsRemote(stats: {
  points: number
  streakCurrent: number
  streakBest: number
  freezeTokens: number
}): Promise<{ ok: true; tier: number; weekKey: string }> {
  const res = await call<typeof stats, { ok: true; tier: number; weekKey: string }>('syncCommunityStats')(stats)
  return res.data
}

/* ---------------------------------- reads ---------------------------------- */

export interface RemoteStanding { uid: string; username: string; points: number; isYou: boolean }

/** This week's standings for a tier, ranked by points (server-written, read-only).
 *  Each row is tagged `isYou` against the signed-in uid so the UI can highlight it. */
export async function loadLeagueStandingsRemote(weekKey: string, tier: number): Promise<RemoteStanding[]> {
  if (!db) return []
  const myUid = auth?.currentUser?.uid
  const q = query(collection(db, `leagueStandings/${weekKey}/tiers/${tier}/members`), orderBy('points', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({
    uid: d.id,
    username: String(d.get('username') ?? ''),
    points: Number(d.get('points') ?? 0),
    isYou: d.id === myUid,
  }))
}

export interface RemoteCommunityProfile {
  username: string | null
  tier: number
  points: number
  streakCurrent: number
  streakBest: number
  freezeTokens: number
  weekKey: string | null
}

/** The signed-in user's own community profile (tier, points, streak, freezes). */
export async function loadMyCommunityProfile(): Promise<RemoteCommunityProfile | null> {
  const uid = auth?.currentUser?.uid
  if (!db || !uid) return null
  const snap = await getDoc(doc(db, 'communityProfiles', uid))
  if (!snap.exists()) return null
  return {
    username: (snap.get('username') as string) ?? null,
    tier: Number(snap.get('tier') ?? 0),
    points: Number(snap.get('points') ?? 0),
    streakCurrent: Number(snap.get('streakCurrent') ?? 0),
    streakBest: Number(snap.get('streakBest') ?? 0),
    freezeTokens: Number(snap.get('freezeTokens') ?? 0),
    weekKey: (snap.get('weekKey') as string) ?? null,
  }
}
