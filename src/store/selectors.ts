import { currentWeekKeys, dayKey, todayKey, fromKey, toKey, addDays } from '../lib/date'
import type { AppState, HabitDay, WorkoutSession } from './types'

export function todayHabit(s: AppState): HabitDay {
  return habitForDay(s, todayKey)
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
/** A day "counts" if it meets >= 3 of 4 daily goals. */
function dayMeetsGoals(h: HabitDay, s: AppState): boolean {
  const checks = [
    h.steps >= s.profile.stepTarget * 0.9,
    h.waterL >= s.profile.waterTargetL * 0.85,
    h.sleepH >= s.profile.sleepTargetH * 0.85,
    h.nutritionScore >= 7,
  ]
  return checks.filter(Boolean).length >= 3
}

export function streakStats(s: AppState) {
  const byKey = new Map(s.habits.map((h) => [h.dateKey, h]))
  // current: count back from yesterday (today is in-progress), including today if it already qualifies
  let current = 0
  const todayQualifies = (() => {
    const t = byKey.get(todayKey)
    return t ? dayMeetsGoals(t, s) : false
  })()
  let start = todayQualifies ? 0 : 1
  for (let n = start; n < 400; n++) {
    const h = byKey.get(dayKey(n))
    if (h && dayMeetsGoals(h, s)) current++
    else break
  }
  // best: longest run across all history
  const keys = [...s.habits].map((h) => h.dateKey).sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const k of keys) {
    const h = byKey.get(k)!
    const ok = dayMeetsGoals(h, s)
    const consecutive = prev ? isNextDay(prev, k) : true
    if (ok && (consecutive || run === 0)) run++
    else run = ok ? 1 : 0
    best = Math.max(best, run)
    prev = k
  }
  return { current, best: Math.max(best, current) }
}

function isNextDay(a: string, b: string) {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((db - da) / 86400000) === 1
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
/** Epley 1RM estimate from a session's best set of an exercise. */
function best1RM(session: WorkoutSession, defId: string): number | null {
  const ex = session.exercises.find((e) => e.defId === defId)
  if (!ex) return null
  let max = 0
  for (const set of ex.sets) {
    const est = set.weightKg * (1 + set.reps / 30)
    if (est > max) max = est
  }
  return max || null
}

export function strengthProgress(s: AppState) {
  const lifts = ['bench', 'squat', 'deadlift', 'ohp']
  const names: Record<string, string> = { bench: 'Bench Press', squat: 'Back Squat', deadlift: 'Deadlift', ohp: 'Overhead Press' }
  const done = completedSessions(s).sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const fourWeeksAgo = dayKey(28)

  return lifts
    .map((id) => {
      const withLift = done.filter((x) => x.exercises.some((e) => e.defId === id))
      if (withLift.length === 0) return null
      const latest = withLift.at(-1)!
      const past = withLift.find((x) => x.dateKey >= fourWeeksAgo) ?? withLift[0]
      const to = best1RM(latest, id)
      const from = best1RM(past, id)
      if (!to || !from) return null
      const pct = Math.round(((to - from) / from) * 100)
      const ex = latest.exercises.find((e) => e.defId === id)!
      return {
        id,
        name: names[id],
        from: Math.round(from / 2.5) * 2.5,
        to: Math.round(to / 2.5) * 2.5,
        pct,
        image: ex.image,
      }
    })
    .filter(Boolean) as { id: string; name: string; from: number; to: number; pct: number; image: string }[]
}

/* -------------------------- Strength & volume series -------------------------- */
function epley(weightKg: number, reps: number) {
  return weightKg * (1 + reps / 30)
}

/** Estimated 1RM per completed session for a lift, chronological. */
export function oneRMSeries(s: AppState, defId: string) {
  return completedSessions(s)
    .filter((x) => x.exercises.some((e) => e.defId === defId))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((x) => {
      const ex = x.exercises.find((e) => e.defId === defId)!
      const kg = Math.max(0, ...ex.sets.map((set) => epley(set.weightKg, set.reps)))
      return { dateKey: x.dateKey, kg: Math.round(kg / 2.5) * 2.5 }
    })
    .filter((p) => p.kg > 0)
}

/** The lift with the most logged history (for the default strength chart). */
export function bestLiftId(s: AppState): string | null {
  const lifts = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown']
  let best: string | null = null
  let n = 0
  for (const id of lifts) {
    const c = completedSessions(s).filter((x) => x.exercises.some((e) => e.defId === id)).length
    if (c > n) { n = c; best = id }
  }
  return best
}

/** Total training volume bucketed into the last `weeks` weeks (oldest → newest). */
export function volumeByWeek(s: AppState, weeks = 8) {
  const done = completedSessions(s)
  const out: { label: string; volume: number }[] = []
  for (let wk = weeks - 1; wk >= 0; wk--) {
    const start = dayKey(wk * 7 + 6)
    const end = dayKey(wk * 7)
    const volume = done.filter((x) => x.dateKey >= start && x.dateKey <= end).reduce((a, x) => a + x.volumeKg, 0)
    out.push({ label: wk === 0 ? 'Now' : `${wk}w`, volume: Math.round(volume) })
  }
  return out
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

/** Reviews the last 14 days of activity AND actual goal progress vs the user's
 *  targets into a single needle position. 1.0x of targets = the middle ("on
 *  track"); above that means ahead of / surpassing their goals. */
const INDEX_WINDOW = 14

export function weeklyIndex(s: AppState): WeeklyIndex {
  const p = s.profile
  const byKey = new Map(s.habits.map((h) => [h.dateKey, h]))
  const keys = Array.from({ length: INDEX_WINDOW }, (_, d) => dayKey(d))
  const days = keys.map((k) => byKey.get(k)).filter(Boolean) as HabitDay[]
  const n = Math.max(1, days.length)

  const avg = (sel: (h: HabitDay) => number) => days.reduce((a, h) => a + sel(h), 0) / n
  // Count prescribed sessions and self-logged activities. All fitness counts.
  const workouts = workoutsInRange(s, INDEX_WINDOW) + activitiesInRange(s, INDEX_WINDOW).length

  // Each ratio: 1.0 means the target was met across the window. Workout target
  // scales with the window (daysPerWeek across 2 weeks).
  const r = {
    workouts: workouts / Math.max(1, p.daysPerWeek * (INDEX_WINDOW / 7)),
    steps: p.stepTarget ? avg((h) => h.steps) / p.stepTarget : 0,
    sleep: p.sleepTargetH ? avg((h) => h.sleepH) / p.sleepTargetH : 0,
    water: p.waterTargetL ? avg((h) => h.waterL) / p.waterTargetL : 0,
    nutrition: avg((h) => h.nutritionScore) / 8, // 8/10 counts as on-track
  }

  // Real goal progress: is their weight trending toward (or past) their goal
  // over the window? Only counts when we have at least two weigh-ins, so early
  // users are judged purely on habits.
  const winKeys = new Set(keys)
  const ws = s.weights.filter((w) => winKeys.has(w.dateKey)).sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  let goalProgress: number | null = null
  if (ws.length >= 2) {
    const change = ws[ws.length - 1].kg - ws[0].kg
    const dir = p.goal === 'lose-fat' ? -1 : p.goal === 'build-muscle' || p.goal === 'gain-strength' ? 1 : 0
    if (dir === 0) {
      // Maintain / stay healthy: less drift is better (±0 is ideal).
      goalProgress = Math.max(0, 1.2 - Math.abs(change) / 1.5)
    } else {
      // ~0.7 kg toward the goal over 14 days is "on pace" (= 1.0). Moving the
      // wrong way scores near zero; faster healthy progress reads as ahead.
      goalProgress = (change * dir) / 0.7
    }
  }

  const clamp = (x: number) => Math.max(0, Math.min(1.7, x))
  const W = { workouts: 0.30, steps: 0.15, sleep: 0.15, water: 0.10, nutrition: 0.15, goal: 0.15 }
  const habitPart =
    clamp(r.workouts) * W.workouts +
    clamp(r.steps) * W.steps +
    clamp(r.sleep) * W.sleep +
    clamp(r.water) * W.water +
    clamp(r.nutrition) * W.nutrition
  // With weigh-ins, blend goal progress in; without, renormalise habits to 1.0.
  const weighted =
    goalProgress !== null
      ? habitPart + clamp(goalProgress) * W.goal
      : habitPart / (1 - W.goal)

  // weighted ≈ 1 → middle (50). 1.7x → ~85+, 0 → 0.
  const score = Math.round(Math.max(0, Math.min(100, weighted * 50)))

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
    ...(goalProgress !== null ? [{ label: 'Goal', pct: pct(goalProgress) }] : []),
  ]
  return { score, band, label, blurb, parts }
}

export function leaderboardSorted(s: AppState) {
  return [...s.leaderboard].sort((a, b) => b.points - a.points)
}

export function youRank(s: AppState) {
  return leaderboardSorted(s).findIndex((u) => u.isYou) + 1
}
