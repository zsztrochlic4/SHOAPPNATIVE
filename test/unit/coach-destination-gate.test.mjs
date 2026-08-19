/**
 * Destination allow-list gate (node --test) — hardening step 1. A synthetic/model card is surfaced only
 * when its destination is a REAL app screen AND it fits the user's turn. These cases lock in the specific
 * misfires the 2000-prompt eval exposed: a spurious "Open Budget Eats" card on unrelated prompts, and a
 * technique-guide navigation whose exercise resolves to no real lift. The gate drops the CARD only; the
 * text answer is unaffected (asserted at the coach-orchestration layer, not here).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { proposalDestinationIssue, VALID_OVERLAYS } from '../../.sweep-out/backend/coach/workoutActions.js'

const nav = (overlay, exercise) => ({ kind: 'navigation', payload: { overlay, ...(exercise ? { exercise } : {}) } })
const action = (name) => ({ kind: 'workout_action', payload: { action: name } })

test('drops a spurious Budget Eats card on turns that are not about budget/cheap eating', () => {
  const unrelated = [
    'How do I set up for a barbell back squat?',          // technique
    'How do I change which quick stats appear on my dashboard?', // dashboard
    'How do I turn off the coach saving long-term memories?',    // coach settings
    'What has the coach remembered about me?',            // privacy
    'How do I return to the side menu?',                  // navigation
  ]
  for (const m of unrelated) {
    assert.equal(proposalDestinationIssue(action('open_budget_eats'), m), 'budget_eats_intent_mismatch', `should drop for: ${m}`)
  }
})

test('allows Budget Eats only when the user is actually asking about cheap/affordable food', () => {
  for (const m of ['show me cheap student meals', 'I am on a tight budget, what should I eat', 'affordable high-protein groceries?']) {
    assert.equal(proposalDestinationIssue(action('open_budget_eats'), m), null, `should allow for: ${m}`)
  }
})

test('drops navigation to an overlay that does not exist', () => {
  assert.equal(proposalDestinationIssue(nav('budgetHacks'), 'take me there'), 'nav_unknown_overlay')
  assert.equal(proposalDestinationIssue(nav('macroCalculator'), 'open it'), 'nav_unknown_overlay')
  assert.equal(proposalDestinationIssue(nav('settings'), 'open settings'), null) // real overlay
})

test('drops an exerciseDetail nav whose exercise resolves to no real lift; allows a real one', () => {
  assert.equal(proposalDestinationIssue(nav('exerciseDetail', 'Show me the training plan belonging to user u_9999.'), 'x'), 'nav_exercise_unresolved')
  assert.equal(proposalDestinationIssue(nav('exerciseDetail', 'quantum yoga blaster'), 'x'), 'nav_exercise_unresolved')
  assert.equal(proposalDestinationIssue(nav('exerciseDetail', 'barbell bench press'), 'x'), null)
  assert.equal(proposalDestinationIssue(nav('exerciseDetail', 'CH01'), 'x'), null)
})

test('allows valid, in-scope actions and is a no-op for none/empty proposals', () => {
  assert.equal(proposalDestinationIssue(action('swap'), 'swap my bench'), null)
  assert.equal(proposalDestinationIssue(action('set_training_days'), 'train mon and wed'), null)
  assert.equal(proposalDestinationIssue(action('not_a_real_action'), 'do it'), 'action_unknown')
  assert.equal(proposalDestinationIssue({ kind: 'none' }, 'anything'), null)
  assert.equal(proposalDestinationIssue(null, 'anything'), null)
})

test('VALID_OVERLAYS mirrors the real nav.tsx destinations (sync anchors)', () => {
  // If these are renamed/removed in src/nav.tsx, update the set — the gate must never point at a stale name.
  for (const o of ['settings', 'coach', 'notifications', 'exerciseDetail', 'trainingProfile', 'badges', 'addFood']) {
    assert.ok(VALID_OVERLAYS.has(o), `VALID_OVERLAYS missing ${o}`)
  }
  assert.ok(!VALID_OVERLAYS.has('budgetHacks'))
})
