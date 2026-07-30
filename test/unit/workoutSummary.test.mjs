// Pure tests for the workout-summary projection (Phase C Option B). These pin
// the summary math and guard that the refactored Progress charts read from
// summaries without changing their output.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { dayKey } from '../../.sweep-out/lib/date.js'
import {
  summarizeSession,
  workoutPoints,
  buildAllSummaries,
  strengthProgressFromPoints,
  oneRMSeriesFromPoints,
  bestLiftIdFromPoints,
  volumeByWeekFromPoints,
} from '../../.sweep-out/store/workoutSummary.js'

const ex = (defId, sets) => ({ defId, name: defId, image: '', targetSets: sets.length, targetReps: '5', sets })
const set = (weightKg, reps) => ({ weightKg, reps, done: true })
const sess = (id, dateKey, volumeKg, exercises, completed = true) => ({
  id, dateKey, name: 'W', focus: '', image: '', durationMin: 45, volumeKg, calories: 0, exercises, completed,
})

test('summarizeSession: best Epley est-1RM per lift, volume passthrough', () => {
  const s = sess('s1', '2026-01-01', 1234, [
    ex('bench', [set(60, 5), set(70, 3)]), // Epley: 70 vs 77 → 77
    ex('squat', [set(100, 1)]), //           → 103.33
  ])
  const sum = summarizeSession(s)
  assert.equal(sum.id, 's1')
  assert.equal(sum.dateKey, '2026-01-01')
  assert.equal(sum.volumeKg, 1234)
  assert.ok(Math.abs(sum.lifts.bench - 77) < 1e-9)
  assert.ok(Math.abs(sum.lifts.squat - 100 * (1 + 1 / 30)) < 1e-9)
})

test('summarizeSession: a zero-estimate lift is omitted (no bodyweight noise)', () => {
  const sum = summarizeSession(sess('s2', '2026-01-02', 0, [ex('plank', [set(0, 60)])]))
  assert.equal('plank' in sum.lifts, false)
  assert.deepEqual(sum.lifts, {})
})

test('workoutPoints: uses stored summaries only when complete, else derives', () => {
  const stored = [{ id: 'a', dateKey: '2026-01-01', volumeKg: 10, lifts: { bench: 100 } }]
  const sessions = [sess('b', '2026-02-01', 20, [ex('bench', [set(80, 5)])])]

  const complete = workoutPoints({ workoutSummaries: stored, workoutSummaryComplete: true, sessions })
  assert.strictEqual(complete, stored) // returns the stored array as-is

  const incomplete = workoutPoints({ workoutSummaries: stored, workoutSummaryComplete: false, sessions })
  assert.equal(incomplete.length, 1)
  assert.equal(incomplete[0].id, 'b') // derived from the loaded session, not the stored summary
})

test('workoutPoints: derivation ignores not-yet-completed sessions', () => {
  const sessions = [
    sess('done', '2026-01-01', 10, [ex('bench', [set(80, 5)])], true),
    sess('wip', '2026-01-02', 0, [ex('bench', [set(80, 5)])], false),
  ]
  const pts = workoutPoints({ sessions, workoutSummaryComplete: false })
  assert.deepEqual(pts.map((p) => p.id), ['done'])
})

test('oneRMSeriesFromPoints: chronological, rounded to 2.5kg, positive only', () => {
  const points = [
    { dateKey: '2026-01-03', lifts: { bench: 81 } },
    { dateKey: '2026-01-01', lifts: { bench: 74 } },
    { dateKey: '2026-01-02', lifts: { squat: 100 } }, // different lift, excluded
  ]
  const series = oneRMSeriesFromPoints(points, 'bench')
  assert.deepEqual(series, [
    { dateKey: '2026-01-01', kg: 75 }, // 74 → nearest 2.5
    { dateKey: '2026-01-03', kg: 80 }, // 81 → nearest 2.5
  ])
})

test('bestLiftIdFromPoints: the lift logged in the most sessions', () => {
  const points = [
    { dateKey: 'd1', lifts: { bench: 100, squat: 140 } },
    { dateKey: 'd2', lifts: { bench: 102 } },
    { dateKey: 'd3', lifts: { squat: 145 } },
  ]
  assert.equal(bestLiftIdFromPoints(points), 'bench') // bench x2 > squat x2? tie → first wins (bench)
})

test('volumeByWeekFromPoints: buckets volume into rolling weeks (oldest→newest)', () => {
  const points = [
    { dateKey: dayKey(1), volumeKg: 500, lifts: {} }, // this week
    { dateKey: dayKey(10), volumeKg: 300, lifts: {} }, // last week
  ]
  const out = volumeByWeekFromPoints(points, 2)
  assert.deepEqual(out, [
    { label: '1w', volume: 300 },
    { label: 'Now', volume: 500 },
  ])
})

test('strengthProgressFromPoints: 4-week from→to for a featured lift', () => {
  const points = [
    { dateKey: dayKey(20), volumeKg: 0, lifts: { bench: 100 } }, // within 4wk → "from"
    { dateKey: dayKey(0), volumeKg: 0, lifts: { bench: 110 } }, //  latest      → "to"
  ]
  const rows = strengthProgressFromPoints(points)
  const bench = rows.find((r) => r.id === 'bench')
  assert.ok(bench)
  assert.equal(bench.name, 'Bench Press')
  assert.equal(bench.from, 100)
  assert.equal(bench.to, 110)
  assert.equal(bench.pct, 10)
  assert.equal('image' in bench, false) // image is attached by the selector, not here
})

test('buildAllSummaries: one summary per completed session', () => {
  const sessions = [
    sess('a', '2026-01-01', 10, [ex('bench', [set(80, 5)])], true),
    sess('b', '2026-01-02', 0, [ex('bench', [set(80, 5)])], false),
    sess('c', '2026-01-03', 20, [ex('squat', [set(100, 5)])], true),
  ]
  const built = buildAllSummaries(sessions)
  assert.deepEqual(built.map((s) => s.id), ['a', 'c'])
})
