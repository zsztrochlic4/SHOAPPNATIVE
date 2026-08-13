// Server-side coach orchestration. Production is default-OFF; internal builds opt in explicitly.
// The guarded behaviour — a crisis never reaches
// the model, an allowed turn does + is validated, the daily cap is honoured, and the SERVER is
// authoritative on action capability (audit C-006) — is verified via coachTurnCore with injected
// fakes. The first test locks in the production fail-closed release state.
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

test('runCoachTurn fails closed when the internal release channel is not explicitly enabled', async () => {
  const { deps, replyCalls } = baseDeps()
  await assert.rejects(() => runCoachTurn('u1', { message: 'how do I squat?' }, deps), /coach_disabled/)
  assert.equal(replyCalls(), 0)
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
  // NB: a "how do I …" phrasing naming a lift now trips the deterministic exercise-detail backstop
  // (synthesizeExerciseDetailNav), which replaces the model text with a technique-guide nav reply.
  // This test verifies the plain passthrough of a validated model reply, so it asks a question that
  // isn't an exercise how-to; the backstop's own behaviour is covered in coach-exercise-nav.test.
  const out = await coachTurnCore('u1', { message: 'why does squat depth matter for progress?' }, deps)
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

for (const [message, action] of [
  ['Start a quick workout for me now, I only have 15 minutes.', 'start_session'],
  ['Change my training days to Tuesday, Thursday and Saturday.', 'set_training_days'],
  ['Make my workouts fit into 30 minutes.', 'set_session_length'],
  ['Open Budget Eats for me.', 'open_budget_eats'],
  ['Change my goal to build muscle.', 'change_goal'],
  ['Put me in exam mode for the next two weeks.', 'exam_mode'],
  ['I missed today. Mark it as an exempt no-penalty rest day.', 'catch_up'],
  ['Reschedule my training to Monday, Wednesday and Friday.', 'reschedule_days'],
  ['I will be away from 20 August 2026 to 27 August 2026. Pause training completely for those dates.', 'planned_absence'],
]) {
  test(`deterministic action backstop surfaces ${action} when model emits prose only`, async () => {
    const deps = baseDeps({
      generateReply: async () => JSON.stringify({ mode: 'personalised', message: 'Want me to do that?', citations: [], memory: null, proposal: { kind: 'none' } }),
      saveProposal: async (_uid, p) => ({ ...p, id: 'prop1', status: 'pending', createdAt: '', expiresAt: '' }),
    }).deps
    const out = await coachTurnCore('u1', { message, allowActions: true }, deps)
    assert.equal(out.proposal?.kind, 'workout_action')
    assert.equal(out.proposal?.payload?.action, action)
    assert.match(out.text, /confirm/i)
  })
}

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
