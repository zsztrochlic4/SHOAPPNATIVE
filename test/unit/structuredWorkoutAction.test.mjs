// Coach Capability Plan — schema gate for the workout_action proposal kind.
// Proves validateStructuredCoachReply accepts a well-formed workout_action, rejects malformed
// ones to the safe fallback, and that the system prompt still carries every HARD NEVER and only
// advertises actions when opted in.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateStructuredCoachReply } from '../../.sweep-out/backend/coach/structuredResponse.js'
import { validateWorkoutActionPayload } from '../../.sweep-out/backend/coach/workoutActions.js'
import { buildCoachSystemPrompt, HARD_NEVERS } from '../../.sweep-out/backend/coach/operatingRules.js'

function reply(proposal) {
  return { mode: 'personalised', message: 'Here is a change you asked for.', citations: [], memory: null, proposal }
}

test('valid workout_action proposal passes the structured schema', () => {
  const r = validateStructuredCoachReply(reply({
    kind: 'workout_action', title: 'Swap bench press', summary: 'An alternative that hits the same muscles.',
    payload: { action: 'swap', fromExerciseId: 'bench_press', reason: 'dislike' },
  }))
  assert.equal(r.ok, true)
  assert.equal(r.reply.proposal.kind, 'workout_action')
  assert.equal(r.reply.proposal.payload.action, 'swap')
})

test('workout_action with an unknown action is rejected to the safe fallback', () => {
  const r = validateStructuredCoachReply(reply({
    kind: 'workout_action', title: 'x', summary: 'y', payload: { action: 'delete_account' },
  }))
  assert.equal(r.ok, false)
  assert.match(r.reason, /^bad_workout_action:/)
})

test('workout_action with out-of-domain params is rejected', () => {
  const r = validateStructuredCoachReply(reply({
    kind: 'workout_action', title: 'x', summary: 'y', payload: { action: 'change_goal', newGoal: 'Powerlifting' },
  }))
  assert.equal(r.ok, false)
})

// --- validateWorkoutActionPayload directly ---

test('swap requires a valid id and a known reason', () => {
  assert.equal(validateWorkoutActionPayload({ action: 'swap', fromExerciseId: 'bench_press', reason: 'dislike' }).ok, true)
  assert.equal(validateWorkoutActionPayload({ action: 'swap', fromExerciseId: 'bad id!', reason: 'dislike' }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'swap', fromExerciseId: 'bench_press', reason: 'because' }).ok, false)
})

test('swap: wantedExerciseId only allowed with reason=specific', () => {
  assert.equal(validateWorkoutActionPayload({ action: 'swap', fromExerciseId: 'a', reason: 'specific', wantedExerciseId: 'b' }).ok, true)
  assert.equal(validateWorkoutActionPayload({ action: 'swap', fromExerciseId: 'a', reason: 'specific' }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'swap', fromExerciseId: 'a', reason: 'dislike', wantedExerciseId: 'b' }).ok, false)
})

test('set_training_days: CSV re-validated token-by-token and bounded 2..6', () => {
  assert.equal(validateWorkoutActionPayload({ action: 'set_training_days', days: 'Monday,Wednesday,Friday' }).ok, true)
  assert.equal(validateWorkoutActionPayload({ action: 'set_training_days', days: 'Monday,Funday' }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'set_training_days', days: 'Monday' }).ok, false) // < 2
  assert.equal(validateWorkoutActionPayload({ action: 'set_training_days', days: 'Monday,Monday' }).ok, false) // dupe
})

test('set_session_length must be an offered length; extra keys rejected', () => {
  assert.equal(validateWorkoutActionPayload({ action: 'set_session_length', sessionLengthMin: 45 }).ok, true)
  assert.equal(validateWorkoutActionPayload({ action: 'set_session_length', sessionLengthMin: 33 }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'deload', extra: 1 }).ok, false)
})

test('exam_mode and planned_absence validate their date/mode params', () => {
  assert.equal(validateWorkoutActionPayload({ action: 'exam_mode', startDate: '2026-11-01', endDate: '2026-11-21' }).ok, true)
  assert.equal(validateWorkoutActionPayload({ action: 'exam_mode', startDate: 'soon', endDate: '2026-11-21' }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'exam_mode', startDate: '2026-11-21', endDate: '2026-11-01' }).ok, false) // end < start
  assert.equal(validateWorkoutActionPayload({ action: 'planned_absence', mode: 'full_pause', startDate: '2026-12-20', endDate: '2027-01-05' }).ok, true)
  assert.equal(validateWorkoutActionPayload({ action: 'planned_absence', mode: 'holiday', startDate: '2026-12-20', endDate: '2027-01-05' }).ok, false)
})

test('nudge_log and start_session enforce their enums', () => {
  assert.equal(validateWorkoutActionPayload({ action: 'nudge_log', kind: 'water' }).ok, true)
  assert.equal(validateWorkoutActionPayload({ action: 'nudge_log', kind: 'vibes' }).ok, false)
  assert.equal(validateWorkoutActionPayload({ action: 'start_session', variant: 'quick15' }).ok, true)
  assert.equal(validateWorkoutActionPayload({ action: 'start_session', variant: 'marathon' }).ok, false)
})

// --- prompt invariants ---

test('every HARD NEVER survives in the built system prompt (with and without actions)', () => {
  for (const withActions of [false, true]) {
    const prompt = buildCoachSystemPrompt({ allowWorkoutActions: withActions })
    for (const never of HARD_NEVERS) assert.ok(prompt.includes(never), `missing HARD NEVER: ${never.slice(0, 40)}…`)
  }
})

test('the workout_action allowlist only appears when actioning is opted in', () => {
  assert.ok(!buildCoachSystemPrompt().includes('WORKOUT ACTIONS'))
  assert.ok(!buildCoachSystemPrompt({ allowWorkoutActions: false }).includes('WORKOUT ACTIONS'))
  const on = buildCoachSystemPrompt({ allowWorkoutActions: true })
  assert.ok(on.includes('WORKOUT ACTIONS'))
  assert.ok(on.includes('workout_action proposal may only use payload.action'))
})
