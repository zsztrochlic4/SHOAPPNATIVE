import test from 'node:test'
import assert from 'node:assert/strict'
import { synthesizeBoundedActionProposal, validateWorkoutActionPayload } from '../../.sweep-out/backend/coach/workoutActions.js'

const cases = [
  ['Start a quick workout for me now, I only have 15 minutes.', { action: 'start_session', variant: 'quick15' }],
  ['Start my full workout for today.', { action: 'start_session', variant: 'full' }],
  ['Change my training days to Tuesday, Thursday and Saturday.', { action: 'set_training_days', days: 'Tuesday,Thursday,Saturday' }],
  ['Make my workouts fit into 30 minutes.', { action: 'set_session_length', sessionLengthMin: 30 }],
  ['Give me a deload week.', { action: 'deload' }],
  ['Change my goal to build muscle.', { action: 'change_goal', newGoal: 'Hypertrophy' }],
  ['I missed today. Mark it as an exempt no-penalty rest day.', { action: 'catch_up', mode: 'exempt' }],
  ['Reschedule my training to Monday, Wednesday and Friday.', { action: 'reschedule_days', days: 'Monday,Wednesday,Friday' }],
]

for (const [message, expected] of cases) {
  test(`bounded action emits valid proposal: ${message}`, () => {
    const proposal = synthesizeBoundedActionProposal(message, new Date('2026-08-13T00:00:00+10:00'))
    assert.ok(proposal, 'expected a deterministic proposal')
    assert.deepEqual(proposal.payload, expected)
    assert.equal(validateWorkoutActionPayload(proposal.payload).ok, true)
    assert.match(proposal.message, /confirm/i)
    assert.doesNotMatch(proposal.message, /already|done|i['’]ll start/i)
  })
}

test('exam mode produces a bounded deterministic date range', () => {
  const proposal = synthesizeBoundedActionProposal('Put me in exam mode for the next two weeks.', new Date('2026-08-13T12:00:00+10:00'))
  assert.deepEqual(proposal.payload, { action: 'exam_mode', startDate: '2026-08-13', endDate: '2026-08-26' })
  assert.equal(validateWorkoutActionPayload(proposal.payload).ok, true)
})

test('planned absence parses explicit calendar dates and pause mode', () => {
  const proposal = synthesizeBoundedActionProposal('I will be away from 20 August 2026 to 27 August 2026. Pause training completely for those dates.')
  assert.deepEqual(proposal.payload, { action: 'planned_absence', mode: 'full_pause', startDate: '2026-08-20', endDate: '2026-08-27' })
})

for (const message of [
  'What are my training days?',
  'Should I do a deload?',
  'Make my workouts shorter.',
  'Change my training days.',
  'Change my goal to build muscle after exams.',
  'I missed a session. Shift every remaining workout forward.',
  'I missed a workout. Fold it into my next session.',
  'Open Budget Eats for me.', // Budget Eats was removed from the app; this must never produce an action.
  'Tell me about Budget Eats.',
]) test(`ambiguous/non-action stays prose-only: ${message}`, () => assert.equal(synthesizeBoundedActionProposal(message), null))
