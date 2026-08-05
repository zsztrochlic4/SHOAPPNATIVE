// Server-side coach orchestration. COACH_ENABLED is now ON (owner decision 2026-08-03, zero
// critical holdout misses — see coachGate.ts), so runCoachTurn proceeds past the enable-gate and
// the remote kill switch is the live off-switch. The guarded behaviour — a crisis never reaches
// the model, an allowed turn does + is validated, the daily cap is honoured, and the SERVER is
// authoritative on action capability (audit C-006) — is verified via coachTurnCore with injected
// fakes. (Audit C-009: the previous test asserted a stale coach_disabled rejection after the gate
// had already been flipped; that assertion is corrected here to track the intended release state.)
//   npm --prefix functions run build && node --test functions/test/coach.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { runCoachTurn, coachTurnCore } from '../lib/coach.js'

const baseDeps = (over = {}) => {
  let replyCalls = 0
  const deps = {
    readDob: async () => '2000-01-01', // adult
    classify: async () => '{"categories":["none"]}', // benign classification
    generateReply: async () => {
      replyCalls++
      return JSON.stringify({
        mode: 'general',
        message: 'Focus on hitting depth with a braced core.',
        citations: [],
        memory: null,
        proposal: { kind: 'none' },
      })
    },
    enforceLimit: async () => {},
    killSwitchEngaged: () => false,
    todayKey: '2026-07-31',
    ...over,
  }
  return { deps, replyCalls: () => replyCalls }
}

test('runCoachTurn proceeds past the enable-gate now that COACH_ENABLED is true (audit C-009)', async () => {
  const { deps, replyCalls } = baseDeps()
  const out = await runCoachTurn('u1', { message: 'how do I squat?' }, deps)
  assert.equal(out.blocked, false)
  assert.equal(replyCalls(), 1) // the gate is open, so an allowed turn reaches the model exactly once
})

test('runCoachTurn returns coach_unavailable when the remote kill switch is engaged (live off-switch)', async () => {
  const { deps, replyCalls } = baseDeps({ killSwitchEngaged: () => true })
  await assert.rejects(() => runCoachTurn('u1', { message: 'how do I squat?' }, deps), /coach_unavailable/)
  assert.equal(replyCalls(), 0) // the model is never consulted while the kill switch is engaged
})

test('a crisis message is blocked by the safety floor and NEVER reaches the model', async () => {
  const { deps, replyCalls } = baseDeps()
  const out = await coachTurnCore('u1', { message: 'i want to kill myself tonight' }, deps)
  assert.equal(out.blocked, true)
  assert.ok(out.text.length > 0)
  assert.ok(Array.isArray(out.buttons)) // crisis responses carry tap-to-call buttons
  assert.equal(replyCalls(), 0) // the model was not called on a block
})

test('an allowed turn calls the model once and returns the validated reply', async () => {
  const { deps, replyCalls } = baseDeps()
  const out = await coachTurnCore('u1', { message: 'how do I improve my squat depth?' }, deps)
  assert.equal(out.blocked, false)
  assert.equal(replyCalls(), 1)
  assert.match(out.text, /depth/i)
  assert.equal(out.mode, 'general')
})

test('malformed model output fails closed to the structured fallback', async () => {
  const { deps } = baseDeps({ generateReply: async () => 'not valid json' })
  const out = await coachTurnCore('u1', { message: 'explain progressive overload' }, deps)
  assert.equal(out.blocked, false)
  assert.match(out.text, /couldn.t put together a reliable answer/i)
  assert.deepEqual(out.citations, [])
})

test('unapproved citations are stripped from an otherwise valid answer', async () => {
  const { deps } = baseDeps({ generateReply: async () => JSON.stringify({
    mode: 'general', message: 'Progress gradually.', memory: null, proposal: { kind: 'none' },
    citations: [{ sourceKey: 'random_blog', title: 'Random Blog' }],
  }) })
  const out = await coachTurnCore('u1', { message: 'explain progressive overload' }, deps)
  assert.deepEqual(out.citations, [])
})

test('the server hard daily cap returns the limit response without calling the model', async () => {
  const { deps, replyCalls } = baseDeps({
    enforceLimit: async () => {
      throw new Error('resource-exhausted')
    },
  })
  const out = await coachTurnCore('u1', { message: 'quick form check please' }, deps)
  assert.equal(out.blocked, true)
  assert.ok(out.text.length > 0)
  assert.equal(replyCalls(), 0)
})

test('an empty message is rejected before any model/classifier call', async () => {
  const { deps, replyCalls } = baseDeps()
  await assert.rejects(() => coachTurnCore('u1', { message: '   ' }, deps), /Empty message/)
  assert.equal(replyCalls(), 0)
})

test('a classifier failure fails SAFE (blocks, model not called) rather than allowing', async () => {
  const { deps, replyCalls } = baseDeps({
    classify: async () => {
      throw new Error('model down')
    },
  })
  const out = await coachTurnCore('u1', { message: 'anything at all' }, deps)
  assert.equal(out.blocked, true) // service-unavailable, never a silent allow
  assert.equal(replyCalls(), 0)
})

/* ---------------- C-006: the SERVER is authoritative on action capability ---------------- */

const actionReplyDeps = (over = {}) => baseDeps({
  // The model emits a valid workout_action proposal every turn.
  generateReply: async () => JSON.stringify({
    mode: 'general', message: 'Let’s deload this week.', citations: [], memory: null,
    proposal: { kind: 'workout_action', title: 'Deload week', summary: 'Cut sets ~40%.', payload: { action: 'deload' } },
  }),
  saveProposal: async (_uid, p) => ({ ...p, id: 'prop1', status: 'pending', createdAt: '', expiresAt: '' }),
  ...over,
}).deps

test('C-006: a workout_action is SURFACED when the client opts in and the server permits actions', async () => {
  const deps = actionReplyDeps({ actionsDisabled: () => false })
  const out = await coachTurnCore('u1', { message: 'can you set up a deload week for me?', allowActions: true }, deps)
  assert.ok(out.proposal && out.proposal.kind === 'workout_action', 'action should be surfaced when permitted')
})

test('C-006: the server DOWNGRADES a workout_action when actioning is disabled server-side, even if the client sent allowActions=true', async () => {
  const deps = actionReplyDeps({ actionsDisabled: () => true })
  const out = await coachTurnCore('u1', { message: 'can you set up a deload week for me?', allowActions: true }, deps)
  assert.equal(out.proposal, null) // a modified/stale client cannot force an action through
})

test('U-003: a cold-start action switch that resolves DISABLED after being read blocks the action (fail-closed freshness)', async () => {
  // Simulate the real makeRemoteKillSwitch cold start: engaged() would return a stale false, but the
  // awaited engagedFresh(true) resolves the true value before the action gate decides.
  let resolvedDisabled = false
  const deps = actionReplyDeps({
    actionsDisabledFresh: async () => { resolvedDisabled = true; return true }, // fresh read says disabled
  })
  const out = await coachTurnCore('u1', { message: 'can you set up a deload week for me?', allowActions: true }, deps)
  assert.equal(resolvedDisabled, true)
  assert.equal(out.proposal, null) // no stale-false fail-open on cold start
})

// R5-010 — the coach names the correct LOCAL day on the FIRST turn after a timezone change by
// trusting the validated per-turn timezone the client sends, instead of the lagging stored setting.
test('R5-010: the per-turn timezone is threaded to loadTurnData', async () => {
  const { deps } = baseDeps()
  let captured = 'UNSET'
  deps.loadTurnData = async (_uid, opts) => {
    captured = opts?.requestTimezone
    throw new Error('stop-after-capture') // short-circuit; we only assert the plumbing here
  }
  await assert.rejects(
    () => coachTurnCore('u1', { message: 'what should I train today?', timezone: 'Australia/Perth' }, deps),
    /stop-after-capture/,
  )
  assert.equal(captured, 'Australia/Perth')
})

test('R5-010: isValidTimezone accepts real IANA zones and rejects junk', async () => {
  const { isValidTimezone } = await import('../lib/coachWorkspace.js')
  assert.equal(isValidTimezone('Australia/Perth'), true)
  assert.equal(isValidTimezone('America/New_York'), true)
  assert.equal(isValidTimezone('UTC'), true)
  assert.equal(isValidTimezone('Not/AZone'), false)
  assert.equal(isValidTimezone(''), false)
  assert.equal(isValidTimezone(undefined), false)
  assert.equal(isValidTimezone(123), false)
})
