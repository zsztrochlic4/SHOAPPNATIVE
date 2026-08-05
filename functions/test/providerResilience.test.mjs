// Provider-call resilience for the coach's Gemini calls (audit R5-015): deadline + bounded jittered
// retry + per-instance circuit breaker + typed overload. Uses injected now/sleep/random so the
// timing is deterministic and no wall-clock delay is incurred.
//   npm --prefix functions run build && node --test functions/test/providerResilience.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  callWithResilience,
  isTransientProviderError,
  overloadError,
  OVERLOAD_RETRY_AFTER_SEC,
  __resetBreakers,
} from '../lib/lib/providerResilience.js'

const fastOpts = (over = {}) => ({
  label: `t_${Math.random().toString(36).slice(2)}`,
  deadlineMs: 1000,
  maxAttempts: 2,
  baseBackoffMs: 100,
  sleep: async () => {}, // no real delay
  random: () => 0.5,
  ...over,
})

test('resolves on the first successful attempt', async () => {
  __resetBreakers()
  let calls = 0
  const out = await callWithResilience(async () => { calls++; return 'ok' }, fastOpts())
  assert.equal(out, 'ok')
  assert.equal(calls, 1)
})

test('retries a transient failure then succeeds', async () => {
  __resetBreakers()
  let calls = 0
  const out = await callWithResilience(async () => {
    calls++
    if (calls === 1) throw Object.assign(new Error('503 service unavailable'))
    return 'recovered'
  }, fastOpts())
  assert.equal(out, 'recovered')
  assert.equal(calls, 2)
})

test('exhausts retries on persistent transient failure and throws a typed overload', async () => {
  __resetBreakers()
  let calls = 0
  await assert.rejects(
    () => callWithResilience(async () => { calls++; throw new Error('429 rate limited') }, fastOpts()),
    (e) => e?.code === 'resource-exhausted' && e?.details?.retryAfterSec === OVERLOAD_RETRY_AFTER_SEC,
  )
  assert.equal(calls, 2) // maxAttempts
})

test('a deterministic (non-transient) error is NOT retried and propagates as-is', async () => {
  __resetBreakers()
  let calls = 0
  await assert.rejects(
    () => callWithResilience(async () => { calls++; throw new Error('invalid argument: bad schema') }, fastOpts()),
    /invalid argument/,
  )
  assert.equal(calls, 1) // no retry for a deterministic failure
})

test('an aborted (deadline) attempt is treated as transient', () => {
  assert.equal(isTransientProviderError(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })), true)
  assert.equal(isTransientProviderError({ status: 503 }), true)
  assert.equal(isTransientProviderError({ status: 400 }), false)
  assert.equal(isTransientProviderError(new Error('bad request')), false)
})

test('the circuit breaker opens after repeated failures and short-circuits further calls', async () => {
  __resetBreakers()
  const label = 'breaker_case'
  let clock = 0
  const opts = () => ({
    label, deadlineMs: 1000, maxAttempts: 1, baseBackoffMs: 1,
    sleep: async () => {}, random: () => 0.5, now: () => clock,
  })
  // 5 consecutive transient exhaustions trip the breaker (threshold = 5).
  for (let i = 0; i < 5; i++) {
    let called = false
    await assert.rejects(
      () => callWithResilience(async () => { called = true; throw new Error('503') }, opts()),
      (e) => e?.code === 'resource-exhausted',
    )
    assert.equal(called, true, 'the provider is still called while the breaker is closed')
  }
  // 6th call: breaker OPEN → short-circuits without ever invoking the provider.
  let invoked = false
  await assert.rejects(
    () => callWithResilience(async () => { invoked = true; return 'x' }, opts()),
    (e) => e?.code === 'resource-exhausted',
  )
  assert.equal(invoked, false, 'an open breaker must not call the provider')

  // After the cooldown passes, calls are allowed through again.
  clock += 20_000
  let allowed = false
  const out = await callWithResilience(async () => { allowed = true; return 'ok' }, opts())
  assert.equal(allowed, true)
  assert.equal(out, 'ok')
})

test('overloadError carries the label and a retry-after hint', () => {
  const e = overloadError('coach_reply')
  assert.equal(e.code, 'resource-exhausted')
  assert.equal(e.details.label, 'coach_reply')
  assert.ok(e.details.retryAfterSec > 0)
})
