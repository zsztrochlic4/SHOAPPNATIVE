import test from 'node:test'
import assert from 'node:assert/strict'
import { routeAsync } from '../../.sweep-out/backend/coach/safety/router.js'
import { newSafetySession } from '../../.sweep-out/backend/coach/safety/types.js'
import { setClassifierTransport } from '../../.sweep-out/backend/coach/safety/llmClassifier.js'
import { restorablePersistentStates } from '../../.sweep-out/backend/coach/safety/persistedState.js'

setClassifierTransport(async () => '{"categories":[]}')
const INJURED = { dateOfBirth: '2000-01-01', affectedRegions: ['shoulder'], screeningOutcome: 'REFER', engineExcludedExerciseIds: ['CH01'], isAustralia: true }
const ADULT = { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true }

for (const message of [
  'What is a cheap vegetarian meal after training?',
  'Set my water goal to four litres.',
  'Explain the community feature.',
  'Exams are busy, how can I stay consistent?',
]) {
  test(`persistent injury allows unrelated safe request: ${message}`, async () => {
    const decision = await routeAsync(message, INJURED, newSafetySession(['injury']))
    assert.equal(decision.action, 'allow')
  })
}

for (const message of ['Add bench press back to my workout.', 'Can I train through my shoulder injury?', 'Swap in overhead press for me.']) {
  test(`persistent injury still blocks loading request: ${message}`, async () => {
    const decision = await routeAsync(message, INJURED, newSafetySession(['injury']))
    assert.equal(decision.category, 'injury_override')
  })
}

test('explicit benign crisis denial clears stale state when no active signal remains', async () => {
  const session = newSafetySession(['crisis'])
  const decision = await routeAsync('I am not depressed or suicidal, just exhausted from exams. Can I shorten today’s session?', ADULT, session)
  assert.equal(decision.action, 'allow')
  assert.equal(session.active.has('crisis') || session.carriedOver.has('crisis'), false)
})

test('denial cannot clear a concurrent active crisis signal', async () => {
  const session = newSafetySession(['crisis'])
  const decision = await routeAsync('I am not suicidal, but I plan to kill myself tonight.', ADULT, session)
  assert.notEqual(decision.action, 'allow')
})

test('a new conversation restores durable restrictions but never acute crisis/emergency state', () => {
  const restored = restorablePersistentStates(['crisis', 'emergency', 'overdose', 'injury', 'under_18'], 1_000, 30_000)
  assert.deepEqual(restored, ['injury', 'under_18'])
})

test('expired durable safety state is not restored', () => {
  assert.deepEqual(restorablePersistentStates(['injury'], 31_000, 30_000), [])
})
