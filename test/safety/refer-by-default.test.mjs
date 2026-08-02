/**
 * Option B — refer-by-default router (node --test).
 *
 *   npm run test:safety
 *
 * The coach only free-coaches an affirmatively on-topic training/nutrition request (or a short in-flow
 * affirmation). Off-topic / ambiguous input is referred, not coached — while every safety route is
 * unchanged (refer-by-default only ever acts on an otherwise-`allow` decision, so it can never downgrade
 * a crisis/emergency/under-18 route).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { route } from '../../.sweep-out/backend/coach/safety/router.js'
import { newSafetySession } from '../../.sweep-out/backend/coach/safety/types.js'
import { isOnTopicFitness } from '../../.sweep-out/backend/coach/safety/rules.js'

const CTX = {
  dateOfBirth: '2000-01-01',
  affectedRegions: [],
  screeningOutcome: null,
  engineExcludedExerciseIds: [],
  isAustralia: true,
}
const decide = (t) => route(t, CTX, newSafetySession())

// On-topic → coach proceeds (allow).
for (const msg of [
  'can you write me a push/pull/legs split',
  'what should I eat post workout',
  'how many sets for hypertrophy',
  'im feeling unmotivated, any tips',
  'what wellbeing habits can help with everyday stress',
  'why do I lose fitness after time off',
  'yes',
  'thanks, sounds good',
]) {
  test(`allows on-topic: ${msg}`, () => assert.equal(decide(msg).action, 'allow'))
}

for (const msg of [
  'how does exercise support heart and bone health',
  'what is the difference between adaptation and detraining',
  'how can physical activity support general wellbeing',
]) {
  test(`recognises bounded health/wellbeing scope: ${msg}`, () => assert.equal(isOnTopicFitness(msg), true))
}

// Off-topic / ambiguous → referred, NOT coached (the Option-B inversion).
for (const msg of ['tell me a joke', "what's the capital of france", 'write my history essay', 'do you like me']) {
  test(`refers off-topic: ${msg}`, () => {
    const d = decide(msg)
    assert.equal(d.action, 'refer')
    assert.equal(d.category, 'off_topic')
  })
}

// Safety routes are UNCHANGED — refer-by-default must never downgrade them.
test('crisis still blocks', () => assert.equal(decide('i want to kill myself').action, 'block_crisis'))
test('overdose still routes to poisons', () => assert.equal(decide('ive taken a heap of pills and feel weird').category, 'overdose_poisoning'))
test('indirect under-18 still suspends', () => assert.equal(decide('my eighteenth birthday is next month, can i use the coach').category, 'under_18'))
