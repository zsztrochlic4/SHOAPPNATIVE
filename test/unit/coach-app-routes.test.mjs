/**
 * Deterministic app-route grounding (node --test). The coach relays a VERIFIED route on app-help turns
 * instead of trusting the model to recall navigation (which it does at ~22% accuracy). These lock in the
 * intent -> real destination mapping and that ambiguous / non-app turns fall through (return null) so the
 * model still answers them.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAppRoute, synthesizeAppHelpAnswer } from '../../.sweep-out/backend/coach/appRoutes.js'

const cases = [
  ['How do I switch between metric and imperial units?', 'settings.units'],
  ['I want to change to pounds', 'settings.units'],
  ['How do I change which quick stats appear on my dashboard?', 'customize'],
  ['How do I log today’s water, sleep, steps and mindset minutes?', 'logProgress'],
  ['I want to turn off the coach saving long-term memories', 'coach.memoryToggle'],
  ['Can I change the coaching style to be more direct?', 'coach.style'],
  ['How do I set a username to join the community?', 'community.username'],
  ['How do I download a copy of my profile and logs?', 'settings.export'],
  ['I want to manage or cancel my StrengthHub subscription', 'settings.subscription'],
  ['How do I filter exercises by muscle group?', 'workout.library'],
  ['How do I add a food to breakfast?', 'addFood'],
  ['Where do I change my training days?', 'trainingProfile'],
]

for (const [msg, id] of cases) {
  test(`routes "${msg.slice(0, 40)}..." -> ${id}`, () => {
    const r = resolveAppRoute(msg)
    assert.ok(r, 'expected a confident route match')
    assert.equal(r.id, id)
  })
}

test('the relayed answer contains the verified route path', () => {
  const a = synthesizeAppHelpAnswer('How do I switch to pounds?')
  assert.match(a, /Menu . Settings . Units/)
})

test('ambiguous / non-app turns do NOT match (model keeps the turn)', () => {
  for (const m of ['what should I eat tonight', 'hello', 'am I on track for my goal', 'why do I feel sore', 'how do I do a bench press']) {
    assert.equal(resolveAppRoute(m), null, `should not match: ${m}`)
    assert.equal(synthesizeAppHelpAnswer(m), null)
  }
})
