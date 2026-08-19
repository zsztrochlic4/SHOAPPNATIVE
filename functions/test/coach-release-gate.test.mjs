// Server-authoritative, default-CLOSED release gate (defence in depth).
//
// The build-channel env (COACH_RELEASE_CHANNEL) is deliberately set to `internal` HERE, BEFORE the
// dynamic import, so COACH_ENABLED evaluates true — i.e. this file reproduces the exact situation the
// gate exists to contain: a build whose env would open the coach. It then proves that the SERVER gate
// (config/coach.releaseEnabled) still keeps prod CLOSED unless it is deliberately true, so an env var
// alone can never open a real deploy.
//   npm --prefix functions run build && node --test functions/test/coach-release-gate.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.COACH_RELEASE_CHANNEL = 'internal' // MUST be set before importing coach (COACH_ENABLED is import-time)
const { runCoachTurn } = await import('../lib/coach.js')

const baseDeps = (over = {}) => {
  let replyCalls = 0
  const deps = {
    readDob: async () => '2000-01-01', // adult
    classify: async () => '{"categories":["none"]}',
    generateReply: async () => {
      replyCalls++
      return JSON.stringify({ mode: 'general', message: 'Focus on hitting depth with a braced core.', citations: [], memory: null, proposal: { kind: 'none' } })
    },
    enforceLimit: async () => {},
    killSwitchEngaged: () => false,
    todayKey: '2026-07-31',
    ...over,
  }
  return { deps, replyCalls: () => replyCalls }
}

test('the coach is CLOSED by the server gate even when the build channel is enabled', async () => {
  // COACH_ENABLED is true here (env internal), yet the server release gate reads false.
  const { deps, replyCalls } = baseDeps({ releaseEnabledFresh: async () => false })
  await assert.rejects(() => runCoachTurn('u1', { message: 'how do I squat?' }, deps), /coach_disabled/)
  assert.equal(replyCalls(), 0) // the model is never called while the gate is closed
})

test('an ABSENT release-gate dep is treated as CLOSED (fail-safe)', async () => {
  const { deps, replyCalls } = baseDeps() // no releaseEnabledFresh supplied
  await assert.rejects(() => runCoachTurn('u1', { message: 'how do I squat?' }, deps), /coach_disabled/)
  assert.equal(replyCalls(), 0)
})

test('the coach OPENS only when BOTH the build channel AND the server gate are true', async () => {
  const { deps, replyCalls } = baseDeps({ releaseEnabledFresh: async () => true })
  const out = await runCoachTurn('u1', { message: 'how do I squat?' }, deps)
  assert.equal(out.blocked, false)
  assert.ok(out.text.length > 0)
  assert.equal(replyCalls(), 1) // the model is reached only past both gates
})
