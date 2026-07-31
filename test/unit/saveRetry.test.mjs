// Capped exponential backoff for retrying a failed cloud save.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { saveBackoffMs, MAX_SAVE_RETRIES } from '../../.sweep-out/store/saveRetry.js'

test('backoff doubles each attempt then caps', () => {
  assert.equal(saveBackoffMs(0), 4000)
  assert.equal(saveBackoffMs(1), 8000)
  assert.equal(saveBackoffMs(2), 16000)
  assert.equal(saveBackoffMs(3), 30000) // 32000 capped to 30000
  assert.equal(saveBackoffMs(9), 30000) // stays capped
})

test('negative / zero attempts return the base delay', () => {
  assert.equal(saveBackoffMs(-5), 4000)
  assert.equal(saveBackoffMs(0), 4000)
})

test('custom base and cap are honoured', () => {
  assert.equal(saveBackoffMs(1, 1000, 10000), 2000)
  assert.equal(saveBackoffMs(5, 1000, 10000), 10000)
})

test('there is a finite retry budget', () => {
  assert.ok(MAX_SAVE_RETRIES >= 1 && MAX_SAVE_RETRIES <= 10)
})
