// App Check posture guards (Blocker #4 / Option B). Pins the safety default
// (enforcement OFF until the owner flips one flag) and the soft audit behaviour.
//   npm --prefix functions run build && node --test functions/test/guards.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_CHECK_ENFORCED, auditAppCheck, requireAuth, requireVerifiedUser } from '../lib/lib/guards.js'

test('App Check enforcement is OFF by default (never on without an explicit owner flip)', () => {
  // Turning this on before the client attests would reject the live app's own
  // calls (e.g. the meal scan). It must stay false in the repo.
  assert.equal(APP_CHECK_ENFORCED, false)
})

test('auditAppCheck reports a present token and never throws', () => {
  assert.equal(auditAppCheck({ app: { appId: 'x' } }, 'analyzeMeal'), true)
})

test('auditAppCheck reports a missing token softly (returns false, does not reject)', () => {
  // No req.app → observability warning, but the call is allowed to proceed while
  // enforcement is off. Must not throw.
  assert.equal(auditAppCheck({}, 'analyzeMeal'), false)
})

// ── requireVerifiedUser monitor-mode behaviour (audit F-006) ────────────────
// The native app cannot attest yet (no App Attest / Play Integrity client), so
// while APP_CHECK_ENFORCED is false a signed-in call with NO App Check token
// must pass — otherwise every coach/profile callable rejects on iOS/Android
// while the function option claims monitor mode.

const authedNoToken = { auth: { uid: 'u1', token: {} }, app: undefined, data: {} }

test('monitor mode: a signed-in native call with NO App Check token passes', () => {
  assert.equal(requireVerifiedUser(authedNoToken, 'coachMessage'), 'u1')
})

test('a tokened signed-in call passes and returns the uid', () => {
  assert.equal(requireVerifiedUser({ ...authedNoToken, app: { appId: 'x' } }, 'coachMessage'), 'u1')
})

test('an unauthenticated call is always rejected, token or not', () => {
  assert.throws(() => requireVerifiedUser({ auth: undefined, app: { appId: 'x' }, data: {} }, 'coachMessage'), /signed in/i)
  assert.throws(() => requireAuth({ auth: undefined }), /signed in/i)
})
