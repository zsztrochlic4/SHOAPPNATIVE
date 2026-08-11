/**
 * Localised crisis-response guarantees (node --test).
 *
 *   npm run test:safety
 *
 * These enforce the STRUCTURE of the machine-translated crisis responses (see responsesLocalized.ts —
 * the wording itself still needs native-speaker + clinical review): every localised crisis body keeps
 * its life-line number verbatim, English falls back, AU buttons are reused, and the full guard returns
 * a localised body for a non-English crisis in an AU context.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { detectResponseLanguage, localizedResponseAU, hasLocalizedResponse } from '../../.sweep-out/backend/coach/safety/responsesLocalized.js'
import { RESPONSES } from '../../.sweep-out/backend/coach/safety/responses.js'
import { guardIncoming } from '../../.sweep-out/backend/coach/safety/index.js'
import { newSafetySession } from '../../.sweep-out/backend/coach/safety/types.js'

const CTX = { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true }
const LANGS = ['zh', 'hi', 'ar', 'vi']

test('detectResponseLanguage picks the script', () => {
  assert.equal(detectResponseLanguage('我想死'), 'zh')
  assert.equal(detectResponseLanguage('मैं मरना चाहता हूँ'), 'hi')
  assert.equal(detectResponseLanguage('أريد أن أموت'), 'ar')
  assert.equal(detectResponseLanguage('tôi muốn chết'), 'vi')
  assert.equal(detectResponseLanguage('i want to die'), 'en')
  assert.equal(detectResponseLanguage('help with my squat'), 'en')
})

// Every localised crisis body must keep the actionable number verbatim.
const NUMBER = {
  immediate_danger: '000',
  crisis_concern: '13 11 14',
  medical_emergency: '000',
  overdose_poisoning: '13 11 26',
  disordered_eating: '1800 33 4673',
}
for (const lang of LANGS) {
  for (const [key, num] of Object.entries(NUMBER)) {
    test(`localised ${key} (${lang}) keeps the number ${num}`, () => {
      const r = localizedResponseAU(key, lang)
      assert.ok(r, `no localised ${key} for ${lang}`)
      assert.ok(r.text.includes(num), `localised ${key} (${lang}) lost ${num}`)
      assert.equal(r.noAI, true)
    })
  }
  test(`localised immediate_danger (${lang}) reuses the AU tap-to-call buttons`, () => {
    const r = localizedResponseAU('immediate_danger', lang)
    assert.equal(r.buttons.length, RESPONSES.immediate_danger.buttons.length)
    assert.ok(r.buttons.every((b) => b.value), 'a reused button lost its dial value')
  })
}

test('English and unknown keys fall back (no localised body)', () => {
  assert.equal(localizedResponseAU('immediate_danger', 'en'), null)
  assert.equal(localizedResponseAU('nope', 'zh'), null)
  assert.equal(hasLocalizedResponse('immediate_danger', 'en'), false)
})

test('full guard returns a localised body for a non-English crisis (AU)', () => {
  const g = guardIncoming('我想死', CTX, newSafetySession())
  assert.equal(g.outcome, 'block')
  assert.ok(g.response.text.includes('13 11 14') || g.response.text.includes('000'), 'no AU crisis number in localised reply')
  assert.notEqual(g.response.text, RESPONSES.crisis_concern.text, 'returned the English body, not the localised one')
  assert.ok(/[一-鿿]/.test(g.response.text), 'localised crisis reply is not in Chinese')
})

test('non-AU stays on the English/local-service response (no AU localisation leak)', () => {
  const g = guardIncoming('我想死', { ...CTX, isAustralia: false }, newSafetySession())
  assert.equal(g.outcome, 'block')
  assert.ok(!/13 11 14|1800 33 4673|13 11 26/.test(g.response.text), 'AU number leaked into a non-AU reply')
})
