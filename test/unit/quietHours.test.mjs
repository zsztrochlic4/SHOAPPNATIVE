// Pure quiet-hours logic tests (Production Readiness plan §2.3 bug 2 / §5
// "pure domain tests: quiet hours"). Runs against the compiled module:
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { inQuietHours, nextAllowedHour } from '../../.sweep-out/lib/quietHours.js'

test('inQuietHours: non-wrapping window [9,17)', () => {
  assert.equal(inQuietHours(8, 9, 17), false)
  assert.equal(inQuietHours(9, 9, 17), true)
  assert.equal(inQuietHours(16, 9, 17), true)
  assert.equal(inQuietHours(17, 9, 17), false) // end is exclusive
})

test('inQuietHours: window wrapping midnight [22,7)', () => {
  assert.equal(inQuietHours(22, 22, 7), true)
  assert.equal(inQuietHours(23, 22, 7), true)
  assert.equal(inQuietHours(0, 22, 7), true)
  assert.equal(inQuietHours(6, 22, 7), true)
  assert.equal(inQuietHours(7, 22, 7), false) // end is exclusive
  assert.equal(inQuietHours(12, 22, 7), false)
})

test('inQuietHours: empty window (start === end) is never quiet', () => {
  assert.equal(inQuietHours(3, 5, 5), false)
})

test('nextAllowedHour: quiet disabled returns the preferred hour unchanged', () => {
  assert.equal(nextAllowedHour(23, false, 22, 7), 23)
})

test('nextAllowedHour: preferred hour outside quiet is unchanged', () => {
  assert.equal(nextAllowedHour(17, true, 22, 7), 17)
})

test('nextAllowedHour: preferred hour inside a wrapping quiet window defers to window end', () => {
  // 23:00 with quiet 22:00–07:00 → deferred to 07:00 (the next valid hour), not dropped
  assert.equal(nextAllowedHour(23, true, 22, 7), 7)
  assert.equal(nextAllowedHour(3, true, 22, 7), 7)
})

test('nextAllowedHour: preferred hour inside a same-day quiet window defers to window end', () => {
  assert.equal(nextAllowedHour(10, true, 9, 17), 17)
})

test('nextAllowedHour: result is normalised into 0-23', () => {
  assert.equal(nextAllowedHour(25, false, 0, 0), 1)
  assert.equal(nextAllowedHour(-1, false, 0, 0), 23)
})
