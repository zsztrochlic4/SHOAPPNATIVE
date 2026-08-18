/**
 * Monthly leagues (Recommendation 1). Users compete in a small cohort each month;
 * the top 30% promote a tier, the bottom 30% relegate, the middle 40% hold. Points
 * are the dashboard odometer (0–100) — recent consistency — so leagues reward
 * showing up, never load or bodies.
 *
 * As with the rest of the hub, the cohort is simulated deterministically here
 * (stable within a period, fresh each reset) and the current user's row is always
 * live. The real promotion/demotion runs server-side on the reset schedule
 * (functions/src/community.ts → rolloverLeagues); this module is what the client
 * renders in between, and the fallback when the backend is off.
 */
import { makeRng, randInt } from '../lib/rng'
import { now } from '../lib/date'
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

/** Percentage of a cohort that promotes / relegates each period (design spec):
 *  top 30% promote, bottom 30% relegate, the middle 40% hold. Computed from the
 *  cohort size so it scales, instead of fixed per-tier counts. */
const ZONE_PCT = 0.3

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** The first Monday of the month containing `d`. */
function firstMondayOfMonth(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const dow = (first.getDay() + 6) % 7 // Mon = 0 … Sun = 6
  return new Date(d.getFullYear(), d.getMonth(), 1 + (dow === 0 ? 0 : 7 - dow))
}

/** Start of the current league period — leagues reset on the FIRST MONDAY of every
 *  month (design spec), so the period id is that Monday's date-key. If today is
 *  before this month's first Monday we're still in last month's period. */
export function leaguePeriodKey(): string {
  const today = startOfDay(now())
  const thisReset = firstMondayOfMonth(today)
  const start = today < thisReset ? firstMondayOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1)) : thisReset
  return ymd(start)
}

/** Whole days left before the league resets (the next first-Monday). Today counts as 1. */
export function daysLeftInPeriod(): number {
  const today = startOfDay(now())
  const thisReset = firstMondayOfMonth(today)
  const nextReset = today < thisReset ? thisReset : firstMondayOfMonth(new Date(today.getFullYear(), today.getMonth() + 1, 1))
  return Math.max(1, Math.round((nextReset.getTime() - today.getTime()) / 86_400_000))
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

/** Which zone a given rank falls in for a tier — top 30% promote, bottom 30%
 *  relegate, middle 40% hold (design spec), gated by whether the tier can move in
 *  that direction (Bronze never relegates, Diamond never promotes). Exported so the
 *  live backend path can label server-returned standings the same way. */
export function zoneFor(rank: number, tier: Tier, cohortSize = tier.cohort): Zone {
  const promoteCount = tier.promote > 0 ? Math.max(1, Math.round(cohortSize * ZONE_PCT)) : 0
  const demoteCount = tier.demote > 0 ? Math.max(1, Math.round(cohortSize * ZONE_PCT)) : 0
  if (promoteCount > 0 && rank <= promoteCount) return 'promote'
  if (demoteCount > 0 && rank > cohortSize - demoteCount) return 'demote'
  return 'safe'
}

/** The rank threshold to promote from this tier's cohort (the top-30% cutoff). */
export function promoteCutoff(tier: Tier, cohortSize = tier.cohort): number {
  return tier.promote > 0 ? Math.max(1, Math.round(cohortSize * ZONE_PCT)) : 0
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
