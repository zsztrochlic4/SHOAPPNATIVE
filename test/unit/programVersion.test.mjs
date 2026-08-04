// Coach optimistic-concurrency (audit R5-006). Proves every commit advances the program revision
// (so a patch swap can't reuse a version), that a stale expectation is rejected, that an undo
// guarding a specific revision conflicts when the plan moved on, and that legacy un-versioned docs
// no longer silently skip the check.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveNextProgramVersion,
  CoachActionConflictError,
} from '../../.sweep-out/backend/repo/programVersion.js'

test('every commit advances the revision by exactly one', () => {
  // First-time write on a fresh doc (nothing stored yet) → revision 1.
  assert.equal(resolveNextProgramVersion({ exists: false, storedVersion: undefined }), 1)
  // A patch swap: the program object reused version 5, but the STORED version is what advances.
  assert.equal(resolveNextProgramVersion({ exists: true, storedVersion: 5, expectedVersion: 5 }), 6)
  // Consecutive same-device applies keep climbing.
  assert.equal(resolveNextProgramVersion({ exists: true, storedVersion: 6, expectedVersion: 6 }), 7)
})

test('a stale expected version conflicts instead of overwriting', () => {
  assert.throws(
    () => resolveNextProgramVersion({ exists: true, storedVersion: 8, expectedVersion: 6 }),
    (e) => e instanceof CoachActionConflictError && e.storedVersion === 8 && e.expectedVersion === 6,
  )
})

test('an existing doc with a missing version no longer skips the check (fails closed)', () => {
  assert.throws(
    () => resolveNextProgramVersion({ exists: true, storedVersion: undefined, expectedVersion: 3 }),
    (e) => e instanceof CoachActionConflictError && e.expectedVersion === 3,
  )
})

test('undo guarding the applied revision conflicts if another device moved on', () => {
  // apply produced version 10; undo passes appliedVersion = 10.
  assert.equal(resolveNextProgramVersion({ exists: true, storedVersion: 10, expectedVersion: 10 }), 11)
  // but if another device pushed it to 12 first, the undo must abort.
  assert.throws(
    () => resolveNextProgramVersion({ exists: true, storedVersion: 12, expectedVersion: 10 }),
    (e) => e instanceof CoachActionConflictError,
  )
})

test('no expected version (first-ever coach write) still advances but never conflicts', () => {
  assert.equal(resolveNextProgramVersion({ exists: true, storedVersion: 4, expectedVersion: undefined }), 5)
  // Legacy un-versioned doc with no client expectation → migrate forward to revision 1.
  assert.equal(resolveNextProgramVersion({ exists: true, storedVersion: undefined, expectedVersion: undefined }), 1)
})
