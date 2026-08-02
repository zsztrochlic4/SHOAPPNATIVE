// Release test for the professional sign-off gate (audit F-007): the platform
// gate must be exactly as complete as the recorded evidence — `signed: true`
// with an anonymous reviewer must NEVER open generation for real users.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROFESSIONAL_SIGNOFF,
  REQUIRED_REVIEW_SHEETS,
  platformCleared,
} from '../../.sweep-out/backend/coach/signOff.js'

const recordComplete =
  PROFESSIONAL_SIGNOFF.signed === true &&
  !!PROFESSIONAL_SIGNOFF.reviewer?.trim() &&
  !!PROFESSIONAL_SIGNOFF.accreditation?.trim() &&
  REQUIRED_REVIEW_SHEETS.every((s) => PROFESSIONAL_SIGNOFF.sheetsReviewed.includes(s))

test('the gate opens exactly when the sign-off record is complete (never on a bare flag)', () => {
  assert.equal(platformCleared().ok, recordComplete)
})

test('an anonymous sign-off keeps the gate CLOSED with a named reason', () => {
  // The shipped record currently has signed:true but no accountable reviewer —
  // the gate must be closed and say why. When the accredited reviewer's name
  // and accreditation number are recorded, this branch simply stops applying.
  if (!recordComplete) {
    const { ok, reason } = platformCleared()
    assert.equal(ok, false)
    assert.match(String(reason), /signoff|awaiting_professional_signoff/)
  }
})

test('a complete record names a real accountable reviewer', () => {
  if (recordComplete) {
    assert.ok(PROFESSIONAL_SIGNOFF.reviewer.trim().length >= 3)
    assert.ok(PROFESSIONAL_SIGNOFF.accreditation.trim().length >= 3)
    assert.ok(PROFESSIONAL_SIGNOFF.date)
  }
})
