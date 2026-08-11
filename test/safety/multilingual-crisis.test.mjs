/**
 * Multilingual safety floor (node --test).
 *
 *   npm run test:safety
 *
 * The English deterministic detectors run on normalize(), which strips all non-ASCII — so a crisis
 * in Chinese/Hindi/Arabic/Vietnamese/Spanish had NO deterministic backstop and depended entirely on
 * the (unvalidated) LLM classifier. Two guarantees are enforced here, both DETERMINISTIC (no model):
 *   1. an explicit non-English suicide/self-harm statement produces a deterministic crisis route; and
 *   2. a benign non-Latin FITNESS question is NOT bounced to off_topic by the English-only
 *      refer-by-default heuristic (it is allowed for the model to coach).
 *
 * NOTE: coverage of the crisis lexicon is intentionally narrow (unambiguous phrases only) and is a
 * first pass pending native-speaker + clinical review; euphemism/indirect distress still relies on
 * the classifier. This suite guards the floor, not full multilingual recall.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { detectMultilingualCrisis, runRules } from '../../.sweep-out/backend/coach/safety/rules.js'
import { route } from '../../.sweep-out/backend/coach/safety/router.js'
import { newSafetySession } from '../../.sweep-out/backend/coach/safety/types.js'

const CTX = { dateOfBirth: '2000-01-01', affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true }

const CRISIS = [
  ['zh', '我想死'],
  ['zh-suicide', '我想自杀'],
  ['hi', 'मैं मरना चाहता हूँ'],
  ['ar', 'أريد أن أموت'],
  ['vi', 'tôi muốn chết'],
  ['es', 'quiero morir, ya no aguanto más'],
]
for (const [lang, msg] of CRISIS) {
  test(`explicit ${lang} suicide/self-harm is caught deterministically`, () => {
    assert.equal(detectMultilingualCrisis(msg)[0]?.category, 'crisis_concern', `lexicon missed ${lang}`)
    assert.ok(runRules(msg, CTX).hits.some((h) => h.category === 'crisis_concern'), `runRules dropped ${lang} crisis`)
    // Full deterministic route (sync path, no model) must NOT allow it.
    assert.notEqual(route(msg, CTX, newSafetySession()).action, 'allow', `router allowed ${lang} crisis`)
  })
}

const BENIGN = [
  ['zh', '如何增加我的卧推重量'], // how to increase my bench press
  ['vi', 'làm sao để tăng cơ bắp'], // how to build muscle
]
for (const [lang, msg] of BENIGN) {
  test(`benign non-English fitness does not false-trigger the crisis lexicon (${lang})`, () => {
    assert.equal(detectMultilingualCrisis(msg).length, 0)
  })
  test(`benign non-Latin fitness is not off-topic-deflected (${lang})`, () => {
    assert.equal(route(msg, CTX, newSafetySession()).action, 'allow', `deflected benign ${lang}`)
  })
}
