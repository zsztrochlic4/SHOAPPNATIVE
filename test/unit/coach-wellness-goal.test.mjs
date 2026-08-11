/**
 * Coach wellness-goal action (node --test) — the coach can adjust the user's daily water/sleep/step
 * goals via the propose→confirm→apply flow. A wellness target is a local Profile patch, not a program
 * change, so it takes no engine regen or safety clamp; bounds are enforced and calorie/macro metrics
 * are refused (nutrition stays qualitative app-wide).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCoachAction } from '../../.sweep-out/backend/runtime/coachActionResolver.js'
import { validateWorkoutActionPayload, WORKOUT_ACTION_NAMES } from '../../.sweep-out/backend/coach/workoutActions.js'

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
