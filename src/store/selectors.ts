import { currentWeekKeys, dayKey, todayKey, fromKey, toKey, addDays } from '../lib/date'
import type { AppState, HabitDay, WorkoutSession, Profile } from './types'
import {
  workoutPoints,
  strengthProgressFromPoints,
  oneRMSeriesFromPoints,
  bestLiftIdFromPoints,
  volumeByWeekFromPoints,
} from './workoutSummary'
import {
  weeklyIndexCore,
  computeStreak,
  computeCompetitionMetrics,
  dayMeetsGoals,
  type ScoringTargets,
  type DayRecord,
  type TimeContext,
} from '../community/scoring'

/** The competition-scoring goal targets, read from the user's profile. Applied
 *  uniformly across history (matching the app's use of current profile targets). */
export function targetsFrom(p: Profile): ScoringTargets {
  return {
    stepTarget: p.stepTarget,
    sleepTargetH: p.sleepTargetH,
    waterTargetL: p.waterTargetL,
    daysPerWeek: p.daysPerWeek,
  }
}

/** Live client time context for the shared scoring module — reads lib/date's
 *  live-binding clock (frozen in demo, real otherwise). Built per call so the
 *  reassigned `todayKey` binding is always current. */
function clientCtx(): TimeContext {
  return { todayKey, offsetKey: dayKey }
}

/** Normalize AppState into the day-log the shared scoring module consumes — one
 *  record per active day, aggregating habits, completed sessions, self-logged
 *  activities and streak protections. This is also what the community backend
 *  sends the server to recompute from (see src/community/backend.ts). */
export function buildDayRecords(s: AppState): DayRecord[] {
  const map = new Map<string, DayRecord>()
  const get = (k: string): DayRecord => {
    let r = map.get(k)
    if (!r) {
      r = { dayKey: k, hasHabit: false, steps: 0, sleepH: 0, waterL: 0, nutritionScore: 0, sessions: 0, volume: 0, activities: 0, rest: false, freeze: false }
      map.set(k, r)
    }
    return r
  }
  for (const h of s.habits) {
    const r = get(h.dateKey)
    r.hasHabit = true
    r.steps = h.steps
    r.sleepH = h.sleepH
    r.waterL = h.waterL
    r.nutritionScore = h.nutritionScore
  }
  for (const x of completedSessions(s)) {
    const r = get(x.dateKey)
    r.sessions += 1
    r.volume += x.volumeKg
  }
  for (const a of s.activities ?? []) get(a.dateKey).activities += 1
  for (const k of s.community?.restDays ?? []) get(k).rest = true
  for (const k of s.community?.frozenDays ?? []) get(k).freeze = true
  return [...map.values()]
}

/**
 * DEV-ONLY paywall preview. Set `EXPO_PUBLIC_PAYWALL_PREVIEW=1` in a local .env
 * to force the entitlement gate closed so the Paywall renders even in demo mode
 * (where Firebase is off and everyone is normally auto-entitled). Guarded two
 * ways so it can NEVER ship: `__DEV__` (constant-folded out of release bundles)
 * AND the opt-in flag (off by default). Purely a UI preview — the checkout
 * button still has no backend in demo, so it just surfaces its "not configured"
 * error, which is expected. To exit the preview, unset the flag.
 */
const PAYWALL_PREVIEW =
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_PAYWALL_PREVIEW === '1'

export function todayHabit(s: AppState): HabitDay {
  return habitForDay(s, todayKey)
}

/**
 * Whether the user may enter the app past the paywall. The single source of
 * truth for the entitlement gate (see App.tsx AuthGate).
 *
 * - Demo / no backend (`firebaseEnabled === false`): always entitled, so the
 *   preview and local demo never hit a paywall.
 * - Real backend: a `trialing` or `active` subscription grants access. The
 *   subscription is mirrored from the server-authoritative `entitlements/{uid}`
 *   doc by BillingSync; `profile.premium` (a server-written display cache) is a
 *   fallback so a returning user isn't briefly gated before the snapshot lands.
 */
export function isEntitled(s: AppState, firebaseEnabled: boolean): boolean {
  if (PAYWALL_PREVIEW) return false // dev-only: always show the paywall (see flag above)
  if (!firebaseEnabled) return true
  const status = s.subscription?.status
  if (status === 'trialing' || status === 'active') return true
  return s.profile.premium === true
}

/** The logged habit for any day, or a zeroed day if nothing was logged. */
export function habitForDay(s: AppState, key: string = todayKey): HabitDay {
  return (
    s.habits.find((h) => h.dateKey === key) ?? {
      dateKey: key,
      steps: 0,
      sleepH: 0,
      waterL: 0,
      mindsetMin: 0,
      nutritionScore: 0,
      workout: false,
    }
  )
}

export function todaySession(s: AppState): WorkoutSession | undefined {
  return sessionForDay(s, todayKey)
}

export function sessionForDay(s: AppState, key: string = todayKey): WorkoutSession | undefined {
  return s.sessions.find((x) => x.dateKey === key)
}

export function sessionProgress(session?: WorkoutSession) {
  if (!session) return { done: 0, total: 0, pct: 0 }
  const done = session.exercises.filter((ex) => ex.sets.every((set) => set.done) && ex.sets.length > 0).length
  const total = session.exercises.length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/* -------------------------- Weight -------------------------- */
export function weightStats(s: AppState) {
  const sorted = [...s.weights].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const current = sorted.at(-1)?.kg ?? s.profile.startWeightKg
  const fourWeeksAgoKey = dayKey(28)
  const past = [...sorted].reverse().find((w) => w.dateKey <= fourWeeksAgoKey) ?? sorted[0]
  const delta = current - (past?.kg ?? current)
  return { current, delta, start: s.profile.startWeightKg, series: sorted }
}

/* -------------------------- Workouts -------------------------- */
export function completedSessions(s: AppState) {
  return s.sessions.filter((x) => x.completed)
}

export function workoutsThisWeek(s: AppState) {
  const wk = new Set(currentWeekKeys())
  return completedSessions(s).filter((x) => wk.has(x.dateKey)).length
}

export function workoutsInRange(s: AppState, days: number) {
  const cutoff = dayKey(days)
  return completedSessions(s).filter((x) => x.dateKey >= cutoff).length
}

export function totalVolumeRange(s: AppState, days: number) {
  const cutoff = dayKey(days)
  return completedSessions(s)
    .filter((x) => x.dateKey >= cutoff)
    .reduce((a, x) => a + x.volumeKg, 0)
}

/* -------------------------- Streak -------------------------- */
/** Forgiving streaks (Recommendation 2): the definition now lives in the shared
 *  scoring module (src/community/scoring.ts) so the community backend computes the
 *  SAME streak server-side (F-003). A day "counts" if it's protected (rest/freeze)
 *  or its habit meets ≥3 of 4 daily goals. */
export function streakStats(s: AppState) {
  const habitByDay = new Map<string, HabitDay>(s.habits.map((h) => [h.dateKey, h]))
  const protectedDays = new Set([...(s.community?.restDays ?? []), ...(s.community?.frozenDays ?? [])])
  return computeStreak({ habitByDay, protectedDays, targets: targetsFrom(s.profile), ctx: clientCtx() })
}

/** Is yesterday an unprotected miss (so the streak just broke / is about to)?
 *  Drives the "Protect yesterday with a freeze" prompt. */
export function streakRisk(s: AppState): { atRisk: boolean; dayKey: string } {
  const y = dayKey(1)
  const isProtected = (s.community?.restDays ?? []).includes(y) || (s.community?.frozenDays ?? []).includes(y)
  if (isProtected) return { atRisk: false, dayKey: y }
  const h = s.habits.find((x) => x.dateKey === y)
  const met = h ? dayMeetsGoals(h, targetsFrom(s.profile)) : false
  return { atRisk: !met, dayKey: y }
}

/* -------------------------- Nutrition -------------------------- */
export function nutritionForDay(s: AppState, key: string = todayKey) {
  const dayMeals = s.meals.filter((m) => m.dateKey === key)
  const kcal = dayMeals.reduce((a, m) => a + m.kcal * m.qty, 0)
  const p = dayMeals.reduce((a, m) => a + m.p * m.qty, 0)
  const c = dayMeals.reduce((a, m) => a + m.c * m.qty, 0)
  const f = dayMeals.reduce((a, m) => a + m.f * m.qty, 0)
  return { kcal, p, c, f, meals: dayMeals, remaining: Math.max(0, s.profile.calorieTarget - kcal) }
}

export function foodReviewForDay(s: AppState, key: string = todayKey) {
  return s.foodReviews.find((r) => r.dateKey === key) ?? null
}

/** Quick "how did eating go" tag ids chosen for a given day. */
export function nutritionTagsForDay(s: AppState, key: string = todayKey): string[] {
  return s.nutritionTags?.[key] ?? []
}

/** Did the user ask the nutrition coach a question on this day? */
export function nutritionAskedForDay(s: AppState, key: string = todayKey): boolean {
  return (s.nutritionAskedKeys ?? []).includes(key)
}

/** Did the user start a workout on this day? */
export function workoutStartedForDay(s: AppState, key: string = todayKey): boolean {
  return (s.workoutStartedKeys ?? []).includes(key)
}

/* -------------------------- Self-logged activities -------------------------- */
export function activitiesForDay(s: AppState, key: string = todayKey) {
  return (s.activities ?? []).filter((a) => a.dateKey === key)
}

export function activitiesInRange(s: AppState, days: number) {
  const cutoff = dayKey(days)
  return (s.activities ?? []).filter((a) => a.dateKey >= cutoff)
}

/** Activities the user flagged as a regular weekly activity, in a given calendar
 *  week (offset 0 = this week, 1 = last week). These count as "workouts". */
export function weeklyActivitiesInWeek(s: AppState, offset = 0) {
  const wk = new Set(currentWeekKeys().map((k) => toKey(addDays(fromKey(k), -7 * offset))))
  return (s.activities ?? []).filter((a) => a.weekly && wk.has(a.dateKey))
}

/** Prescribed sessions + regular weekly activities for a calendar week. */
export function regularWorkoutsInWeek(s: AppState, offset = 0) {
  const wk = new Set(currentWeekKeys().map((k) => toKey(addDays(fromKey(k), -7 * offset))))
  const sessions = completedSessions(s).filter((x) => wk.has(x.dateKey)).length
  return sessions + weeklyActivitiesInWeek(s, offset).length
}

/** Prescribed sessions + weekly activities in a rolling window of days,
 *  e.g. (6, 0) = the last 7 days, (13, 7) = the 7 days before that. */
export function regularWorkoutsInRange(s: AppState, fromDays: number, toDays = 0) {
  const lo = dayKey(fromDays)
  const hi = dayKey(toDays)
  const inWin = (k: string) => k >= lo && k <= hi
  const sessions = completedSessions(s).filter((x) => inWin(x.dateKey)).length
  const acts = (s.activities ?? []).filter((a) => a.weekly && inWin(a.dateKey)).length
  return sessions + acts
}

/* -------------------------- Strength progress -------------------------- */
/**
 * The all-time strength/volume charts now read the compact WorkoutSummary
 * projection (Phase C Option B, src/store/workoutSummary.ts) via `workoutPoints`
 * instead of scanning full session history, so they stay exact without loading
 * every session on cold start. The math is unchanged — see the regression tests
 * in test/unit/workoutSummary.test.mjs.
 */

/** Most recent loaded session image for a lift (cosmetic thumbnail only). */
function latestLiftImage(s: AppState, defId: string): string {
  let best: { dateKey: string; image: string } | null = null
  for (const sess of s.sessions) {
    const ex = sess.exercises.find((e) => e.defId === defId)
    if (ex?.image && (!best || sess.dateKey >= best.dateKey)) best = { dateKey: sess.dateKey, image: ex.image }
  }
  return best?.image ?? ''
}

export function strengthProgress(s: AppState) {
  return strengthProgressFromPoints(workoutPoints(s)).map((r) => ({ ...r, image: latestLiftImage(s, r.id) }))
}

/** Estimated 1RM per completed session for a lift, chronological. */
export function oneRMSeries(s: AppState, defId: string) {
  return oneRMSeriesFromPoints(workoutPoints(s), defId)
}

/** The lift with the most logged history (for the default strength chart). */
export function bestLiftId(s: AppState): string | null {
  return bestLiftIdFromPoints(workoutPoints(s))
}

/** Total training volume bucketed into the last `weeks` weeks (oldest → newest). */
export function volumeByWeek(s: AppState, weeks = 8) {
  return volumeByWeekFromPoints(workoutPoints(s), weeks)
}

/* -------------------------- Habit consistency (this week) -------------------------- */
/** Habit consistency over the last 7 calendar days (rolling, always out of 7),
 *  so the figure is meaningful even early in a calendar week. */
export function habitConsistency7d(s: AppState) {
  const keys = Array.from({ length: 7 }, (_, i) => dayKey(i))
  const byKey = new Map(s.habits.map((h) => [h.dateKey, h]))
  const days = keys.map((k) => byKey.get(k)).filter(Boolean) as HabitDay[]
  const total = 7
  const workouts = days.filter((h) => h.workout).length
  const steps = days.filter((h) => h.steps >= s.profile.stepTarget * 0.9).length
  const sleep = days.filter((h) => h.sleepH >= s.profile.sleepTargetH * 0.85).length
  const nutrition = days.filter((h) => h.nutritionScore >= 7).length
  const avgSteps = days.length ? Math.round(days.reduce((a, h) => a + h.steps, 0) / days.length) : 0
  const avgSleep = days.length ? days.reduce((a, h) => a + h.sleepH, 0) / days.length : 0
  return { total, workouts, steps, sleep, nutrition, avgSteps, avgSleep }
}

export function habitConsistencyWeek(s: AppState) {
  const wk = currentWeekKeys().filter((k) => k <= todayKey)
  const byKey = new Map(s.habits.map((h) => [h.dateKey, h]))
  const days = wk.map((k) => byKey.get(k)).filter(Boolean) as HabitDay[]
  const total = wk.length
  const workouts = days.filter((h) => h.workout).length
  const steps = days.filter((h) => h.steps >= s.profile.stepTarget * 0.9).length
  const sleep = days.filter((h) => h.sleepH >= s.profile.sleepTargetH * 0.85).length
  const nutrition = days.filter((h) => h.nutritionScore >= 7).length
  const avgSteps = days.length ? Math.round(days.reduce((a, h) => a + h.steps, 0) / days.length) : 0
  const avgSleep = days.length ? days.reduce((a, h) => a + h.sleepH, 0) / days.length : 0
  return { total, workouts, steps, sleep, nutrition, avgSteps, avgSleep }
}

/* -------------------------- Misc -------------------------- */
export function unreadNotifs(s: AppState) {
  return s.notifications.filter((n) => !n.read).length
}

export function unreadChat(s: AppState) {
  return s.chat.filter((m) => m.role === 'coach' && !m.read).length
}

/* -------------------------- Weekly performance index -------------------------- */
export type WeeklyIndex = {
  /** 0..100, where ~50 means "on track" to hit your goals. */
  score: number
  band: 'off' | 'behind' | 'ontrack' | 'ahead' | 'crushing'
  label: string
  blurb: string
  parts: { label: string; pct: number }[]
}

/** Reviews the last 7 days of activity vs the user's targets into a single
 *  needle position. 1.0x of targets = the middle ("on track"). */
export function weeklyIndex(s: AppState): WeeklyIndex {
  const byKey = new Map(s.habits.map((h) => [h.dateKey, h]))
  const last7 = Array.from({ length: 7 }, (_, d) => dayKey(d))
  const days = last7.map((k) => byKey.get(k)).filter(Boolean) as HabitDay[]
  // Count prescribed sessions and self-logged activities. All fitness counts.
  const workouts = workoutsInRange(s, 7) + activitiesInRange(s, 7).length

  // Score + per-dimension ratios come from the shared scoring core so the
  // dashboard odometer and the server-recomputed league points can never drift.
  const { score, ratios: r } = weeklyIndexCore(days, workouts, targetsFrom(s.profile))

  const band: WeeklyIndex['band'] =
    score >= 80 ? 'crushing' : score >= 62 ? 'ahead' : score >= 44 ? 'ontrack' : score >= 28 ? 'behind' : 'off'
  const label = {
    crushing: 'Crushing your goals',
    ahead: 'Ahead of pace',
    ontrack: 'On track',
    behind: 'Slightly behind',
    off: 'Off track',
  }[band]
  const blurb = {
    crushing: 'Outstanding week. You are well past your targets, so keep this rhythm.',
    ahead: 'Strong week. You are pushing beyond your goals nicely.',
    ontrack: 'Right where you want to be. Hold this and the results come.',
    behind: 'A little under pace this week. One or two better days turns it around.',
    off: 'This week slipped. No guilt. Pick one habit and start again today.',
  }[band]

  const pct = (x: number) => Math.round(Math.max(0, Math.min(1.2, x)) * 100)
  const parts = [
    { label: 'Workouts', pct: pct(r.workouts) },
    { label: 'Steps', pct: pct(r.steps) },
    { label: 'Sleep', pct: pct(r.sleep) },
    { label: 'Water', pct: pct(r.water) },
    { label: 'Nutrition', pct: pct(r.nutrition) },
  ]
  return { score, band, label, blurb, parts }
}

/** The current user's live competition stats, sourced from real activity — the
 *  single source the community leaderboards use for the "you" row so a rank
 *  always reflects actual training, not a stored snapshot. */
export function myLeaderStats(s: AppState) {
  // Single source with the server: the same computeCompetitionMetrics runs here
  // over AppState and server-side over the immutable event log (F-003 parity).
  const m = computeCompetitionMetrics({ records: buildDayRecords(s), targets: targetsFrom(s.profile), ctx: clientCtx() })
  return {
    username: s.community.username,
    odometer: m.odometer,
    streakCurrent: m.streakCurrent,
    streakBest: m.streakBest,
    volume7: m.volume7,
    volume30: m.volume30,
    // Sessions logged in the last 7 days (prescribed + self-logged) — the unit the
    // shared weekly team goal counts.
    sessionsThisWeek: m.sessions7,
  }
}

export type MyLeaderStats = ReturnType<typeof myLeaderStats>

export function leaderboardSorted(s: AppState) {
  return [...s.leaderboard].sort((a, b) => b.points - a.points)
}

export function youRank(s: AppState) {
  return leaderboardSorted(s).findIndex((u) => u.isYou) + 1
}
