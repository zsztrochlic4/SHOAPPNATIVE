/**
 * Training-schedule edits are on-topic (node --test).
 *
 *   npm run test:safety
 *
 * A request to move or rearrange training days ("change monday to saturday") is a coaching request, not
 * off-topic. Two paths are covered:
 *   1. deterministic refer-by-default recognises it as on-topic (isScheduleEditIntent / isOnTopicFitness);
 *   2. when the LLM classifier wobbles and tags it off_topic, the router RESCUES it to coaching.
 * The rescue only ever relaxes the off_topic scope route: a genuinely off-topic message is still referred,
 * and a crisis is still blocked even when the classifier mislabels it off_topic (rules floor + the rescue
 * only firing on category off_topic).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { route, routeAsync } from '../../.sweep-out/backend/coach/safety/router.js'
import { newSafetySession } from '../../.sweep-out/backend/coach/safety/types.js'
import { setClassifierTransport } from '../../.sweep-out/backend/coach/safety/llmClassifier.js'
import { isScheduleEditIntent, isOnTopicFitness } from '../../.sweep-out/backend/coach/safety/rules.js'

const CTX = { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true }

/* -------- Pure recognizer -------- */
for (const msg of [
  'change monday to saturday',
  'move my monday session to saturday',
  'swap my training days around',
  'can you rearrange my schedule',
  'shift saturday to sunday',
  'switch my leg day to friday',
]) {
  test(`isScheduleEditIntent true: ${msg}`, () => assert.equal(isScheduleEditIntent(msg), true))
}
for (const msg of [
  'i had a rough monday',            // weekday but no edit verb
  'change my mind',                  // edit verb but no day/schedule
  "what's the capital of france",    // neither
  'i sat down for a while',          // 'sat' must not false-match Saturday
  'the sun is out today',            // 'sun' must not false-match Sunday
]) {
  test(`isScheduleEditIntent false: ${msg}`, () => assert.equal(isScheduleEditIntent(msg), false))
}

/* -------- Deterministic path (sync route, stub classifier) allows a schedule edit -------- */
for (const msg of ['change monday to saturday', 'move my monday session to saturday', 'swap my training days around']) {
  test(`sync route allows schedule edit: ${msg}`, () => {
    const d = route(msg, CTX, newSafetySession())
    assert.equal(d.action, 'allow')
    assert.equal(d.intent, 'coaching')
  })
}

/* -------- Classifier-off_topic path: schedule edit rescued, real off-topic still referred -------- */
test('classifier off_topic is RESCUED for a schedule edit, but a true off-topic stays referred', async () => {
  setClassifierTransport(async () => '{"categories":["off_topic"]}')
  const edit = await routeAsync('change monday to saturday', CTX, newSafetySession())
  assert.equal(edit.action, 'allow')
  assert.equal(edit.intent, 'coaching')

  const offTopic = await routeAsync('what is the capital of france', CTX, newSafetySession())
  assert.equal(offTopic.action, 'refer')
  assert.equal(offTopic.category, 'off_topic')
})

/* -------- The rescue can NEVER rescue a safety route, even if the classifier mislabels it off_topic -------- */
test('a crisis is still blocked when the classifier wrongly returns off_topic (rules floor + off_topic-only rescue)', async () => {
  setClassifierTransport(async () => '{"categories":["off_topic"]}')
  const d = await routeAsync('i want to kill myself tonight', CTX, newSafetySession())
  assert.notEqual(d.action, 'allow')
  assert.notEqual(d.category, 'off_topic')
})

test('isOnTopicFitness includes schedule edits', () => {
  assert.equal(isOnTopicFitness('change monday to saturday'), true)
})

// The rescue is deliberately based on the TIGHT schedule-edit recognizer, not the looser
// isOnTopicFitness (which substring-matches), so an off-topic message the classifier flags is not
// rescued just because a fitness fragment appears inside an unrelated word.
test('a real off-topic message the classifier flags off_topic is NOT rescued', async () => {
  setClassifierTransport(async () => '{"categories":["off_topic"]}')
  const d = await routeAsync('tell me a joke', CTX, newSafetySession())
  assert.equal(d.action, 'refer')
  assert.equal(d.category, 'off_topic')
})
