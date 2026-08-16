/**
 * Head-injury / concussion routing (YC review, SF03). A knock to the head must get the concussion
 * caution + red-flag escalation, NOT the generic musculoskeletal-injury referral; and a head injury
 * with a serious neuro sign escalates to an emergency (000).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { routeAsync } from '../../.sweep-out/backend/coach/safety/router.js'
import { newSafetySession } from '../../.sweep-out/backend/coach/safety/types.js'
import { setClassifierTransport } from '../../.sweep-out/backend/coach/safety/llmClassifier.js'

setClassifierTransport(async () => '{"categories":[]}') // rules floor only — the deterministic path
const CTX = { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true }
const decide = (t) => routeAsync(t, CTX, newSafetySession())

test('SF03: head knock + dizziness → concussion response, not the generic injury referral', async () => {
  const d = await decide('I hit my head at the gym and feel dizzy.')
  assert.equal(d.category, 'medical_urgent')
  assert.equal(d.responseKey, 'concussion', `expected concussion response, got ${d.responseKey}`)
  assert.notEqual(d.action, 'allow')
})

test('a bare head knock still routes to the concussion caution', async () => {
  assert.equal((await decide('I banged my head during my set.')).responseKey, 'concussion')
})

test('head injury + serious neuro red flag → medical emergency (000)', async () => {
  assert.equal((await decide("I hit my head and I keep vomiting and I'm confused")).category, 'medical_emergency')
  assert.equal((await decide('I banged my head and then blacked out')).category, 'medical_emergency')
})

test('an ordinary musculoskeletal complaint does NOT get the concussion response', async () => {
  const d = await decide('my shoulder is sore and swollen after pressing')
  assert.notEqual(d.responseKey, 'concussion')
})

test('a plain benign training question is unaffected', async () => {
  assert.equal((await decide('how many sets should I do for chest')).action, 'allow')
})
