// Deterministic goal-direction backstop: a body-weight trend must be read against the goal's INTENDED
// direction. The model praised a downward trend for a muscle-building goal; this guarantees it can't.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { isProgressQuestion, synthesizeGoalProgressReply } from '../../.sweep-out/backend/coach/goalProgress.js'

const muscle = { goal: 'Hypertrophy', name: 'Alex', goalWeightKg: 78, recentPRs: 'New bests in the latest session: Bench 106 kg.', sessionsNote: 'you have completed 8 of your 8 recent sessions' }
const fatloss = { goal: 'Fat Loss', name: 'Sam', goalWeightKg: 70 }

test('does not fire on a non-progress question', () => {
  assert.equal(synthesizeGoalProgressReply({ ...muscle, currentKg: 74, priorKg: 75 }, 'how do I squat?'), null)
})

test('recognises progress questions', () => {
  for (const q of ['am I on track for my goal?', 'am I making progress', "how's my progress going", 'is this working']) {
    assert.equal(isProgressQuestion(q), true, q)
  }
  assert.equal(isProgressQuestion('what should I eat tonight'), false)
})

test('muscle goal + DOWNWARD weight = moving AWAY (never praised as good)', () => {
  const r = synthesizeGoalProgressReply({ ...muscle, currentKg: 74.2, priorKg: 75.0 }, 'am I on track for my goal?')
  assert.ok(r, 'should produce a reply')
  assert.match(r, /away/i)
  assert.doesNotMatch(r, /positive sign|good sign|great progress on (?:the )?scale/i)
  assert.match(r, /muscle/i)
  // owner rules: no calorie/macro numbers, no dashes
  assert.doesNotMatch(r, /\bcalorie|kcal|\bgrams?\b|\bmacro/i)
  assert.doesNotMatch(r, /[—–]| - /)
})

test('muscle goal + UPWARD weight = on track', () => {
  const r = synthesizeGoalProgressReply({ ...muscle, currentKg: 76, priorKg: 75 }, 'am I making progress?')
  assert.ok(r)
  assert.match(r, /what you want|trending up/i)
  assert.doesNotMatch(r, /away/i)
})

test('fat-loss goal + DOWNWARD weight = correct direction', () => {
  const r = synthesizeGoalProgressReply({ ...fatloss, currentKg: 74, priorKg: 76 }, 'am I on track?')
  assert.ok(r)
  assert.match(r, /want|direction/i)
  assert.doesNotMatch(r, /away/i)
})

test('fat-loss goal + UPWARD weight = moving away', () => {
  const r = synthesizeGoalProgressReply({ ...fatloss, currentKg: 77, priorKg: 76 }, 'am I on track?')
  assert.ok(r)
  assert.match(r, /away/i)
})

test('no weight logged = null (the model answers normally)', () => {
  assert.equal(synthesizeGoalProgressReply({ ...muscle, currentKg: null, priorKg: null }, 'am I on track?'), null)
})

test('general-fitness goal is weight-direction-neutral', () => {
  const r = synthesizeGoalProgressReply({ goal: 'General Fitness', currentKg: 80, priorKg: 82 }, 'am I on track?')
  assert.ok(r)
  assert.doesNotMatch(r, /away|moving toward/i)
  assert.match(r, /consistency|how you feel|showing up/i)
})
