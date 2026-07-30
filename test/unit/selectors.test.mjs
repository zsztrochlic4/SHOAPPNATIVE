// Pure-domain tests for the core dashboard/progress selectors (Phase A —
// broaden pure-domain coverage). These calculations drive the streak, weekly
// readiness index, weight card, and nutrition ring on every screen, and had no
// tests. Date-relative cases build fixtures via the same date helpers the
// selectors use, so they're stable regardless of the machine's clock.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { dayKey } from '../../.sweep-out/lib/date.js'
import {
  weightStats,
  nutritionForDay,
  streakStats,
  weeklyIndex,
  habitConsistency7d,
} from '../../.sweep-out/store/selectors.js'

const PROFILE = {
  stepTarget: 10000,
  waterTargetL: 3,
  sleepTargetH: 8,
  calorieTarget: 2000,
  proteinTarget: 150,
  daysPerWeek: 4,
  startWeightKg: 80,
  goalWeightKg: 75,
}

const base = {
  profile: PROFILE,
  habits: [],
  weights: [],
  meals: [],
  sessions: [],
  activities: [],
  foodReviews: [],
  notifications: [],
  chat: [],
}
const st = (o = {}) => ({ ...base, ...o, profile: { ...PROFILE, ...(o.profile ?? {}) } })

/** A day that clears the streak bar (>= 3 of 4 goals met). */
const goodDay = (dateKey) => ({ dateKey, steps: 10000, sleepH: 8, waterL: 3, mindsetMin: 10, nutritionScore: 9, workout: true })
/** A day that fails the streak bar (0 goals met). */
const badDay = (dateKey) => ({ dateKey, steps: 0, sleepH: 0, waterL: 0, mindsetMin: 0, nutritionScore: 0, workout: false })

/* ------------------------------- weightStats ------------------------------- */

test('weightStats: current is the latest entry, series sorted ascending', () => {
  const s = st({ weights: [
    { dateKey: '2026-02-01', kg: 78 },
    { dateKey: '2026-01-01', kg: 82 },
    { dateKey: '2026-03-01', kg: 76 },
  ] })
  const w = weightStats(s)
  assert.equal(w.current, 76)
  assert.equal(w.start, 80)
  assert.deepEqual(w.series.map((x) => x.dateKey), ['2026-01-01', '2026-02-01', '2026-03-01'])
})

test('weightStats: delta compares against the entry ~4 weeks ago', () => {
  const s = st({ weights: [
    { dateKey: dayKey(35), kg: 84 }, // older than 4 weeks → the baseline
    { dateKey: dayKey(2), kg: 80 }, //  latest
  ] })
  const w = weightStats(s)
  assert.equal(w.current, 80)
  assert.equal(w.delta, -4) // 80 - 84
})

test('weightStats: with no entries falls back to the profile start weight', () => {
  const w = weightStats(st())
  assert.equal(w.current, 80)
  assert.equal(w.delta, 0)
})

/* ----------------------------- nutritionForDay ----------------------------- */

test('nutritionForDay: sums macros scaled by qty and clamps remaining', () => {
  const key = '2026-05-05'
  const s = st({ meals: [
    { dateKey: key, meal: 'Breakfast', name: 'Oats', qty: 2, kcal: 300, p: 10, c: 50, f: 5 },
    { dateKey: key, meal: 'Lunch', name: 'Chicken', qty: 1, kcal: 600, p: 50, c: 40, f: 20 },
    { dateKey: '2026-05-04', meal: 'Dinner', name: 'Other day', qty: 1, kcal: 999, p: 1, c: 1, f: 1 },
  ] })
  const n = nutritionForDay(s, key)
  assert.equal(n.kcal, 1200) // 300*2 + 600
  assert.equal(n.p, 70) //      10*2 + 50
  assert.equal(n.c, 140) //     50*2 + 40
  assert.equal(n.f, 30) //      5*2 + 20
  assert.equal(n.remaining, 800) // 2000 - 1200
  assert.equal(n.meals.length, 2) // other day excluded
})

test('nutritionForDay: over target clamps remaining at 0, never negative', () => {
  const key = '2026-05-06'
  const s = st({ meals: [{ dateKey: key, meal: 'Lunch', name: 'Feast', qty: 1, kcal: 2500, p: 0, c: 0, f: 0 }] })
  assert.equal(nutritionForDay(s, key).remaining, 0)
})

/* ------------------------------- streakStats ------------------------------- */

test('streakStats: current counts consecutive qualifying days back from today', () => {
  const s = st({ habits: [goodDay(dayKey(0)), goodDay(dayKey(1)), goodDay(dayKey(2)), badDay(dayKey(3)), goodDay(dayKey(4))] })
  const r = streakStats(s)
  assert.equal(r.current, 3) // today, -1, -2; broken at -3
})

test('streakStats: a gap breaks the current streak', () => {
  // today qualifies, but yesterday is missing entirely → current is just today.
  const s = st({ habits: [goodDay(dayKey(0)), goodDay(dayKey(2)), goodDay(dayKey(3))] })
  assert.equal(streakStats(s).current, 1)
})

test('streakStats: best is the longest run across all history', () => {
  const s = st({ habits: [
    goodDay(dayKey(10)), goodDay(dayKey(9)), goodDay(dayKey(8)), goodDay(dayKey(7)), // run of 4
    badDay(dayKey(6)),
    goodDay(dayKey(5)), goodDay(dayKey(4)), // run of 2
  ] })
  assert.equal(streakStats(s).best, 4)
})

/* ------------------------------- weeklyIndex ------------------------------- */

test('weeklyIndex: an empty week is off track, a strong week scores high', () => {
  const empty = weeklyIndex(st())
  assert.equal(empty.band, 'off')
  assert.equal(empty.score, 0)

  const strongWeek = Array.from({ length: 7 }, (_, d) => goodDay(dayKey(d)))
  const strong = weeklyIndex(st({ habits: strongWeek, sessions: [
    { id: 'a', dateKey: dayKey(1), completed: true, volumeKg: 1, exercises: [] },
    { id: 'b', dateKey: dayKey(3), completed: true, volumeKg: 1, exercises: [] },
    { id: 'c', dateKey: dayKey(5), completed: true, volumeKg: 1, exercises: [] },
    { id: 'd', dateKey: dayKey(6), completed: true, volumeKg: 1, exercises: [] },
  ] }))
  assert.ok(strong.score >= 44, `expected on-track+, got ${strong.score}`)
  assert.ok(['ontrack', 'ahead', 'crushing'].includes(strong.band))
  assert.equal(strong.parts.length, 5)
})

/* ---------------------------- habitConsistency7d --------------------------- */

test('habitConsistency7d: counts met-goal days over the last 7, out of 7', () => {
  const s = st({ habits: [
    goodDay(dayKey(0)), goodDay(dayKey(1)), goodDay(dayKey(2)),
    badDay(dayKey(3)),
    { dateKey: dayKey(8), steps: 10000, sleepH: 8, waterL: 3, mindsetMin: 0, nutritionScore: 9, workout: true }, // outside the window
  ] })
  const h = habitConsistency7d(s)
  assert.equal(h.total, 7)
  assert.equal(h.workouts, 3) // three good days had workout:true; the day-8 one is out of range
  assert.equal(h.steps, 3) // three days hit >= 90% of 10k
})
