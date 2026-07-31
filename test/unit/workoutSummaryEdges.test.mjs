// Edge-case coverage for the workout-summary chart re-derivations (Phase C
// Option B). The happy paths live in workoutSummary.test.mjs; these pin the
// boundaries a UI refactor is most likely to break: tie-breaks, absent lifts,
// sparse/all-old history, and custom windows.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { dayKey } from '../../.sweep-out/lib/date.js'
import {
  strengthProgressFromPoints,
  oneRMSeriesFromPoints,
  bestLiftIdFromPoints,
  volumeByWeekFromPoints,
} from '../../.sweep-out/store/workoutSummary.js'

// A summary point: { id, dateKey, volumeKg, lifts: { defId: estimated1RM } }.
const sm = (id, dateKey, lifts, volumeKg = 1000) => ({ id, dateKey, volumeKg, lifts })

test('bestLiftIdFromPoints: empty history is null (no chart to default to)', () => {
  assert.equal(bestLiftIdFromPoints([]), null)
})

test('bestLiftIdFromPoints: an equal count breaks toward the earlier canonical lift', () => {
  // bench and squat each appear twice; candidate order lists bench first, so it wins.
  const points = [
    sm('a', '2026-01-01', { bench: 100, squat: 140 }),
    sm('b', '2026-01-08', { bench: 102, squat: 142 }),
  ]
  assert.equal(bestLiftIdFromPoints(points), 'bench')
})

test('bestLiftIdFromPoints: a non-canonical lift (row) can win when it is the most logged', () => {
  const points = [
    sm('a', '2026-01-01', { row: 60 }),
    sm('b', '2026-01-08', { row: 62 }),
    sm('c', '2026-01-15', { bench: 100 }),
  ]
  assert.equal(bestLiftIdFromPoints(points), 'row')
})

test('oneRMSeriesFromPoints: a lift with no data points returns an empty series', () => {
  const points = [sm('a', '2026-01-01', { bench: 100 })]
  assert.deepEqual(oneRMSeriesFromPoints(points, 'deadlift'), [])
})

test('strengthProgressFromPoints: a single session shows zero change, not a crash', () => {
  const points = [sm('a', dayKey(3), { squat: 141 })]
  const row = strengthProgressFromPoints(points).find((r) => r.id === 'squat')
  assert.equal(row.from, 140) // 141 rounded to nearest 2.5
  assert.equal(row.to, 140)
  assert.equal(row.pct, 0)
})

test('strengthProgressFromPoints: when all history predates the 4-week window, it compares against the earliest', () => {
  // Both points are older than 28 days → the `>= fourWeeksAgo` find misses and
  // falls back to the earliest point as the baseline.
  const points = [
    sm('a', dayKey(90), { bench: 100 }),
    sm('b', dayKey(60), { bench: 110 }),
  ]
  const row = strengthProgressFromPoints(points).find((r) => r.id === 'bench')
  assert.equal(row.from, 100)
  assert.equal(row.to, 110)
  assert.equal(row.pct, 10)
})

test('strengthProgressFromPoints: only the four canonical lifts appear, in canonical order', () => {
  const points = [sm('a', dayKey(1), { ohp: 60, bench: 100, row: 70 })]
  const ids = strengthProgressFromPoints(points).map((r) => r.id)
  assert.deepEqual(ids, ['bench', 'ohp']) // squat/deadlift absent, row not canonical
})

test('volumeByWeekFromPoints: respects a custom week count and labels the last bucket "Now"', () => {
  const out = volumeByWeekFromPoints([], 4)
  assert.equal(out.length, 4)
  assert.equal(out[out.length - 1].label, 'Now')
  assert.ok(out.every((b) => b.volume === 0)) // empty history → all-zero buckets
})

test('volumeByWeekFromPoints: a point inside this week lands in the "Now" bucket, one far in the past does not', () => {
  const out = volumeByWeekFromPoints([sm('a', dayKey(1), {}, 2500), sm('b', dayKey(200), {}, 9999)], 8)
  const now = out[out.length - 1]
  assert.equal(now.volume, 2500)
  const total = out.reduce((a, b) => a + b.volume, 0)
  assert.equal(total, 2500) // the 200-days-ago session falls outside all 8 buckets
})
