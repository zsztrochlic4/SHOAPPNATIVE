// P1 regression (audit SA-014): the remote crash reporter must never flood the
// backend — a crash loop is debounced and a per-window ceiling applies.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldSendReport,
  REMOTE_MIN_INTERVAL_MS,
  REMOTE_MAX_PER_WINDOW,
  REMOTE_WINDOW_MS,
} from '../../.sweep-out/lib/reportThrottle.js'

test('first report always sends', () => {
  const r = shouldSendReport([], 1_000_000)
  assert.equal(r.send, true)
  assert.deepEqual(r.history, [1_000_000])
})

test('a second report within the min interval is dropped (crash-loop debounce)', () => {
  const t0 = 1_000_000
  const first = shouldSendReport([], t0)
  const second = shouldSendReport(first.history, t0 + REMOTE_MIN_INTERVAL_MS - 1)
  assert.equal(second.send, false)
})

test('a report after the min interval sends again', () => {
  const t0 = 1_000_000
  const first = shouldSendReport([], t0)
  const second = shouldSendReport(first.history, t0 + REMOTE_MIN_INTERVAL_MS + 1)
  assert.equal(second.send, true)
})

test('per-window ceiling caps sends WITHIN a single rolling window', () => {
  let history = []
  const t0 = 1_000_000
  let now = t0
  let sent = 0
  // Space sends by the min interval, but stay strictly inside one window so only
  // the per-window ceiling — not pruning — can stop them.
  while (now - t0 < REMOTE_WINDOW_MS - REMOTE_MIN_INTERVAL_MS) {
    const r = shouldSendReport(history, now)
    history = r.history
    if (r.send) sent += 1
    now += REMOTE_MIN_INTERVAL_MS + 1
  }
  assert.ok(sent <= REMOTE_MAX_PER_WINDOW, `sent ${sent} must not exceed ${REMOTE_MAX_PER_WINDOW} within a window`)
})

test('history older than the window is pruned so sending resumes later', () => {
  const old = [1_000, 2_000, 3_000]
  const r = shouldSendReport(old, 1_000 + REMOTE_WINDOW_MS + 5_000)
  assert.equal(r.send, true)
  assert.ok(r.history.every((t) => t > 1_000 + REMOTE_WINDOW_MS - 60_000))
})
