/**
 * The gate + payload sanitisation for posting stats to the competitive community
 * backend (`syncCommunityStats`). Pure and unit-testable.
 *
 * WHO may post — `shouldPostCommunityStats`. The seeded "Alex" DEMO runs on a FROZEN
 * clock (see `src/lib/date.ts`): every workout logged while exploring the demo is
 * stamped with the same `dateKey`, so via `buildDayRecords` they collapse onto one
 * day and trip the server's `impossible_session_cadence` anti-cheat rule
 * (> 6 sessions/day → `held`), pulling the account off the ladder for no real reason.
 * A demo account is not a real competitor and must never enter that pipeline.
 *
 * WHAT is posted — `clampDayCadence`. Custom / quick workouts get a fresh
 * `custom-${Date.now()}` id each time (src/store/programSession.ts), so repeatedly
 * logging on ONE day stacks distinct completed records that `buildDayRecords` sums.
 * An honest client should never SELF-REPORT an implausible cadence and trip the same
 * anti-cheat rule, so we clamp each day's counts to the plausibility ceiling before
 * sending. The server-side rule is UNCHANGED and still catches crafted payloads from
 * modified clients (which never run this code).
 */
import type { DayRecord } from './scoring'
import { ANOMALY_CONFIG } from './anomaly'

export interface CommunitySyncContext {
  /** The community backend feature flag is on. */
  backendOn: boolean
  /** The user has claimed a username (i.e. is participating). */
  hasUsername: boolean
  /** True only for the seeded "Alex" demo, which runs on a frozen clock. */
  demo: boolean
}

export function shouldPostCommunityStats(ctx: CommunitySyncContext): boolean {
  return ctx.backendOn && ctx.hasUsername && !ctx.demo
}

/**
 * Bound each day's session/activity counts to the anti-cheat plausibility ceiling
 * before the payload is sent. Honest same-day logging can never then self-trip
 * `impossible_session_cadence`. Returns the same array reference contents untouched
 * when nothing needs clamping (stable identity per record). Pure.
 */
export function clampDayCadence(records: DayRecord[]): DayRecord[] {
  const maxS = ANOMALY_CONFIG.maxSessionsPerDay
  const maxA = ANOMALY_CONFIG.maxActivitiesPerDay
  return records.map((r) =>
    r.sessions > maxS || r.activities > maxA
      ? { ...r, sessions: Math.min(r.sessions, maxS), activities: Math.min(r.activities, maxA) }
      : r,
  )
}
