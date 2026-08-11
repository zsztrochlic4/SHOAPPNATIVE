// Coach Capability Plan — schema gate for the workout_action proposal kind.
// Proves validateStructuredCoachReply accepts a well-formed workout_action, rejects malformed
// ones to the safe fallback, and that the system prompt still carries every HARD NEVER and only
// advertises actions when opted in.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateStructuredCoachReply, STRUCTURED_COACH_RESPONSE_SCHEMA, STRUCTURED_COACH_FALLBACK, assertsCompletedWorkoutAction, assertsCompletedChangeWithObject, FALSE_CHANGE_CLAIM_FALLBACK } from '../../.sweep-out/backend/coach/structuredResponse.js'
import { validateWorkoutActionPayload, WORKOUT_ACTION_NAMES } from '../../.sweep-out/backend/coach/workoutActions.js'
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

// Graceful degradation (coach action-fallback fix): a MALFORMED proposal must NOT nuke an otherwise
// valid reply into the generic fallback. The text message is kept, the unactionable proposal is
// dropped to kind 'none' (so it can never reach the engine), and proposalDropped is flagged.
test('workout_action with an unknown action DEGRADES: message kept, proposal dropped (never engine-bound)', () => {
  const r = validateStructuredCoachReply(reply({
    kind: 'workout_action', title: 'x', summary: 'y', payload: { action: 'delete_account' },
  }))
  assert.equal(r.ok, true)
  assert.equal(r.reply.proposal.kind, 'none') // the bad action is DROPPED, not surfaced
  assert.equal(r.reply.message, 'Here is a change you asked for.') // the model's text survives
  assert.equal(r.proposalDropped, true)
  assert.match(r.droppedReason, /^bad_workout_action:/)
})

test('workout_action with a prose action (the flash-lite failure) DEGRADES to message-only', () => {
  const r = validateStructuredCoachReply(reply({
    kind: 'workout_action', title: 'Swap Exercise', summary: 'y',
    payload: { action: 'Swap bench press for dumbbell bench press.' },
  }))
  assert.equal(r.ok, true)
  assert.equal(r.reply.proposal.kind, 'none')
  assert.equal(r.proposalDropped, true)
})

test('workout_action with out-of-domain params DEGRADES (proposal dropped, not applied)', () => {
  const r = validateStructuredCoachReply(reply({
    kind: 'workout_action', title: 'x', summary: 'y', payload: { action: 'change_goal', newGoal: 'Powerlifting' },
  }))
  assert.equal(r.ok, true)
  assert.equal(r.reply.proposal.kind, 'none')
  assert.equal(r.proposalDropped, true)
})

test('a broken CORE reply (bad message) still hard-fails to the fallback — degrade is proposal-only', () => {
  const r = validateStructuredCoachReply({
    mode: 'personalised', message: '   ', citations: [], memory: null,
    proposal: { kind: 'workout_action', title: 'x', summary: 'y', payload: { action: 'delete_account' } },
  })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'bad_message')
})

test('the generation schema advertises the bounded action enum (structural steering)', () => {
  const actionSchema = STRUCTURED_COACH_RESPONSE_SCHEMA.properties.proposal.properties.payload.properties.action
  assert.deepEqual([...actionSchema.enum], [...WORKOUT_ACTION_NAMES])
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

// --- no false success: the coach PROPOSES, never claims a change is already done (R5-003 / MT04,06,14) ---

test('a HARD NEVER forbids claiming a workout/program change is already done', () => {
  const hit = HARD_NEVERS.find((n) => /already (?:done|saved|applied)/i.test(n) && /propose/i.test(n))
  assert.ok(hit, 'no HARD NEVER covers false completion claims')
  assert.match(hit, /confirm/i, 'the rule must defer success to the app confirm')
  for (const withActions of [false, true]) {
    assert.ok(buildCoachSystemPrompt({ allowWorkoutActions: withActions }).includes(hit), `missing in prompt (actions=${withActions})`)
  }
})

test('assertsCompletedWorkoutAction FLAGS the eval MT04/06/14 completion claims', () => {
  assert.equal(assertsCompletedWorkoutAction("Noted. I've swapped bench press for incline dumbbell press."), true)
  assert.equal(assertsCompletedWorkoutAction("Okay, I've updated your training days to Tuesday and Thursday."), true)
  assert.equal(assertsCompletedWorkoutAction("Okay, I've applied the deload for this week."), true)
  assert.equal(assertsCompletedWorkoutAction('I swapped that out for you.'), true)
  assert.equal(assertsCompletedWorkoutAction('All set — your goal is now Strength.'), true)
  assert.equal(assertsCompletedWorkoutAction("Done. Your split's been changed."), true)
})

test('assertsCompletedWorkoutAction does NOT flag a PROPOSAL or an observation', () => {
  assert.equal(assertsCompletedWorkoutAction('Want me to swap the bench for incline dumbbell press?'), false)
  assert.equal(assertsCompletedWorkoutAction("I can apply a deload this week — want me to?"), false)
  assert.equal(assertsCompletedWorkoutAction("I'll swap that once you confirm."), false)
  assert.equal(assertsCompletedWorkoutAction("I've noticed your bench has stalled for three weeks."), false)
  assert.equal(assertsCompletedWorkoutAction('Should I change your training days to Tue/Thu?'), false)
  assert.equal(assertsCompletedWorkoutAction(''), false)
})

// A dropped proposal means NOTHING applies this turn; if the kept text still claims completion, that
// is a guaranteed false success, so the message is neutralised to the honest fallback.
test('degraded path NEUTRALISES a message that claims completion when the proposal is dropped', () => {
  const r = validateStructuredCoachReply({
    mode: 'personalised', message: "Okay, I've applied the deload for this week.", citations: [], memory: null,
    proposal: { kind: 'workout_action', title: 'x', summary: 'y', payload: { action: 'Deload this week.' } },
  })
  assert.equal(r.ok, true)
  assert.equal(r.reply.proposal.kind, 'none')
  assert.equal(r.proposalDropped, true)
  assert.equal(r.messageNeutralized, true)
  assert.equal(r.reply.message, STRUCTURED_COACH_FALLBACK) // the false "done" is not surfaced
})

test('degraded path KEEPS a proposing message (no false claim) when the proposal is dropped', () => {
  const r = validateStructuredCoachReply({
    mode: 'personalised', message: 'Want me to apply a deload this week?', citations: [], memory: null,
    proposal: { kind: 'workout_action', title: 'x', summary: 'y', payload: { action: 'not_an_action' } },
  })
  assert.equal(r.ok, true)
  assert.equal(r.reply.proposal.kind, 'none')
  assert.equal(r.proposalDropped, true)
  assert.notEqual(r.messageNeutralized, true)
  assert.equal(r.reply.message, 'Want me to apply a deload this week?') // proposing text survives
})

test('a VALID proposal keeps the model text (runtime neutralisation is degraded-path only)', () => {
  // The confirm card gates the real apply here; the prompt HARD NEVER is what stops a claim in-text,
  // and the eval measures it — the validator must not rewrite an otherwise-actionable reply.
  const r = validateStructuredCoachReply(reply({
    kind: 'workout_action', title: 'Swap bench press', summary: 'An alternative that hits the same muscles.',
    payload: { action: 'swap', fromExerciseId: 'bench_press', reason: 'dislike' },
  }))
  assert.equal(r.ok, true)
  assert.equal(r.reply.proposal.kind, 'workout_action')
  assert.notEqual(r.messageNeutralized, true)
})

// --- no-proposal false success: the reported "your water goal has been updated" with no confirm card.
// The model claimed a goal change is DONE but filed the value as MEMORY (or emitted kind 'none'), so
// nothing applies. That claim must be neutralised and the misfiled memory dropped. ---

test('assertsCompletedChangeWithObject flags a completed GOAL claim, not a bare completion verb', () => {
  assert.equal(assertsCompletedChangeWithObject('Your water goal has been updated to 4 litres per day.'), true)
  assert.equal(assertsCompletedChangeWithObject("I've set your sleep goal to 8 hours."), true)
  assert.equal(assertsCompletedChangeWithObject("I've updated your program."), true)
  // completion verb but NO change object → not flagged here (kept, so ordinary chatty replies survive)
  assert.equal(assertsCompletedChangeWithObject("I've updated my earlier answer about protein timing."), false)
  assert.equal(assertsCompletedChangeWithObject('Want me to set your water goal to 4 litres?'), false)
})

test('a completed GOAL claim with a MEMORY and no workout_action is neutralised (the reported bug)', () => {
  const r = validateStructuredCoachReply({
    mode: 'personalised',
    message: 'Your water goal has been updated to 4 litres per day.',
    citations: [],
    memory: { category: 'water goal', value: '4', evidenceQuote: 'set my water goal to 4 litres', scope: 'stable', sensitivity: 'ordinary' },
    proposal: { kind: 'none' },
  })
  assert.equal(r.ok, true)
  assert.equal(r.reply.message, FALSE_CHANGE_CLAIM_FALLBACK) // the false "updated" is not surfaced
  assert.equal(r.reply.memory, null)                          // the misfiled "4" memory is dropped
  assert.equal(r.reply.proposal.kind, 'none')
  assert.equal(r.messageNeutralized, true)
})

test('an ordinary reply with a completion verb but no change object survives (low false-positive)', () => {
  const r = validateStructuredCoachReply({
    mode: 'general', message: "I've updated my earlier answer — protein needs are per kg of bodyweight.",
    citations: [], memory: null, proposal: { kind: 'none' },
  })
  assert.equal(r.ok, true)
  assert.notEqual(r.messageNeutralized, true)
  assert.match(r.reply.message, /protein needs/)
})

test('a real set_wellness_goal proposal is EXEMPT even if the summary mentions the goal', () => {
  const r = validateStructuredCoachReply({
    mode: 'personalised', message: 'Want me to set your daily water goal to 4 litres?', citations: [], memory: null,
    proposal: { kind: 'workout_action', title: 'Set water goal to 4 L', summary: 'Updates your daily water goal.', payload: { action: 'set_wellness_goal', metric: 'water', value: 4 } },
  })
  assert.equal(r.ok, true)
  assert.equal(r.reply.proposal.kind, 'workout_action')
  assert.equal(r.reply.proposal.payload.action, 'set_wellness_goal')
  assert.notEqual(r.messageNeutralized, true)
})
