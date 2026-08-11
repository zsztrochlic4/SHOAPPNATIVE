/**
 * Coach wellness-goal action (node --test) — the coach can adjust the user's daily water/sleep/step
 * goals via the propose→confirm→apply flow. A wellness target is a local Profile patch, not a program
 * change, so it takes no engine regen or safety clamp; bounds are enforced and calorie/macro metrics
 * are refused (nutrition stays qualitative app-wide).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCoachAction } from '../../.sweep-out/backend/runtime/coachActionResolver.js'
import { validateWorkoutActionPayload, WORKOUT_ACTION_NAMES, synthesizeWellnessGoalProposal } from '../../.sweep-out/backend/coach/workoutActions.js'

const state = { backendUser: { uid: 'u' }, program: null, instances: [], programDoc: null }

test('set_wellness_goal resolves to the right profile patch', () => {
  const w = resolveCoachAction(state, { action: 'set_wellness_goal', metric: 'water', value: 4 })
  assert.equal(w.ok, true)
  assert.equal(w.apply, 'profile_patch')
  assert.deepEqual(w.patch, { waterTargetL: 4 })
  assert.deepEqual(resolveCoachAction(state, { action: 'set_wellness_goal', metric: 'sleep', value: 8.5 }).patch, { sleepTargetH: 8.5 })
  assert.deepEqual(resolveCoachAction(state, { action: 'set_wellness_goal', metric: 'steps', value: 12000 }).patch, { stepTarget: 12000 })
})

test('set_wellness_goal enforces bounds and refuses non-wellness metrics', () => {
  assert.equal(validateWorkoutActionPayload({ action: 'set_wellness_goal', metric: 'water', value: 99 }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'set_wellness_goal', metric: 'water', value: 0.1 }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'set_wellness_goal', metric: 'steps', value: 50 }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'set_wellness_goal', metric: 'calories', value: 2000 }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'set_wellness_goal', metric: 'macros', value: 3 }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'set_wellness_goal', metric: 'water', value: 3, sneaky: 1 }).ok, false)
})

test('a wellness change never touches the program (no regen / no engine clamp)', () => {
  const w = resolveCoachAction(state, { action: 'set_wellness_goal', metric: 'water', value: 3 })
  assert.notEqual(w.apply, 'regen')
  assert.notEqual(w.apply, 'patch')
})

test('set_wellness_goal is in the action allowlist', () => {
  assert.ok(WORKOUT_ACTION_NAMES.includes('set_wellness_goal'))
})

// --- deterministic backstop: flash-lite often asks in prose instead of emitting the action, so the
// server synthesises the proposal when the "set my <metric> goal to N" intent is unambiguous. ---

test('synthesizeWellnessGoalProposal builds a valid proposal for clear set-goal requests', () => {
  const w = synthesizeWellnessGoalProposal('can you set my water goal to 4 litres a day')
  assert.ok(w)
  assert.deepEqual(w.payload, { action: 'set_wellness_goal', metric: 'water', value: 4 })
  assert.match(w.message, /confirm/i)
  assert.equal(validateWorkoutActionPayload(w.payload).ok, true)
  assert.deepEqual(synthesizeWellnessGoalProposal('please make my sleep goal 8.5 hours').payload, { action: 'set_wellness_goal', metric: 'sleep', value: 8.5 })
  assert.deepEqual(synthesizeWellnessGoalProposal('update my step goal to 12000').payload, { action: 'set_wellness_goal', metric: 'steps', value: 12000 })
  assert.deepEqual(synthesizeWellnessGoalProposal('raise my step goal to 10k').payload, { action: 'set_wellness_goal', metric: 'steps', value: 10000 })
})

test('synthesizeWellnessGoalProposal returns null when it is not an absolute set-goal request', () => {
  assert.equal(synthesizeWellnessGoalProposal('what is my water goal'), null)        // a question, not a change
  assert.equal(synthesizeWellnessGoalProposal('how do i drink more water'), null)     // no goal/target word
  assert.equal(synthesizeWellnessGoalProposal('set my water goal'), null)             // no number
  assert.equal(synthesizeWellnessGoalProposal('increase my water goal by 1 litre'), null) // relative — needs current value
  assert.equal(synthesizeWellnessGoalProposal('set my water goal to 99 litres'), null)     // out of range → let the model caution
  assert.equal(synthesizeWellnessGoalProposal('set my calorie goal to 2000'), null)        // not a wellness metric (nutrition is qualitative)
})
