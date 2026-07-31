// App Check posture guards (Blocker #4 / Option B). Pins the safety default
// (enforcement OFF until the owner flips one flag) and the soft audit behaviour.
//   npm --prefix functions run build && node --test functions/test/guards.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_CHECK_ENFORCED, auditAppCheck } from '../lib/lib/guards.js'

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
