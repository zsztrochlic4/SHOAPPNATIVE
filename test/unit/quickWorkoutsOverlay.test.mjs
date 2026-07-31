// Pure tests for the quick-workout Firestore overlay: a cloud doc edits/adds a
// workout by id, `deprecated` removes it, and — critically — a malformed or
// out-of-range doc can never reach the countdown player (dropped or clamped, seed
// kept). Mirrors the recipes/exercise-info overlay guarantees.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { workoutFromDoc, overlayQuickWorkouts } from '../../.sweep-out/data/quickWorkoutsOverlay.js'

const station = (over = {}) => ({ exerciseId: 'QD09', name: 'Bodyweight Squat', workSec: 35, restSec: 15, ...over })
const round = (n, over = {}) => ({ round: n, stations: [station()], roundRestSec: 60, ...over })
const workout = (over = {}) => ({
  id: 'BW12-01',
  name: 'Full-Body Starter',
  level: 'Beginner',
  order: 1,
  focus: 'Full body',
  minutes: 12,
  rounds: [round(1), round(2), round(3, { roundRestSec: undefined })],
  ...over,
})

const seed = [
  workout(),
  workout({ id: 'BW12-04', name: 'Upper Body & Core', level: 'Intermediate', order: 4 }),
]

test('workoutFromDoc: accepts a well-formed doc and keeps its fields', () => {
  const w = workoutFromDoc(workout({ focus: 'Posture' }))
  assert.equal(w.id, 'BW12-01')
  assert.equal(w.level, 'Beginner')
  assert.equal(w.focus, 'Posture')
  assert.equal(w.rounds.length, 3)
  assert.equal(w.rounds[0].stations[0].workSec, 35)
})

test('workoutFromDoc: rejects docs missing id/name/level or rounds', () => {
  assert.equal(workoutFromDoc(null), null)
  assert.equal(workoutFromDoc(workout({ id: '' })), null)
  assert.equal(workoutFromDoc(workout({ name: '   ' })), null)
  assert.equal(workoutFromDoc(workout({ level: 'Elite' })), null)
  assert.equal(workoutFromDoc(workout({ rounds: [] })), null)
  assert.equal(workoutFromDoc(workout({ rounds: 'nope' })), null)
})

test('workoutFromDoc: drops rounds/stations with no usable exercise link', () => {
  const w = workoutFromDoc(
    workout({ rounds: [{ round: 1, stations: [{ name: 'no id' }, station()] }, { round: 2, stations: [] }] }),
  )
  // round 2 has no stations → dropped; round 1 keeps only the linked station.
  assert.equal(w.rounds.length, 1)
  assert.equal(w.rounds[0].stations.length, 1)
  assert.equal(w.rounds[0].stations[0].exerciseId, 'QD09')
})

test('workoutFromDoc: clamps out-of-range timing so the player can never hang or run backwards', () => {
  const w = workoutFromDoc(
    workout({
      minutes: 9999,
      rounds: [round(1, { roundRestSec: -50, stations: [station({ workSec: 99999, restSec: -10 })] })],
    }),
  )
  assert.equal(w.minutes, 120) // clamped to max
  assert.equal(w.rounds[0].stations[0].workSec, 600) // clamped to max
  assert.equal(w.rounds[0].stations[0].restSec, 0) // clamped to min (never negative)
  assert.equal(w.rounds[0].roundRestSec, 0) // clamped to min
})

test('workoutFromDoc: preserves optional repHint / perSide / build flags', () => {
  const w = workoutFromDoc(
    workout({ rounds: [round(1, { build: true, stations: [station({ repHint: '6-8 reps', perSide: true })] })] }),
  )
  assert.equal(w.rounds[0].build, true)
  assert.equal(w.rounds[0].stations[0].repHint, '6-8 reps')
  assert.equal(w.rounds[0].stations[0].perSide, true)
})

test('overlayQuickWorkouts: an edited doc wins by id, others untouched', () => {
  const out = overlayQuickWorkouts(seed, [workout({ name: 'Full-Body Starter v2', focus: 'Edited' })])
  const edited = out.find((w) => w.id === 'BW12-01')
  assert.equal(edited.name, 'Full-Body Starter v2')
  assert.equal(edited.focus, 'Edited')
  assert.ok(out.find((w) => w.id === 'BW12-04')) // untouched seed entry survives
  assert.equal(out.length, 2)
})

test('overlayQuickWorkouts: a new doc is added and re-sorted by order', () => {
  const out = overlayQuickWorkouts(seed, [
    workout({ id: 'BW12-02', name: 'Legs & Glutes', level: 'Beginner', order: 2 }),
  ])
  assert.deepEqual(
    out.map((w) => w.id),
    ['BW12-01', 'BW12-02', 'BW12-04'],
  )
})

test('overlayQuickWorkouts: `deprecated` removes a workout', () => {
  const out = overlayQuickWorkouts(seed, [{ id: 'BW12-01', deprecated: true }])
  assert.deepEqual(
    out.map((w) => w.id),
    ['BW12-04'],
  )
})

test('overlayQuickWorkouts: a malformed doc is ignored, the seed entry stays', () => {
  const out = overlayQuickWorkouts(seed, [{ id: 'BW12-01', level: 'Nonsense', rounds: [] }, 'garbage', null])
  const kept = out.find((w) => w.id === 'BW12-01')
  assert.equal(kept.name, 'Full-Body Starter') // original seed, not clobbered
  assert.equal(out.length, 2)
})

test('overlayQuickWorkouts: empty/absent cloud list returns the seed unchanged', () => {
  assert.deepEqual(overlayQuickWorkouts(seed, []).map((w) => w.id), ['BW12-01', 'BW12-04'])
  assert.deepEqual(overlayQuickWorkouts(seed, null).map((w) => w.id), ['BW12-01', 'BW12-04'])
})
