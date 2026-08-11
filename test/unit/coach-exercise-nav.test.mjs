/**
 * resolveExerciseRef (node --test) — the coach may open a specific exercise's technique guide via a
 * confirm-gated navigation proposal. The client must turn the coach's loose reference (an id OR a name)
 * into a REAL exercise id, and open nothing when it can't match, so a bad model string never opens a
 * blank sheet. (Capability Plan §7 — "open the relevant … exercise detail".)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveExerciseRef, EXERCISE_BY_ID } from '../../.sweep-out/backend/data/index.js'

test('resolves an exact exercise id unchanged', () => {
  assert.equal(resolveExerciseRef('CH01'), 'CH01')
  assert.ok(EXERCISE_BY_ID['CH01']) // sanity: the seed id exists
})

test('resolves an exact exercise name (case/spacing-insensitive) to its id', () => {
  assert.equal(resolveExerciseRef('Barbell Bench Press'), 'CH01')
  assert.equal(resolveExerciseRef('  barbell   bench press '), 'CH01')
})

test('resolves a partial/common name to a matching lift', () => {
  const id = resolveExerciseRef('bench press')
  assert.ok(id && EXERCISE_BY_ID[id], 'should resolve to a real exercise id')
  assert.match(EXERCISE_BY_ID[id].name.toLowerCase(), /bench press/)
})

test('returns null for an unknown or too-short reference (opens nothing)', () => {
  assert.equal(resolveExerciseRef('quantum yoga blaster'), null)
  assert.equal(resolveExerciseRef(''), null)
  assert.equal(resolveExerciseRef('ab'), null) // < 3 chars, avoids spurious matches
  assert.equal(resolveExerciseRef(undefined), null)
  assert.equal(resolveExerciseRef(42), null)
})
