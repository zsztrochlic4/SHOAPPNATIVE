// Server-side coach orchestration. COACH_ENABLED is now ON (post-validation), so the remaining
// off-switch is the remote kill switch: runCoachTurn proceeds when the gate is open and throws
// coach_unavailable when the kill switch is engaged. The guarded behaviour — a crisis never reaches
// the model, an allowed turn does + is validated, the daily cap is honoured — is verified via
// coachTurnCore with injected fakes.
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

test('runCoachTurn proceeds past the enable gate (COACH_ENABLED is on)', async () => {
  const { deps } = baseDeps()
  const out = await runCoachTurn('u1', { message: 'how do I squat?' }, deps)
  assert.equal(out.blocked, false) // gate open + benign turn → coached (not coach_disabled)
})

test('runCoachTurn refuses with coach_unavailable when the remote kill switch is engaged', async () => {
  const { deps } = baseDeps({ killSwitchEngaged: () => true })
  await assert.rejects(() => runCoachTurn('u1', { message: 'how do I squat?' }, deps), /coach_unavailable/)
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
