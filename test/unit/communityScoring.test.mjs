// Community competition scoring (F-003). Verifies (a) the shared scoring core
// produces the documented numbers on known inputs, (b) the forgiving-streak logic
// honours rest/freeze protection, and (c) client↔server PARITY: re-running the
// authoritative recompute over the serialized day-log the client sends reproduces
// exactly what the live selectors (myLeaderStats) display. A drift here is the
// F-003 vulnerability, so this is a release-gate test.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeCompetitionMetrics,
  weeklyIndexCore,
  computeStreak,
} from '../../.sweep-out/community/scoring.js'
import { myLeaderStats, buildDayRecords, targetsFrom } from '../../.sweep-out/store/selectors.js'
import { dayKey, todayKey } from '../../.sweep-out/lib/date.js'

// The client's live clock is the frozen demo instant here; build an injected time
// context that matches lib/date exactly so parity is a like-for-like comparison.
const ctx = { todayKey, offsetKey: (n) => dayKey(n) }
const TARGETS = { stepTarget: 10000, sleepTargetH: 8, waterTargetL: 2.5, daysPerWeek: 4 }

/** A day that clears all four habit goals at target. */
const perfect = (k) => ({ dateKey: k, steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8, mindsetMin: 0, workout: true })

/** Minimal AppState the scoring selectors read. */
function stateWith({ habits = [], sessions = [], activities = [], restDays = [], frozenDays = [] }) {
  return {
    profile: { ...TARGETS },
    habits,
    sessions,
    activities,
    community: { username: 'alex', restDays, frozenDays },
  }
}

test('weeklyIndexCore: everything at target scores 50 (the "on track" midpoint)', () => {
  const habitDays = Array.from({ length: 7 }, () => ({ steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8 }))
  const { score } = weeklyIndexCore(habitDays, 4, TARGETS)
  assert.equal(score, 50)
})

test('weeklyIndexCore: zero activity scores 0', () => {
  assert.equal(weeklyIndexCore([], 0, TARGETS).score, 0)
})

test('computeStreak: a rest day bridges a gap that would otherwise reset', () => {
  // Perfect at offsets 0,1,3; offset 2 has NO habit but is a rest day.
  const habitByDay = new Map([
    [dayKey(0), { steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8 }],
    [dayKey(1), { steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8 }],
    [dayKey(3), { steps: 10000, sleepH: 8, waterL: 2.5, nutritionScore: 8 }],
  ])
  const withRest = computeStreak({ habitByDay, protectedDays: new Set([dayKey(2)]), targets: TARGETS, ctx })
  const withoutRest = computeStreak({ habitByDay, protectedDays: new Set(), targets: TARGETS, ctx })
  assert.equal(withRest.current, 4) // 0,1,2(rest),3
  assert.equal(withoutRest.current, 2) // 0,1 then the gap resets
})

test('computeCompetitionMetrics: known scenario yields the hand-computed metrics', () => {
  const habits = Array.from({ length: 7 }, (_, n) => perfect(dayKey(n))) // offsets 0..6
  const sessions = [0, 1, 2, 3].map((n) => ({ dateKey: dayKey(n), completed: true, volumeKg: 1000, exercises: [] }))
  const records = buildDayRecords(stateWith({ habits, sessions }))
  const m = computeCompetitionMetrics({ records, targets: TARGETS, ctx })
  assert.equal(m.odometer, 50)
  assert.equal(m.streakCurrent, 7)
  assert.equal(m.streakBest, 7)
  assert.equal(m.volume7, 4000)
  assert.equal(m.volume30, 4000)
  assert.equal(m.sessions7, 4)
})

test('PARITY: server recompute from the serialized day-log == live client selectors', () => {
  // A messier, realistic state: partial habits, a couple of misses, a freeze, some
  // self-logged activities, and volume across two windows.
  const habits = [
    perfect(dayKey(0)),
    { dateKey: dayKey(1), steps: 6000, sleepH: 7, waterL: 2.5, nutritionScore: 8, mindsetMin: 0, workout: true }, // 3/4 (low steps)
    perfect(dayKey(2)),
    { dateKey: dayKey(4), steps: 3000, sleepH: 5, waterL: 1, nutritionScore: 3, mindsetMin: 0, workout: false }, // 0/4
    perfect(dayKey(9)),
    perfect(dayKey(20)),
  ]
  const sessions = [
    { dateKey: dayKey(0), completed: true, volumeKg: 1200, exercises: [] },
    { dateKey: dayKey(2), completed: true, volumeKg: 800, exercises: [] },
    { dateKey: dayKey(9), completed: true, volumeKg: 1500, exercises: [] },
    { dateKey: dayKey(25), completed: true, volumeKg: 999, exercises: [] }, // outside 7 & inside 30
    { dateKey: dayKey(1), completed: false, volumeKg: 5000, exercises: [] }, // NOT completed → ignored
  ]
  const activities = [{ dateKey: dayKey(3) }, { dateKey: dayKey(3) }, { dateKey: dayKey(40) }]
  const state = stateWith({ habits, sessions, activities, frozenDays: [dayKey(3)] })

  const client = myLeaderStats(state)
  // Exactly what src/community/backend.ts posts, recomputed the way the server does.
  const records = buildDayRecords(state)
  const server = computeCompetitionMetrics({ records, targets: targetsFrom(state.profile), ctx })

  assert.equal(server.odometer, client.odometer)
  assert.equal(server.streakCurrent, client.streakCurrent)
  assert.equal(server.streakBest, client.streakBest)
  assert.equal(server.volume7, client.volume7)
  assert.equal(server.volume30, client.volume30)
  assert.equal(server.sessions7, client.sessionsThisWeek)
})

test('the recompute has no channel for a client-claimed metric', () => {
  // Records carry only raw inputs — there is no `points`/`odometer` field to trust.
  const records = buildDayRecords(stateWith({ habits: [perfect(dayKey(0))] }))
  for (const r of records) {
    assert.equal('points' in r, false)
    assert.equal('odometer' in r, false)
  }
})
