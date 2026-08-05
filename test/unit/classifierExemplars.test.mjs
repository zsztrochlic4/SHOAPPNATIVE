// Safety-classifier few-shot exemplars (audit R5-002). The shipped prompt embeds CLASSIFIER_EXEMPLARS
// (src/backend/coach/safety/classifierExemplars.ts) while the measurement harness reads
// data/fewshot-exemplars.json — this test binds the two so they can never silently diverge (which
// would make the holdout measurement stop reflecting production).
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CLASSIFIER_EXEMPLARS } from '../../.sweep-out/backend/coach/safety/classifierExemplars.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const json = JSON.parse(readFileSync(resolve(ROOT, 'data', 'fewshot-exemplars.json'), 'utf8')).exemplars

test('the shipped exemplars are byte-identical to the harness JSON (text + categories, in order)', () => {
  assert.ok(CLASSIFIER_EXEMPLARS.length > 0, 'exemplars must not be empty')
  assert.equal(CLASSIFIER_EXEMPLARS.length, json.length, 'exemplar count drifted between the const and the JSON')
  for (let i = 0; i < json.length; i++) {
    assert.equal(CLASSIFIER_EXEMPLARS[i].text, json[i].text, `exemplar ${i} text drifted`)
    assert.deepEqual(CLASSIFIER_EXEMPLARS[i].categories, json[i].categories, `exemplar ${i} categories drifted`)
  }
})

test('exemplars use only valid classifier categories (none + the model set)', () => {
  const allowed = new Set([
    'none', 'immediate_danger', 'medical_emergency', 'harm_to_others', 'overdose_poisoning',
    'crisis_concern', 'third_party_crisis', 'medical_urgent', 'injury_override', 'pregnancy',
    'medical_condition', 'under_18', 'disordered_eating', 'rapid_weight_loss', 'meal_plan',
    'steroids_ped', 'supplement_dosing', 'prescribed_medication', 'unsafe_training',
    'ai_relationship', 'off_topic',
  ])
  for (const e of CLASSIFIER_EXEMPLARS) {
    for (const c of e.categories) assert.ok(allowed.has(c), `exemplar has unknown category "${c}"`)
  }
})

test('the set calibrates BOTH directions — benign look-alikes AND genuine risk (recall-neutral by design)', () => {
  const benign = CLASSIFIER_EXEMPLARS.filter((e) => e.categories.length === 1 && e.categories[0] === 'none')
  const risky = CLASSIFIER_EXEMPLARS.filter((e) => !(e.categories.length === 1 && e.categories[0] === 'none'))
  assert.ok(benign.length >= 5, 'need benign look-alike exemplars to lower false positives')
  assert.ok(risky.length >= 5, 'need genuine-risk exemplars so recall is never taught away')
})
