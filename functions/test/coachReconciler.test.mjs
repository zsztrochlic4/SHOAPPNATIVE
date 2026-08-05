// Coach action-journal reconciler planning (audit R5-007): decides what to alert on and what to
// force-close among pending_apply entries, deterministically and without Firestore.
//   npm --prefix functions run build && node --test functions/test/coachReconciler.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  planReconciliation,
  PENDING_ALERT_SLA_MS,
  PENDING_FORCE_TERMINAL_MS,
} from '../lib/coachReconciler.js'

const NOW = 1_000_000_000_000
const at = (agoMs) => ({ path: `coachUsers/u/actions/a${agoMs}`, createdAtMs: NOW - agoMs })

test('nothing stale → no alert, nothing to close', () => {
  const plan = planReconciliation([at(5_000), at(30_000)], NOW)
  assert.equal(plan.staleCount, 0)
  assert.equal(plan.toTerminalize.length, 0)
  assert.ok(plan.oldestAgeMs <= 30_000)
})

test('entries older than the SLO count as stale (alert) but are not force-closed until the horizon', () => {
  const plan = planReconciliation([at(PENDING_ALERT_SLA_MS + 1), at(10 * 60_000)], NOW)
  assert.equal(plan.staleCount, 2)
  assert.equal(plan.toTerminalize.length, 0, 'still within the force-close horizon')
})

test('entries beyond the force horizon are force-closed, oldest first', () => {
  const entries = [at(PENDING_FORCE_TERMINAL_MS + 60_000), at(PENDING_FORCE_TERMINAL_MS + 5 * 60_000), at(1000)]
  const plan = planReconciliation(entries, NOW)
  assert.equal(plan.toTerminalize.length, 2)
  // oldest first
  assert.equal(plan.toTerminalize[0].createdAtMs, NOW - (PENDING_FORCE_TERMINAL_MS + 5 * 60_000))
})

test('an unknown createdAt is treated as very old (surfaced + eventually closed), not hidden', () => {
  const plan = planReconciliation([{ path: 'coachUsers/u/actions/x', createdAtMs: null }], NOW)
  assert.equal(plan.staleCount, 1)
  assert.equal(plan.toTerminalize.length, 1)
})

test('the force-close batch is bounded', () => {
  const entries = Array.from({ length: 500 }, (_, i) => at(PENDING_FORCE_TERMINAL_MS + i * 1000))
  const plan = planReconciliation(entries, NOW, { batch: 200 })
  assert.equal(plan.toTerminalize.length, 200)
  assert.equal(plan.staleCount, 500)
})
