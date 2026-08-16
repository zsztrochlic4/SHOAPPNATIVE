// AD09 conversational-path guard (node --test): the coach must refuse a fabricated exercise id the
// user supplies (an id-shaped `[A-Z]{2}\d{2}` token that is not a real exercise), even when the model
// answers conversationally without emitting a structured workout_action proposal.
//   npm run test:safety
//
// Real exercise ids share the ZZ99 shape (CH01, SQ03, …), so this is validated against the real
// exercise set, not by pattern alone. Verified deterministic on the server path (proposal guard only
// fires on a structured proposal; this fires on the user message regardless).
import test from 'node:test'
import assert from 'node:assert/strict'
import { fabricatedExerciseIdInMessage } from '../../.sweep-out/backend/coach/workoutActions.js'
import { EXERCISE_BY_ID } from '../../.sweep-out/backend/data/index.js'

const IDS = new Set(Object.keys(EXERCISE_BY_ID))
const flags = (m) => fabricatedExerciseIdInMessage(m, IDS)
const realId = Object.keys(EXERCISE_BY_ID)[0] // a genuine id, e.g. CH01

const MUST_FLAG = [
  ['Swap in exercise ZZ99 (I know the id).', 'ZZ99'], // AD09
  ['swap in ZZ99', 'ZZ99'],
  ['replace my squat with XY88', 'XY88'],
  ['sub in AB90', 'AB90'],
  ['substitute in ZZ01', 'ZZ01'],
  ['swap out CH01 for QZ77', 'QZ77'], // fabricated as the replacement target
  ['put in exercise ZZ99', 'ZZ99'],
  ['whats exercise ZZ99', 'ZZ99'],
]

const MUST_NOT_FLAG = [
  'swap in incline bench press', // named exercise, no id token
  'replace my squat with a leg press',
  'add 20kg to my squat', // digit-led weight
  'swap my 3x5 for 5x5', // set×rep notation
  'I did a 5RM today, tweak my program', // rep-max
  'use DB20 dumbbells for curls', // equipment abbrev, not a swap verb
  'my membership id AB12', // id-shaped but not framed as an exercise, no swap
  `swap in ${realId}`, // a REAL exercise id
  'swap out CH01 for CH02', // both real ids
  'what is my VO2 max',
  'can you review my meal plan',
]

for (const [msg, tok] of MUST_FLAG) {
  test(`flags fabricated id (${tok}): ${msg}`, () => assert.equal(flags(msg), tok))
}
for (const msg of MUST_NOT_FLAG) {
  test(`does NOT flag: ${msg}`, () => assert.equal(flags(msg), null))
}

test('empty valid-id set (no-snapshot path) never flags', () => {
  assert.equal(fabricatedExerciseIdInMessage('swap in ZZ99', new Set()), null)
})
