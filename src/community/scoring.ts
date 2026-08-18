/**
 * Shared competition scoring — the SINGLE source of truth for the league/group
 * metrics, run identically on the client (display) and the server (authoritative
 * recompute). This is the F-003 remediation core: the server must derive
 * `odometer`/`streak`/`volume`/`sessions` itself rather than trusting whatever a
 * client posts, and it must produce the *same* numbers the app shows — so both
 * sides call these exact functions.
 *
 * PURITY CONTRACT — this file is copied verbatim into the Cloud Functions bundle
 * by functions/scripts/sync-shared.mjs, so it MUST stay portable:
 *   - no imports from ../lib/date (live device clock), firebase, or React
 *   - all time context is INJECTED (`todayKey`, `offsetKey`) by the caller
 * The client injects lib/date's live-binding helpers; the server injects its
 * Australia/Sydney civil-date helpers (functions/src/community.ts).
 *
 * The math here is a verbatim extraction of the former inline logic in
 * src/store/selectors.ts (weeklyIndex, streakStats, totalVolumeRange,
 * workoutsInRange + activitiesInRange). test/unit/communityScoring.test.mjs pins
 * client↔server parity against seeded state so a refactor can't silently drift.
 */

/** Bump on ANY change to the definitions below. Stamped onto every standing so
 *  stale rows are detectable and a reprocessing sweep can re-score them.
 *  v2: odometer window widened from 7 to 14 days (design spec). */
export const CALC_VERSION = 'v2'

/** The user's goal targets, applied uniformly across history (exactly as the app
 *  applies current `profile` targets to all days). Self-reported, so the server
 *  additionally floor-clamps these before scoring — see clampTargets. */
export interface ScoringTargets {
  stepTarget: number
  sleepTargetH: number
  waterTargetL: number
  daysPerWeek: number
}

/** One normalized day of competition-relevant activity. Absent days are simply
 *  not in the array (matches the app treating a missing habit entry as "no data",
 *  not "zeroes"). `hasHabit` distinguishes a logged habit day (counts toward the
 *  odometer average + streak) from a day that only carries a workout/activity. */
export interface DayRecord {
  dayKey: string
  hasHabit: boolean
  steps: number
  sleepH: number
  waterL: number
  /** 0..10 nutrition adherence score */
  nutritionScore: number
  /** completed *prescribed* sessions logged that day */
  sessions: number
  /** training volume (kg) from those completed sessions */
  volume: number
  /** self-logged activities that day (all count toward "workouts") */
  activities: number
  /** day marked a rest day (protects the streak) */
  rest: boolean
  /** day protected by a spent freeze token (protects the streak) */
  freeze: boolean
}

/** Minimal habit shape the odometer/streak goal checks read. */
interface HabitLike {
  steps: number
  sleepH: number
  waterL: number
  nutritionScore: number
}

export interface CompetitionMetrics {
  /** 0..100 weekly consistency ("odometer"). */
  odometer: number
  streakCurrent: number
  streakBest: number
  volume7: number
  volume30: number
  /** completed sessions + self-logged activities in the last 7d window. */
  sessions7: number
}

/** Injected time context so this module never reads a clock directly. `offsetKey`
 *  returns the YYYY-MM-DD key `n` days before "today" (n=0 → today), matching
 *  lib/date.dayKey on the client and the Sydney civil calendar on the server. */
export interface TimeContext {
  todayKey: string
  offsetKey: (n: number) => string
}

/* ------------------------------- goal checks ------------------------------- */

/** A habit day "counts" for the streak when it meets ≥3 of 4 daily goals.
 *  Verbatim from selectors.dayMeetsGoals (nutrition threshold is a fixed 7). */
export function dayMeetsGoals(h: HabitLike, t: ScoringTargets): boolean {
  const checks = [
    h.steps >= t.stepTarget * 0.9,
    h.waterL >= t.waterTargetL * 0.85,
    h.sleepH >= t.sleepTargetH * 0.85,
    h.nutritionScore >= 7,
  ]
  return checks.filter(Boolean).length >= 3
}

/* ------------------------------ odometer core ------------------------------ */

export interface OdometerResult {
  /** 0..100 */
  score: number
  /** per-dimension ratios (1.0 = target met) — feeds the dashboard "parts". */
  ratios: { workouts: number; steps: number; sleep: number; water: number; nutrition: number }
}

/** The odometer window (design spec): consistency over the last 14 days, not 7. */
export const ODOMETER_WINDOW_DAYS = 14

/**
 * The dashboard odometer (weeklyIndex). `habitDays` are the logged habit entries in
 * the odometer window; `workouts` is completed sessions + activities in that same
 * trailing window. `windowDays` (default 14) scales the workout target to the
 * window — a user who hits their WEEKLY workout target every week still lands at
 * 1.0, so "on target" stays calibrated to 50 regardless of window length. The habit
 * dimensions are daily averages, so they're window-length-independent. Returned
 * separately from the UI band/label so the server can score without copy.
 */
export function weeklyIndexCore(habitDays: HabitLike[], workouts: number, t: ScoringTargets, windowDays = ODOMETER_WINDOW_DAYS): OdometerResult {
  const n = Math.max(1, habitDays.length)
  // Coerce every metric to a finite number: a habit row missing a field (e.g. a day logged with no
  // nutritionScore) must count as 0 for that dimension, never poison the average. Without this, one
  // undefined field makes `avg` NaN, which propagates through the ratios and the clamps
  // (Math.max(0, Math.min(100, NaN)) === NaN) and surfaces as "NaN/100" on the dashboard.
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const avg = (sel: (h: HabitLike) => number) => habitDays.reduce((a, h) => a + num(sel(h)), 0) / n
  // Expected workouts over the window = weekly target × weeks in the window.
  const expectedWorkouts = Math.max(1, t.daysPerWeek * Math.max(1, windowDays / 7))

  const ratios = {
    workouts: workouts / expectedWorkouts,
    steps: t.stepTarget ? avg((h) => h.steps) / t.stepTarget : 0,
    sleep: t.sleepTargetH ? avg((h) => h.sleepH) / t.sleepTargetH : 0,
    water: t.waterTargetL ? avg((h) => h.waterL) / t.waterTargetL : 0,
    nutrition: avg((h) => h.nutritionScore) / 8, // 8/10 counts as on-track
  }
  const clamp = (x: number) => Math.max(0, Math.min(1.7, x))
  const weighted =
    clamp(ratios.workouts) * 0.3 +
    clamp(ratios.steps) * 0.2 +
    clamp(ratios.sleep) * 0.2 +
    clamp(ratios.water) * 0.15 +
    clamp(ratios.nutrition) * 0.15
  // Final NaN backstop: Math.max/min do not sanitise NaN, so guard before rounding.
  const score = Number.isFinite(weighted) ? Math.round(Math.max(0, Math.min(100, weighted * 50))) : 0
  return { score, ratios }
}

/* -------------------------------- streak ---------------------------------- */

function isNextDay(a: string, b: string): boolean {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((db - da) / 86400000) === 1
}

export interface StreakInput {
  /** habit entries keyed by dayKey (only days with a logged habit). */
  habitByDay: Map<string, HabitLike>
  /** rest-day + freeze-protected day keys. */
  protectedDays: Set<string>
  targets: ScoringTargets
  ctx: TimeContext
}

/** Forgiving streak (current + best). Verbatim from selectors.streakStats: a day
 *  counts if protected OR its habit meets goals; `current` counts back from today
 *  over the calendar, `best` is the longest consecutive run across all history. */
export function computeStreak({ habitByDay, protectedDays, targets, ctx }: StreakInput): { current: number; best: number } {
  const dayOk = (k: string): boolean => {
    if (protectedDays.has(k)) return true
    const h = habitByDay.get(k)
    return h ? dayMeetsGoals(h, targets) : false
  }

  let current = 0
  const start = dayOk(ctx.todayKey) ? 0 : 1
  for (let nn = start; nn < 400; nn++) {
    if (dayOk(ctx.offsetKey(nn))) current++
    else break
  }

  const keys = [...new Set([...habitByDay.keys(), ...protectedDays])].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const k of keys) {
    const ok = dayOk(k)
    const consecutive = prev ? isNextDay(prev, k) : true
    if (ok && (consecutive || run === 0)) run++
    else run = ok ? 1 : 0
    best = Math.max(best, run)
    prev = k
  }
  return { current, best: Math.max(best, current) }
}

/* -------------------------- windows: volume/sessions ----------------------- */

/** Sum a per-day field over the trailing `days` window (dayKey ≥ offsetKey(days),
 *  inclusive — matching selectors' `>= dayKey(days)` cutoff exactly). */
export function sumInWindow(records: DayRecord[], ctx: TimeContext, days: number, pick: (r: DayRecord) => number): number {
  const cutoff = ctx.offsetKey(days)
  return records.reduce((a, r) => (r.dayKey >= cutoff ? a + pick(r) : a), 0)
}

/* ---------------------------- full recompute ------------------------------- */

export interface RecomputeInput {
  records: DayRecord[]
  targets: ScoringTargets
  ctx: TimeContext
}

/**
 * Compute all competition metrics from a normalized day log. This is what the
 * server runs over its immutable event-derived records, and what the client runs
 * over AppState — same function, same numbers (the F-003 parity guarantee).
 */
export function computeCompetitionMetrics({ records, targets, ctx }: RecomputeInput): CompetitionMetrics {
  // Odometer: habit entries in the last ODOMETER_WINDOW_DAYS (14) calendar days,
  // with workouts over the same window and the workout target scaled to it.
  const windowKeys = new Set(Array.from({ length: ODOMETER_WINDOW_DAYS }, (_, d) => ctx.offsetKey(d)))
  const habitDays: HabitLike[] = records.filter((r) => r.hasHabit && windowKeys.has(r.dayKey))
  const workoutsWindow = sumInWindow(records, ctx, ODOMETER_WINDOW_DAYS, (r) => r.sessions + r.activities)
  const { score } = weeklyIndexCore(habitDays, workoutsWindow, targets, ODOMETER_WINDOW_DAYS)

  // Sessions THIS WEEK (7-day) — the unit the shared weekly team goal counts; kept
  // 7-day independent of the (14-day) odometer window.
  const sessions7 = sumInWindow(records, ctx, 7, (r) => r.sessions + r.activities)

  const habitByDay = new Map<string, HabitLike>()
  const protectedDays = new Set<string>()
  for (const r of records) {
    if (r.hasHabit) habitByDay.set(r.dayKey, r)
    if (r.rest || r.freeze) protectedDays.add(r.dayKey)
  }
  const streak = computeStreak({ habitByDay, protectedDays, targets, ctx })

  return {
    odometer: score,
    streakCurrent: streak.current,
    streakBest: streak.best,
    volume7: Math.round(sumInWindow(records, ctx, 7, (r) => r.volume)),
    volume30: Math.round(sumInWindow(records, ctx, 30, (r) => r.volume)),
    sessions7,
  }
}
