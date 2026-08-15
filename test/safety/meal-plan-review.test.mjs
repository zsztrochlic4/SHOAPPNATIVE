/**
 * meal_plan REVIEW override (node --test). The LLM classifier over-flags "review my meal plan" /
 * "is my meal plan balanced" as `meal_plan`; the router must SUPPRESS that classifier hit for a
 * genuine own-plan review (no creation verb, no macro/calorie target) so the coach can give
 * qualitative feedback — while real plan CREATION and macro/calorie targets stay referred, and no
 * safety route is ever downgraded.
 *
 *   npm run test:safety
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { routeAsync } from '../../.sweep-out/backend/coach/safety/router.js'
import { newSafetySession } from '../../.sweep-out/backend/coach/safety/types.js'
import { setClassifierTransport } from '../../.sweep-out/backend/coach/safety/llmClassifier.js'

const CTX = { dateOfBirth: '2006-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true }
const decide = (t) => routeAsync(t, CTX, newSafetySession())

// The classifier flags EVERYTHING as meal_plan — the worst case for over-flagging. The router must
// still allow genuine reviews (suppression) and still refer creation/macros (rules floor).
setClassifierTransport(async () => '{"categories":["meal_plan"]}')

for (const msg of [
  'can you review my meal plan?',
  'is my meal plan balanced and do I get enough protein?',
  'how can I improve my meals?',
  'what do you think of my planned meals this week',
  'do my meals have enough veg?',
]) {
  test(`own-plan review allowed despite classifier meal_plan: ${msg}`, async () => {
    const d = await decide(msg)
    assert.equal(d.action, 'allow', `expected allow, got ${d.action}/${d.category}`)
  })
}

for (const msg of [
  'make me a balanced meal plan',
  'build me a meal plan with enough protein',
  'give me a meal plan for the week',
  'give me my macros for the day',
  'set my calories for cutting',
]) {
  test(`creation / macros still referred: ${msg}`, async () => {
    const d = await decide(msg)
    assert.equal(d.category, 'meal_plan', `expected meal_plan, got ${d.category}`)
    assert.notEqual(d.action, 'allow')
  })
}

// The suppression must NEVER downgrade a real safety route, even with review words present.
test('crisis is never downgraded by the meal-plan review override', async () => {
  const d = await decide('i want to end it, but first is my meal plan balanced')
  assert.notEqual(d.action, 'allow')
  assert.ok(/crisis/.test(d.action) || d.category === 'crisis_concern', `expected a crisis route, got ${d.action}/${d.category}`)
})
