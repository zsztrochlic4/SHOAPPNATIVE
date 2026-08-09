/**
 * Weekly leagues (Recommendation 1). Users compete in a small cohort for the
 * week; top finishers promote a tier, bottom finishers demote, everyone else
 * holds. Points are this week's consistency — the dashboard odometer (0–100) —
 * so leagues reward showing up, never load or bodies.
 *
 * As with the rest of the hub, the cohort is simulated deterministically here
 * (stable within a week, fresh each week) and the current user's row is always
 * live. The real promotion/demotion runs server-side on a weekly schedule
 * (functions/src/community.ts → rolloverLeagues); this module is what the client
 * renders in between, and the fallback when the backend is off.
 */
import { makeRng, randInt } from '../lib/rng'
import { now, currentWeekKeys } from '../lib/date'
import type { MyLeaderStats } from '../store/selectors'
import { TAKEN_HANDLES } from './simulate'

export interface Tier {
  key: number
  name: string
  color: string
  cohort: number
  /** ranks 1..promote promote up a tier */
  promote: number
  /** the bottom `demote` ranks drop a tier (0 = none) */
  demote: number
}

/** Bronze → Diamond. Higher tiers promote fewer and demote more — the ladder
 *  gets harder, exactly like Duolingo's leagues. */
export const TIERS: Tier[] = [
  { key: 0, name: 'Bronze', color: '#CD7F32', cohort: 25, promote: 10, demote: 0 },
  { key: 1, name: 'Silver', color: '#C7CDD6', cohort: 25, promote: 8, demote: 5 },
  { key: 2, name: 'Gold', color: '#F5C518', cohort: 25, promote: 6, demote: 5 },
  { key: 3, name: 'Platinum', color: '#8FE3D6', cohort: 25, promote: 5, demote: 6 },
  { key: 4, name: 'Diamond', color: '#6AD1E3', cohort: 25, promote: 0, demote: 7 },
]

export const tierOf = (t: number): Tier => TIERS[Math.max(0, Math.min(TIERS.length - 1, t))]

/** Monday date-key of the current week — the stable seed id for the cohort. */
export function weekKey(): string {
  return currentWeekKeys()[0]
}

/** Whole days left before the week resets (Monday). Today counts as 1. */
export function daysLeftInWeek(): number {
  const dow = (now().getDay() + 6) % 7 // Mon = 0 … Sun = 6
  return 7 - dow
}

/* --------------------------- monthly league period ------------------------- */
// BACKEND: standings reset on the FIRST MONDAY of every month (monthly, not
// weekly). Users are also granted 2 freezes at each monthly reset. See
// functions/src/community.ts (rolloverLeagues / grantStreakFreezes).

/** Date of the first Monday of a given month (local time). */
function firstMondayOf(year: number, monthIndex0: number): Date {
  const first = new Date(year, monthIndex0, 1)
  const date = 1 + ((8 - first.getDay()) % 7) // getDay: Sun=0…Sat=6
  return new Date(year, monthIndex0, date)
}

/** The reset boundary of the current monthly league period — the next first-Monday
 *  strictly after today (this month's, or next month's if we're already past it). */
function nextMonthlyReset(from = now()): Date {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const thisMonth = firstMondayOf(today.getFullYear(), today.getMonth())
  if (thisMonth > today) return thisMonth
  return firstMondayOf(today.getFullYear(), today.getMonth() + 1)
}

/** Stable id of the current monthly league period (its first-Monday date-key).
 *  Used to grant the monthly freezes idempotently and partition standings. */
export function monthlyResetKey(from = now()): string {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const thisMonth = firstMondayOf(today.getFullYear(), today.getMonth())
  // The period that started on the most recent first-Monday on or before today.
  const start = today >= thisMonth ? thisMonth : firstMondayOf(today.getFullYear(), today.getMonth() - 1)
  const y = start.getFullYear()
  const m = String(start.getMonth() + 1).padStart(2, '0')
  const d = String(start.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Whole days left before the monthly reset (first Monday). Today counts as 1. */
export function daysLeftInMonth(from = now()): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const boundary = nextMonthlyReset(from)
  return Math.max(1, Math.round((boundary.getTime() - today.getTime()) / 86400000))
}

export type Zone = 'promote' | 'safe' | 'demote'

export interface LeagueRow {
  rank: number
  username: string
  points: number
  isYou?: boolean
  zone: Zone
}

function seedFrom(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

/** Which zone a given rank falls in for a tier. Exported so the live backend
 *  path can label server-returned standings the same way the simulation does.
 *  BACKEND: promotion zones are percentage-based for scale — the top 30% promote
 *  and the bottom 30% relegate (computed from league size); the middle 40% hold.
 *  Tier edges are respected: Bronze never demotes, Diamond never promotes. */
export function zoneFor(rank: number, tier: Tier, cohortSize = tier.cohort): Zone {
  const promoteN = tier.promote > 0 ? Math.max(1, Math.round(cohortSize * 0.3)) : 0
  const demoteN = tier.demote > 0 ? Math.max(1, Math.round(cohortSize * 0.3)) : 0
  if (rank <= promoteN) return 'promote'
  if (demoteN > 0 && rank > cohortSize - demoteN) return 'demote'
  return 'safe'
}

/**
 * This week's standings for the user's tier: simulated cohort + the live "you"
 * row, ranked by points, each tagged with its promotion/safe/demotion zone.
 */
export function simulateLeague(me: MyLeaderStats, tier: Tier, wk: string): {
  rows: LeagueRow[]
  youRank: number
  zone: Zone
} {
  const rng = makeRng(seedFrom(`${tier.key}:${wk}`))
  const pool = [...TAKEN_HANDLES]
  const others: { username: string; points: number }[] = []
  for (let i = 0; i < tier.cohort - 1 && pool.length; i++) {
    const idx = randInt(rng, 0, pool.length - 1)
    const username = pool.splice(idx, 1)[0]
    // Higher tiers skew to higher weekly points.
    const floor = 20 + tier.key * 8
    others.push({ username, points: randInt(rng, floor, 100) })
  }

  const youName = me.username ?? 'you'
  const all = [...others, { username: youName, points: me.odometer, isYou: true as const }]
  all.sort((a, b) => b.points - a.points || a.username.localeCompare(b.username))

  const rows: LeagueRow[] = all.map((r, i) => ({
    rank: i + 1,
    username: r.username,
    points: r.points,
    isYou: 'isYou' in r ? r.isYou : undefined,
    zone: zoneFor(i + 1, tier),
  }))
  const you = rows.find((r) => r.isYou)!
  return { rows, youRank: you.rank, zone: you.zone }
}
