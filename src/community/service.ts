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
import { screenUsername, screenGroupName } from './contentModeration'

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
  // Content moderation (reserved handles + profanity) — the same screen the server
  // enforces, run here for instant feedback while typing.
  const screen = screenUsername(canonical)
  if (!screen.ok) return { ok: false, message: screen.reason }
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
  if (COMMUNITY_BACKEND) {
    try {
      // Live: the global streak board is a server aggregate (communityProfiles is list-forbidden), so it
      // comes back through the `globalStreaks` callable. Map to the UI row shape; tag the caller's row.
      const backend = await import('./backend')
      if (backend.isCommunityBackendOn()) {
        const res = await backend.loadGlobalStreaksRemote(50)
        const rows: LeaderRow[] = res.rows.map((r, i) => ({
          rank: i + 1,
          uid: r.uid,
          username: r.username,
          streakCurrent: r.streakCurrent,
          streakBest: r.streakBest,
          isYou: !!res.me && res.me.uid === r.uid,
        }))
        // If the caller has a synced profile but isn't in the top-N, append their own ranked row.
        if (res.me && res.youRank && !rows.some((r) => r.isYou)) {
          rows.push({ rank: res.youRank, username: res.me.username, streakCurrent: res.me.streakCurrent, streakBest: res.me.streakBest, isYou: true })
        }
        return { rows, youRank: res.youRank }
      }
    } catch {
      // Fall through to local simulation on any backend/availability error.
    }
  }
  await wait(LATENCY.board)
  return simulateGlobalBoard(me)
}

/* ------------------------------- Moderation -------------------------------- */

export type ReportReason = 'offensive_name' | 'harassment' | 'impersonation' | 'cheating' | 'other'

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'offensive_name', label: 'Offensive name' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'cheating', label: 'Cheating' },
  { value: 'other', label: 'Something else' },
]

/** File a moderation report against a username or group. Live path goes to the
 *  owner-triaged queue; with the backend off it accepts locally (simulation) so
 *  the flow is exercisable. Never throws for the expected outcomes. */
export async function reportContent(input: {
  targetType: 'user' | 'group'
  targetId: string
  targetLabel?: string
  reason: ReportReason
  note?: string
}): Promise<{ ok: boolean }> {
  if (COMMUNITY_BACKEND) {
    try {
      const backend = await import('./backend')
      if (backend.isCommunityBackendOn()) {
        await backend.reportContentRemote(input)
        return { ok: true }
      }
    } catch {
      return { ok: false }
    }
  }
  await wait(LATENCY.mutate)
  return { ok: true }
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
  const nameScreen = screenGroupName(name)
  if (!nameScreen.ok) return { ok: false, message: nameScreen.reason }
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
      // A friendly starting target; the owner can adjust it as friends join.
      weeklyGoal: 12,
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
