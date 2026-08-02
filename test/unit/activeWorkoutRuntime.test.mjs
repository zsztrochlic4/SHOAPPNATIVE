// Active-workout resume decisions (audit F-010 / J-08): wall-clock accurate
// elapsed/rest restore, same-session-only, stale records ignored.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { resumableRuntime, RESUME_MAX_AGE_MS } from '../../.sweep-out/screens/activeWorkoutRuntime.js'

const NOW = 1_800_000_000_000
const base = {
  sessionId: 's1',
  startedAtMs: NOW - 600_000, // started 10 minutes ago
  started: true,
  mode: 'work',
  cursor: { exIdx: 2, setIdx: 1 },
  restEndsAtMs: null,
  restTotal: 120,
  savedAtMs: NOW - 60_000,
}

test('resumes the same session with wall-clock elapsed time', () => {
  const plan = resumableRuntime(base, 's1', NOW)
  assert.ok(plan)
  assert.equal(plan.mode, 'work')
  assert.deepEqual(plan.cursor, { exIdx: 2, setIdx: 1 })
  assert.equal(plan.totalElapsedSec, 600) // 10 minutes, not reset to zero
})

test('an in-flight rest resumes with the remaining wall-clock rest', () => {
  const rt = { ...base, mode: 'rest', restEndsAtMs: NOW + 45_000 }
  const plan = resumableRuntime(rt, 's1', NOW)
  assert.equal(plan.mode, 'rest')
  assert.equal(plan.restRemainingSec, 45)
})

test('a rest that expired while away resumes straight into work', () => {
  const rt = { ...base, mode: 'rest', restEndsAtMs: NOW - 5_000 }
  const plan = resumableRuntime(rt, 's1', NOW)
  assert.equal(plan.mode, 'work')
  assert.equal(plan.restRemainingSec, 0)
})

test('never resumes another session, an unstarted record, or nothing', () => {
  assert.equal(resumableRuntime(base, 'other-session', NOW), null)
  assert.equal(resumableRuntime({ ...base, started: false }, 's1', NOW), null)
  assert.equal(resumableRuntime(null, 's1', NOW), null)
})

test('a stale record (older than the resume window) is ignored', () => {
  const rt = { ...base, savedAtMs: NOW - RESUME_MAX_AGE_MS - 1 }
  assert.equal(resumableRuntime(rt, 's1', NOW), null)
})

test('a list-mode record resumes started but back on the list', () => {
  const plan = resumableRuntime({ ...base, mode: 'list' }, 's1', NOW)
  assert.equal(plan.mode, 'list')
  assert.equal(plan.started, true)
})
