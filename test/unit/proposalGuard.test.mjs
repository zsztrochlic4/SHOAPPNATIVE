/**
 * Surfacing-time semantic guard for model-emitted workout_action proposals (YC review: AD07, AD09).
 * A proposal that passes the shape/format gate can still name an exercise id that does not exist, or a
 * personal record the user never logged — this guard rejects those before a confirm card is shown.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { proposalSurfacingIssue } from '../../.sweep-out/backend/coach/workoutActions.js'

const IDS = new Set(['CH01', 'CH02', 'QD01', 'QD05'])
const PRS = 'New bests in the latest session (2026-08-14): barbell-bench-press est-1RM 108kg (was 106kg); deadlift est-1RM 163kg (was 160kg).'
const ctx = { validExerciseIds: IDS, recentPRsText: PRS }

// ---- AD09: swap into / out of an id that does not exist ----
test('AD09: rejects a swap into an unknown exercise id (ZZ99)', () => {
  const r = proposalSurfacingIssue({ action: 'swap', fromExerciseId: 'CH01', reason: 'specific', wantedExerciseId: 'ZZ99' }, ctx)
  assert.ok(r && r.reason === 'swap_unknown_wanted')
  assert.match(r.coachLine, /don't recognise/i)
})
test('AD09: rejects a swap FROM an unknown id', () => {
  assert.equal(proposalSurfacingIssue({ action: 'swap', fromExerciseId: 'ZZ99', reason: 'dislike' }, ctx)?.reason, 'swap_unknown_from')
})
test('AD09: allows a swap between two real ids', () => {
  assert.equal(proposalSurfacingIssue({ action: 'swap', fromExerciseId: 'CH01', reason: 'specific', wantedExerciseId: 'CH02' }, ctx), null)
})
test('AD09: allows an engine-picked swap (no wanted id) of a real exercise', () => {
  assert.equal(proposalSurfacingIssue({ action: 'swap', fromExerciseId: 'QD01', reason: 'dislike' }, ctx), null)
})

// ---- AD07: publishing an un-logged / implausible PR ----
test('AD07: rejects an implausible PR far beyond logged bests (300kg)', () => {
  const r = proposalSurfacingIssue({ action: 'share_pr', prExerciseId: 'barbell-bench-press', prValue: 300 }, ctx)
  assert.ok(r && r.reason === 'pr_unbacked')
  assert.match(r.coachLine, /actually logged/i)
})
test('AD07: rejects any share_pr when nothing is logged', () => {
  assert.equal(proposalSurfacingIssue({ action: 'share_pr', prExerciseId: 'x', prValue: 100 }, { validExerciseIds: IDS, recentPRsText: '' })?.reason, 'pr_unbacked')
})
test('AD07: allows a plausible PR near the logged best', () => {
  assert.equal(proposalSurfacingIssue({ action: 'share_pr', prExerciseId: 'barbell-bench-press', prValue: 110 }, ctx), null)
})

// ---- untouched actions ----
test('non-id/non-PR actions are unaffected', () => {
  assert.equal(proposalSurfacingIssue({ action: 'change_goal', newGoal: 'Hypertrophy' }, ctx), null)
  assert.equal(proposalSurfacingIssue({ action: 'deload' }, ctx), null)
  assert.equal(proposalSurfacingIssue(null, ctx), null)
})
