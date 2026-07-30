// The 8×12-minute quick-workout parser: shape, beginner→advanced ordering, timed
// stations, per-side flags and rep hints, and the round-rest structure that the
// player's circuit logic relies on.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readQuickWorkouts } from '../../scripts/lib/parse-quick-workouts.mjs'

const XLSX = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'quick-workouts', '8x12min.xlsx')
const { workouts, problems } = readQuickWorkouts(XLSX)

test('parses cleanly with no problems', () => {
  assert.deepEqual(problems, [])
  assert.equal(workouts.length, 8)
})

test('ordered beginner → advanced with 1-based order and Beginners first', () => {
  assert.deepEqual(
    workouts.map((w) => w.order),
    [1, 2, 3, 4, 5, 6, 7, 8],
  )
  assert.deepEqual(
    workouts.slice(0, 3).map((w) => w.level),
    ['Beginner', 'Beginner', 'Beginner'],
  )
  assert.ok(workouts.slice(3).every((w) => w.level === 'Intermediate'))
  assert.equal(workouts[0].name, 'Full-Body Starter')
  assert.equal(workouts[7].name, 'Intermediate Challenge')
})

test('every workout is 3 rounds of 4 timed stations, 12 minutes', () => {
  for (const w of workouts) {
    assert.equal(w.minutes, 12)
    assert.equal(w.rounds.length, 3)
    for (const r of w.rounds) {
      assert.equal(r.stations.length, 4)
      for (const st of r.stations) {
        assert.ok(st.workSec > 0, `${w.id} ${st.name} workSec`)
        assert.ok([10, 15].includes(st.restSec), `${w.id} ${st.name} restSec=${st.restSec}`)
        assert.ok(typeof st.exerciseId === 'string' && st.exerciseId.length > 0)
      }
    }
  }
})

test('round rest: 60s after rounds 1 & 2, none after the final round', () => {
  for (const w of workouts) {
    assert.equal(w.rounds[0].roundRestSec, 60)
    assert.equal(w.rounds[1].roundRestSec, 60)
    assert.equal(w.rounds[2].roundRestSec, undefined) // last round ends the workout
    assert.equal(w.rounds[0].build, true) // round 1 is the build round
  }
})

test('per-side flags and rep hints are captured (Legs & Glutes)', () => {
  const legs = workouts.find((w) => w.id === 'BW12-02')
  assert.ok(legs, 'BW12-02 present')
  const lunge = legs.rounds[0].stations.find((s) => s.exerciseId === 'QD04')
  assert.ok(lunge.perSide, 'Walking Lunge is per-side')
  assert.match(lunge.repHint ?? '', /side/i)
  // The plain squat station carries neither.
  const squat = legs.rounds[0].stations.find((s) => s.exerciseId === 'QD09')
  assert.equal(squat.perSide, undefined)
})

test('new bodyweight exercises appear as stations (BK16/BK17/BK18)', () => {
  const ids = new Set(workouts.flatMap((w) => w.rounds.flatMap((r) => r.stations.map((s) => s.exerciseId))))
  for (const id of ['BK16', 'BK17', 'BK18']) assert.ok(ids.has(id), `${id} used`)
})
