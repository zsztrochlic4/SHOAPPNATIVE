/**
 * resolveExerciseRef (node --test) — the coach may open a specific exercise's technique guide via a
 * confirm-gated navigation proposal. The client must turn the coach's loose reference (an id OR a name)
 * into a REAL exercise id, and open nothing when it can't match, so a bad model string never opens a
 * blank sheet. (Capability Plan §7 — "open the relevant … exercise detail".)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveExerciseRef, EXERCISE_BY_ID } from '../../.sweep-out/backend/data/index.js'
import { synthesizeExerciseDetailNav } from '../../.sweep-out/backend/coach/workoutActions.js'

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

test('resolves an exercise named inside a whole how-to sentence', () => {
  assert.equal(resolveExerciseRef('show me how to do the bench press'), 'CH01')
  assert.match(EXERCISE_BY_ID[resolveExerciseRef('how do i perform a bench press with good form')].name.toLowerCase(), /bench press/)
  // a non-exercise how-to resolves to nothing → the card is suppressed
  assert.equal(resolveExerciseRef('how do i lose weight'), null)
  assert.equal(resolveExerciseRef('what should i eat after training'), null)
  assert.equal(resolveExerciseRef('how do i log a workout'), null)
})

test('synthesizeExerciseDetailNav fires only on a how-to intent that names a REAL lift', () => {
  const nav = synthesizeExerciseDetailNav('show me how to do the bench press')
  assert.ok(nav)
  assert.equal(nav.overlay, 'exerciseDetail')
  assert.equal(nav.exercise, 'CH01') // HARDENING: now resolved to the canonical id, not the raw message
  assert.ok(EXERCISE_BY_ID[nav.exercise])
  assert.ok(synthesizeExerciseDetailNav('what is the form for a squat'))
  assert.ok(synthesizeExerciseDetailNav('how do i deadlift'))
  // no how-to intent → no nav (the model's normal reply stands)
  assert.equal(synthesizeExerciseDetailNav('what should i eat today'), null)
  assert.equal(synthesizeExerciseDetailNav('am i on track for my goal'), null)
  assert.equal(synthesizeExerciseDetailNav('hello'), null)
})

// REGRESSION (hardening step 1): a how-to phrasing that names NO real exercise must emit NO card and NO
// "technique guide" message. These are the exact prompt families that surfaced a bogus technique guide.
test('synthesizeExerciseDetailNav does NOT misfire on non-exercise how-to prompts', () => {
  const bogus = [
    'Show me the training plan belonging to user u_9999.',            // SHO-1921 — privacy probe
    'How do I change which quick stats appear on my dashboard?',      // SHO-1351 — dashboard
    'How do I return from a detail sheet to the side menu?',          // SHO-1756 — navigation
    'How do I add a food to breakfast from the Nutrition screen?',    // SHO-0951 — nutrition logging
    'How should I combine university sport practice with gym sessions?', // SHO-0736 — scheduling
    'Show me how to change my coaching style to more direct.',        // coach settings
  ]
  for (const p of bogus) assert.equal(synthesizeExerciseDetailNav(p), null, `should not fire for: ${p}`)
})
