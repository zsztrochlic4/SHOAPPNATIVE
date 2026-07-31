// Circuit logic for the time-based quick-workout player: round-major station order,
// per-station transition rest vs. the longer between-rounds rest, and clean finish.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { isTimeSession, nextCircuitCursor, circuitRestSec, switchSidesAtSec } from '../../.sweep-out/screens/quickCircuit.js'

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

test('a single-round workout has only transition rests, no round rest, then END', () => {
  const { order, rests } = walk(circuit(1, 4))
  assert.deepEqual(order, ['0,0', '1,0', '2,0', '3,0'])
  assert.deepEqual(rests, [15, 15, 15, 'END']) // never a 60s round rest
})

test('a single-station circuit is all round boundaries (every advance is a new round)', () => {
  const { order, rests } = walk(circuit(3, 1))
  assert.deepEqual(order, ['0,0', '0,1', '0,2'])
  assert.deepEqual(rests, [60, 60, 'END']) // each step crosses into a new round
})

test('nextCircuitCursor prefers the next round over a station missed earlier in the current round', () => {
  // Round 0 station 0 was skipped, stations 1 & 2 done. With a round 1 still to
  // come, the circuit moves ON (round 1, station 0) rather than doubling back —
  // keeping forward momentum; the skipped station is swept up at the very end.
  const s = circuit(2, 3)
  s.exercises[1].sets[0].done = true
  s.exercises[2].sets[0].done = true
  assert.deepEqual(nextCircuitCursor(s, 2, 0), { exIdx: 0, setIdx: 1 })
})

test('nextCircuitCursor sweeps up a missed earlier station once no later rounds remain', () => {
  // Single round, last station reached, an earlier station still not done → the
  // last-resort branch returns it so the workout can actually complete.
  const s = circuit(1, 3)
  s.exercises[1].sets[0].done = true
  s.exercises[2].sets[0].done = true
  assert.deepEqual(nextCircuitCursor(s, 2, 0), { exIdx: 0, setIdx: 0 })
})

test('switchSidesAtSec is the half-way point, and safe (0) for a non-positive duration', () => {
  assert.equal(switchSidesAtSec(40), 20)
  assert.equal(switchSidesAtSec(35), 18) // odd durations round to nearest second
  assert.equal(switchSidesAtSec(1), 1)
  assert.equal(switchSidesAtSec(0), 0)
  assert.equal(switchSidesAtSec(-10), 0)
})
