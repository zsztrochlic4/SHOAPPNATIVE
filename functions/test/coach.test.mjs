// Server-side coach orchestration. The ENABLE GATE is verified via runCoachTurn
// (throws coach_disabled); the guarded behaviour — a crisis never reaches the
// model, an allowed turn does + is validated, the daily cap is honoured — is
// verified via coachTurnCore with injected fakes, so nothing flips COACH_ENABLED.
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
      return 'Focus on hitting depth with a braced core.'
    },
    enforceLimit: async () => {},
    killSwitchEngaged: () => false,
    todayKey: '2026-07-31',
    ...over,
  }
  return { deps, replyCalls: () => replyCalls }
}

test('runCoachTurn refuses with coach_disabled while the gate is off (the release gate holds)', async () => {
  const { deps } = baseDeps()
  await assert.rejects(() => runCoachTurn('u1', { message: 'how do I squat?' }, deps), /coach_disabled/)
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
