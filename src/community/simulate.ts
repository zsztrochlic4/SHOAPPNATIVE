/**
 * Local simulation of the multi-user side of the community hub.
 *
 * Until the Firestore backend lands (see src/community/service.ts), the global
 * leaderboard, the joinable-group directory and other members' stats are
 * generated here — deterministically, from a seeded RNG, so ranks and numbers
 * stay STABLE across renders and app restarts (a leaderboard that reshuffled on
 * every mount would feel broken). The current user is never simulated: their row
 * always comes from live activity (selectors.myLeaderStats) and is injected here.
 */
import { makeRng, randInt } from '../lib/rng'
import type { CommunityGroup, GroupMember } from '../store/types'
import type { MyLeaderStats } from '../store/selectors'

/** The pool of handles that already exist in the app — used both to populate the
 *  global board and to answer "is this username taken?". */
export const TAKEN_HANDLES: string[] = [
  'jaydenk', 'sophie_l', 'miar', 'danp', 'leo_t', 'ana_v', 'samw', 'coach_ben',
  'liftqueen', 'ironmike', 'ellie_r', 'tomh', 'priya_s', 'noah_b', 'zara_k',
  'finn_o', 'maya_l', 'deanw', 'ruby_c', 'oscarp', 'ivy_n', 'harryt', 'freya_m',
  'loganb', 'chloe_w', 'maxr', 'isla_g', 'kai_j', 'nina_p', 'reece_d', 'tara_h',
  'beng', 'amelia_k', 'joel_r', 'saanvi', 'dylanm', 'katie_b', 'arjun_p',
  'lucyf', 'ethanw', 'grace_m', 'callum_r', 'yusuf_a', 'holly_b', 'aidenw',
  'sienna_p', 'marcus_l', 'evie_t', 'rohan_s', 'daisy_k',
]

/** Reserved words no one may take (avoids impersonation / confusion). */
const RESERVED_WORDS = new Set([
  'admin', 'administrator', 'coach', 'strengthhub', 'sho', 'support', 'staff',
  'moderator', 'mod', 'official', 'team', 'help', 'root', 'system', 'null',
  'undefined', 'me', 'you',
])

/** Case-insensitive "is this handle already in use by someone else?". `ownHandle`
 *  (the user's current username) is excluded so re-saving the same name is fine. */
export function isHandleTaken(name: string, ownHandle?: string | null): boolean {
  const n = name.trim().toLowerCase()
  if (ownHandle && n === ownHandle.trim().toLowerCase()) return false
  if (RESERVED_WORDS.has(n)) return true
  return TAKEN_HANDLES.some((h) => h.toLowerCase() === n)
}

export interface LeaderRow {
  rank: number
  username: string
  streakCurrent: number
  streakBest: number
  isYou?: boolean
}

/**
 * The global consistency-streak leaderboard: every simulated user plus the live
 * "you" row, ranked by current streak (ties broken by best streak, then name).
 * Deterministic — same input always yields the same board.
 */
export function simulateGlobalBoard(me: MyLeaderStats): { rows: LeaderRow[]; youRank: number | null } {
  const rng = makeRng(0xb0a2d1)
  const base = TAKEN_HANDLES.map((username) => {
    const streakCurrent = randInt(rng, 1, 38)
    const streakBest = streakCurrent + randInt(rng, 0, 20)
    return { username, streakCurrent, streakBest }
  })

  const withYou: Omit<LeaderRow, 'rank'>[] = me.username
    ? [...base, { username: me.username, streakCurrent: me.streakCurrent, streakBest: me.streakBest, isYou: true }]
    : base

  withYou.sort(
    (a, b) =>
      b.streakCurrent - a.streakCurrent ||
      b.streakBest - a.streakBest ||
      a.username.localeCompare(b.username),
  )

  const rows = withYou.map((r, i) => ({ ...r, rank: i + 1 }))
  const youRank = rows.find((r) => r.isYou)?.rank ?? null
  return { rows, youRank }
}

/** A group that can be found by name and joined with its passcode. Members and
 *  their stats stay hidden until the user joins (privacy). */
export interface DiscoverableGroup {
  id: string
  name: string
  passcode: string
  memberCount: number
  icon: string
  color: string
}

export const DISCOVERABLE_GROUPS: DiscoverableGroup[] = [
  { id: 'grp-easthall', name: 'East Hall Grind', passcode: 'EH4M9X', memberCount: 6, icon: 'dumbbell', color: '#7ED957' },
  { id: 'grp-runclub', name: 'Campus Run Club', passcode: 'RUNGO7', memberCount: 8, icon: 'leaf', color: '#3B82F6' },
  { id: 'grp-nightowls', name: 'Night Owls Gym', passcode: 'OWL77Z', memberCount: 4, icon: 'moon', color: '#8B5CF6' },
  { id: 'grp-freshers', name: 'Freshers Fitness', passcode: 'FRSH24', memberCount: 5, icon: 'flame', color: '#F5A524' },
  { id: 'grp-powerhour', name: 'Power Hour', passcode: 'PWR9KT', memberCount: 7, icon: 'target', color: '#EC4899' },
  { id: 'grp-earlybirds', name: 'Early Birds', passcode: 'DAWN52', memberCount: 5, icon: 'trending', color: '#06B6D4' },
]

/** Small string hash → numeric seed, so a group's simulated roster is stable. */
function seedFrom(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Deterministic roster of `count` distinct members for a group, drawn from the
 * handle pool. Never includes the current user — callers inject the live "you"
 * member separately.
 */
export function simulateGroupMembers(groupId: string, count: number): GroupMember[] {
  const rng = makeRng(seedFrom(groupId))
  const pool = [...TAKEN_HANDLES]
  const members: GroupMember[] = []
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const idx = randInt(rng, 0, pool.length - 1)
    const username = pool.splice(idx, 1)[0]
    const volume7 = randInt(rng, 6000, 26000)
    const streak = randInt(rng, 1, 32)
    members.push({
      id: username,
      username,
      odometer: randInt(rng, 18, 96),
      streak,
      bestStreak: streak + randInt(rng, 0, 16),
      volume7,
      volume30: Math.round(volume7 * (3.4 + rng())), // ~3.4–4.4× the 7-day figure
      sessionsThisWeek: randInt(rng, 1, 6),
    })
  }
  return members
}

/** Build the live "you" member row from the user's real stats. */
export function youMember(me: MyLeaderStats): GroupMember {
  return {
    id: me.username ?? 'you',
    username: me.username ?? 'you',
    isYou: true,
    odometer: me.odometer,
    streak: me.streakCurrent,
    bestStreak: me.streakBest,
    volume7: me.volume7,
    volume30: me.volume30,
    sessionsThisWeek: me.sessionsThisWeek,
  }
}

/** Assemble the full CommunityGroup a user gets when they join a directory group:
 *  the simulated roster plus their live "you" row. */
export function buildJoinedGroup(entry: DiscoverableGroup, me: MyLeaderStats, createdAtKey: string): CommunityGroup {
  return {
    id: entry.id,
    name: entry.name,
    passcode: entry.passcode,
    ownerUsername: 'jaydenk', // directory groups are owned by someone else
    createdAtKey,
    members: [youMember(me), ...simulateGroupMembers(entry.id, entry.memberCount)],
    icon: entry.icon,
    color: entry.color,
    // A ~4-sessions-per-member weekly team target.
    weeklyGoal: (entry.memberCount + 1) * 4,
  }
}
