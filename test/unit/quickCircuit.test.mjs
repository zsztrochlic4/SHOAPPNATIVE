// Circuit logic for the time-based quick-workout player: round-major station order,
// per-station transition rest vs. the longer between-rounds rest, and clean finish.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { isTimeSession, nextCircuitCursor, circuitRestSec } from '../../.sweep-out/screens/quickCircuit.js'

/** A 4-station × N-round time circuit, like a built quick workout. */
function circuit(rounds = 3, stations = 4, { restSec = 15, roundRestSec = 60 } = {}) {
  return {
    id: 's',
    dateKey: 'k',
    name: 'Full-Body Starter',
    focus: 'f',
    image: '',
    durationMin: 12,
    volumeKg: 0,
    calories: 0,
    completed: false,
    roundRestSec,
    exercises: Array.from({ length: stations }, (_, i) => ({
      defId: `EX${i}`,
      name: `Station ${i}`,
      image: '',
      targetSets: rounds,
      targetReps: '35s',
      measure: 'time',
      durationSec: 35,
      restSec,
      perSide: false,
      sets: Array.from({ length: rounds }, () => ({ weightKg: 0, reps: 0, done: false })),
    })),
  }
}

/** Walk the whole circuit, returning the visited [ex,round] order and rest-after list. */
function walk(s) {
  let cur = { exIdx: 0, setIdx: 0 }
  const order = []
  const rests = []
  for (let guard = 0; guard < 1000; guard++) {
    order.push(`${cur.exIdx},${cur.setIdx}`)
    s.exercises[cur.exIdx].sets[cur.setIdx].done = true
    const up = nextCircuitCursor(s, cur.exIdx, cur.setIdx)
    if (!up) {
      rests.push('END')
      break
    }
    rests.push(circuitRestSec(s, cur.exIdx, cur.setIdx, up))
    cur = up
  }
  return { order, rests }
}

test('isTimeSession detects a time circuit and ignores rep sessions', () => {
  assert.equal(isTimeSession(circuit()), true)
  const reps = circuit()
  reps.exercises.forEach((e) => delete e.measure)
  assert.equal(isTimeSession(reps), false)
})

test('runs round-major: every station in a round before the next round', () => {
  const { order } = walk(circuit(3, 4))
  assert.deepEqual(order, ['0,0', '1,0', '2,0', '3,0', '0,1', '1,1', '2,1', '3,1', '0,2', '1,2', '2,2', '3,2'])
})

test('short transition rest inside a round, full round rest between rounds, END at the finish', () => {
  const { rests } = walk(circuit(3, 4, { restSec: 15, roundRestSec: 60 }))
  // 12 stations → 11 rests + END. Boundaries after station 4 of rounds 1 and 2.
  assert.deepEqual(rests, [15, 15, 15, 60, 15, 15, 15, 60, 15, 15, 15, 'END'])
})

test('nextCircuitCursor returns null once every station is done', () => {
  const s = circuit(2, 3)
  s.exercises.forEach((e) => e.sets.forEach((x) => (x.done = true)))
  assert.equal(nextCircuitCursor(s, 0, 0), null)
})

test('circuitRestSec falls back to defaults when fields are missing', () => {
  const s = circuit(2, 2)
  delete s.roundRestSec
  delete s.exercises[0].restSec
  assert.equal(circuitRestSec(s, 0, 0, { exIdx: 1, setIdx: 0 }), 15) // transition default
  assert.equal(circuitRestSec(s, 1, 0, { exIdx: 0, setIdx: 1 }), 60) // round-rest default
})
