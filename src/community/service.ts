/**
 * Community data service — the single seam between the UI and "where community
 * data lives". Today every call resolves against local simulation (src/community
 * /simulate.ts) with a touch of latency so the loading/empty/error states are
 * real; when the Firestore backend lands, only this file changes — the screens,
 * store actions and result types stay exactly as they are.
 *
 * Every operation returns a discriminated result (never throws for expected
 * outcomes like "name taken" or "wrong code") so callers render precise, helpful
 * messages instead of a generic failure.
 */
import type { CommunityGroup } from '../store/types'
import type { MyLeaderStats } from '../store/selectors'
import { generatePasscode, passcodeMatches } from './passcode'
import {
  DISCOVERABLE_GROUPS,
  buildJoinedGroup,
  isHandleTaken,
  simulateGlobalBoard,
  youMember,
  type DiscoverableGroup,
  type LeaderRow,
} from './simulate'
import { COMMUNITY_BACKEND } from './backendConfig'

/** Simulated network latency so skeletons/spinners are exercised. Kept short. */
const LATENCY = { username: 420, board: 520, search: 320, mutate: 460 } as const
const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

/* --------------------------------- Username -------------------------------- */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

export type UsernameValidation =
  | { ok: true; canonical: string }
  | { ok: false; message: string }

/** Pure, synchronous format check — safe to run on every keystroke. Usernames are
 *  lowercased canonically (like a handle) so uniqueness is case-insensitive. */
export function validateUsername(raw: string): UsernameValidation {
  const canonical = raw.trim().toLowerCase()
  if (!canonical) return { ok: false, message: 'Pick a username' }
  if (canonical.length < USERNAME_MIN) return { ok: false, message: `At least ${USERNAME_MIN} characters` }
  if (canonical.length > USERNAME_MAX) return { ok: false, message: `At most ${USERNAME_MAX} characters` }
  if (!/^[a-z0-9_]+$/.test(canonical)) return { ok: false, message: 'Letters, numbers and underscores only' }
  if (!/^[a-z0-9]/.test(canonical)) return { ok: false, message: 'Start with a letter or number' }
  return { ok: true, canonical }
}

export type UsernameAvailability =
  | { status: 'available'; canonical: string }
  | { status: 'invalid'; message: string }
  | { status: 'taken'; message: string }
  | { status: 'error'; message: string }

/** Async availability check (format + uniqueness). `ownHandle` lets a user
 *  re-save their current name without it reporting "taken". */
export async function checkUsernameAvailable(raw: string, ownHandle?: string | null): Promise<UsernameAvailability> {
  const v = validateUsername(raw)
  if (!v.ok) return { status: 'invalid', message: v.message }
  try {
    if (COMMUNITY_BACKEND) {
      // Live: read the server-side uniqueness map (firebase loaded on demand).
      const backend = await import('./backend')
      if (backend.isCommunityBackendOn()) {
        const taken = await backend.isUsernameTakenRemote(v.canonical)
        return taken
          ? { status: 'taken', message: 'That username is taken' }
          : { status: 'available', canonical: v.canonical }
      }
    }
    // Local simulation.
    await wait(LATENCY.username)
    if (isHandleTaken(v.canonical, ownHandle)) {
      return { status: 'taken', message: 'That username is taken' }
    }
    return { status: 'available', canonical: v.canonical }
  } catch {
    return { status: 'error', message: "Couldn't check that username. Try again." }
  }
}

/* ------------------------------- Leaderboard ------------------------------- */

export async function loadGlobalBoard(me: MyLeaderStats): Promise<{ rows: LeaderRow[]; youRank: number | null }> {
  await wait(LATENCY.board)
  return simulateGlobalBoard(me)
}

/* --------------------------------- Groups ---------------------------------- */

export type CreateGroupResult =
  | { ok: true; group: CommunityGroup }
  | { ok: false; message: string }

/** Create a brand-new group owned by the current user. Starts with just the
 *  owner — friends join later with the generated passcode. */
export async function createGroup(
  rawName: string,
  me: MyLeaderStats,
  todayKey: string,
  existing: CommunityGroup[],
  appearance?: { icon?: string; color?: string },
): Promise<CreateGroupResult> {
  const name = rawName.trim()
  if (name.length < 2) return { ok: false, message: 'Give your group a name' }
  if (name.length > 30) return { ok: false, message: 'Keep the name under 30 characters' }
  if (!me.username) return { ok: false, message: 'Set a username first' }
  if (existing.some((g) => g.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: "You're already in a group with that name" }
  }
  try {
    await wait(LATENCY.mutate)
    const passcode = generatePasscode()
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
    const group: CommunityGroup = {
      id: `grp-${slug || 'group'}-${passcode.toLowerCase()}`,
      name,
      passcode,
      ownerUsername: me.username,
      createdAtKey: todayKey,
      members: [youMember(me)],
      icon: appearance?.icon,
      color: appearance?.color,
      // New groups start with NO team goal — the owner sets one from the detail
      // sheet (design spec). 0 = unset.
      weeklyGoal: 0,
    }
    return { ok: true, group }
  } catch {
    return { ok: false, message: "Couldn't create the group. Try again." }
  }
}

/** Search the joinable directory by name (case-insensitive). Only the name and
 *  member count are returned — the roster stays private until the user joins.
 *  Groups the user already belongs to are filtered out. */
export async function searchGroups(query: string, joinedIds: string[]): Promise<DiscoverableGroup[]> {
  await wait(LATENCY.search)
  const q = query.trim().toLowerCase()
  const joined = new Set(joinedIds)
  return DISCOVERABLE_GROUPS.filter(
    (g) => !joined.has(g.id) && (q === '' || g.name.toLowerCase().includes(q)),
  )
}

export type JoinResult =
  | { ok: true; group: CommunityGroup }
  | { ok: false; reason: 'duplicate' | 'badcode' | 'error'; message: string }

/** Join a selected directory group by entering its passcode. Enforces the correct
 *  code and blocks duplicate membership. */
export async function joinGroup(
  entry: DiscoverableGroup,
  code: string,
  me: MyLeaderStats,
  todayKey: string,
  joinedIds: string[],
): Promise<JoinResult> {
  if (joinedIds.includes(entry.id)) {
    return { ok: false, reason: 'duplicate', message: "You're already in this group" }
  }
  if (!passcodeMatches(entry.passcode, code)) {
    return { ok: false, reason: 'badcode', message: "That code doesn't match this group" }
  }
  try {
    await wait(LATENCY.mutate)
    return { ok: true, group: buildJoinedGroup(entry, me, todayKey) }
  } catch {
    return { ok: false, reason: 'error', message: "Couldn't join the group. Try again." }
  }
}

export type { LeaderRow, DiscoverableGroup }
