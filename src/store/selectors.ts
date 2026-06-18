import { currentWeekKeys, dayKey, todayKey } from '../lib/date'
import type { AppState, HabitDay, WorkoutSession } from './types'

export function todayHabit(s: AppState): HabitDay {
  return (
    s.habits.find((h) => h.dateKey === todayKey) ?? {
      dateKey: todayKey,
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
  return s.sessions.find((x) => x.dateKey === todayKey)
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
  // current: count back from yesterday (today is in-progress) — include today if it already qualifies
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

/* -------------------------- Habit consistency (this week) -------------------------- */
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

export function leaderboardSorted(s: AppState) {
  return [...s.leaderboard].sort((a, b) => b.points - a.points)
}

export function youRank(s: AppState) {
  return leaderboardSorted(s).findIndex((u) => u.isYou) + 1
}
