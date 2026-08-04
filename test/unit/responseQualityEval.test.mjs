// Coach response-quality evaluation scaffold (audit C-017 / U-004 / U-005 / U-006, report §6).
// Proves the 60-case corpus is complete + grouped, the rubric has all 15 dimensions, and the gate
// FAILS CLOSED on any incomplete/malformed evidence (the re-audit's fail-open defect).
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RESPONSE_EVAL_CASES, GROUP_MINIMUMS, EVAL_DIMENSIONS, REQUIRED_CASE_COUNT,
} from '../../.sweep-out/backend/coach/eval/responseQualityCorpus.js'
import { evaluateResponseQuality, interRaterAgreement, validateCompleteness } from '../../.sweep-out/backend/coach/eval/scoreResponseQuality.js'

const dims = EVAL_DIMENSIONS.map((d) => d.key)

test('corpus has exactly 60 cases across the six report §6 groups', () => {
  assert.equal(RESPONSE_EVAL_CASES.length, 60)
  assert.equal(REQUIRED_CASE_COUNT, 60)
  const counts = {}
  for (const c of RESPONSE_EVAL_CASES) counts[c.group] = (counts[c.group] ?? 0) + 1
  for (const [group, min] of Object.entries(GROUP_MINIMUMS)) assert.ok((counts[group] ?? 0) >= min)
  assert.equal(counts.multi_turn, 15); assert.equal(counts.single_response, 15)
  assert.equal(counts.safety_sensitive, 10); assert.equal(counts.adversarial, 10)
  assert.equal(counts.tool_failure, 5); assert.equal(counts.long_context, 5)
})

test('rubric has all 15 dimensions with the required critical floors (U-005)', () => {
  assert.equal(EVAL_DIMENSIONS.length, 15)
  const crit = EVAL_DIMENSIONS.filter((d) => d.critical).map((d) => d.key).sort()
  assert.deepEqual(crit, ['action_integrity', 'context_use', 'failure_recovery', 'safety', 'units'].sort())
})

test('every case focus key is a real dimension', () => {
  const keys = new Set(dims)
  for (const c of RESPONSE_EVAL_CASES) for (const f of c.focus) assert.ok(keys.has(f), `${c.id} focus "${f}" is not a dimension`)
})

/* ---------------- helpers ---------------- */
const fullSheet = (reviewer, value, { autoFail = false } = {}) => ({
  reviewer,
  cases: RESPONSE_EVAL_CASES.map((c) => ({ caseId: c.id, scores: Object.fromEntries(dims.map((k) => [k, value])), autoFail })),
})

/* ---------------- the gate PASSES only on complete evidence ---------------- */

test('two complete distinct 5/5 reviewers PASS (no manifest)', () => {
  const r = evaluateResponseQuality([fullSheet('jack', 5), fullSheet('sam', 5)])
  assert.equal(r.pass, true, r.reasons.join('; '))
  assert.equal(r.complete, true)
  assert.equal(r.overallMean, 5)
  assert.equal(r.interRaterAgreement, 1)
})

/* ---------------- FAIL-CLOSED completeness (the re-audit U-004 defect) ---------------- */

test('two one-case sheets FAIL (the exact re-audit repro)', () => {
  const oneCase = (rev) => ({ reviewer: rev, cases: [{ caseId: 'MT01', scores: Object.fromEntries(dims.map((k) => [k, 5])), autoFail: false }] })
  const r = evaluateResponseQuality([oneCase('jack'), oneCase('sam')])
  assert.equal(r.pass, false)
  assert.equal(r.complete, false)
  assert.ok(r.reasons.some((x) => /missing case/.test(x)))
})

test('a missing dimension FAILS', () => {
  const a = fullSheet('jack', 5); const b = fullSheet('sam', 5)
  delete b.cases[0].scores[dims[0]]
  const r = evaluateResponseQuality([a, b])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /must be an integer 1–5/.test(x)))
})

test('a non-integer / out-of-range score FAILS', () => {
  const a = fullSheet('jack', 5); const b = fullSheet('sam', 5)
  b.cases[3].scores[dims[2]] = 4.5
  b.cases[4].scores[dims[1]] = 9
  const r = evaluateResponseQuality([a, b])
  assert.equal(r.pass, false)
})

test('duplicate reviewer names FAIL', () => {
  const r = evaluateResponseQuality([fullSheet('jack', 5), fullSheet('jack', 5)])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /distinct/.test(x)))
})

test('one reviewer FAILS; three reviewers FAIL', () => {
  assert.equal(evaluateResponseQuality([fullSheet('jack', 5)]).pass, false)
  const three = evaluateResponseQuality([fullSheet('a', 5), fullSheet('b', 5), fullSheet('c', 5)])
  assert.equal(three.pass, false)
  assert.ok(three.reasons.some((x) => /exactly 2 reviewers/.test(x)))
})

test('fully non-overlapping sheets FAIL with IRR null', () => {
  const a = fullSheet('jack', 5)
  const b = fullSheet('sam', 5)
  for (const c of b.cases) c.caseId = `X-${c.caseId}` // no id overlaps a's corpus ids
  const r = evaluateResponseQuality([a, b])
  assert.equal(r.pass, false)
  assert.equal(r.interRaterAgreement, null)
  assert.ok(r.reasons.some((x) => /unknown case|missing case/.test(x)))
})

/* ---------------- thresholds still bite on complete evidence ---------------- */

test('a single automatic failure fails even when complete', () => {
  const a = fullSheet('jack', 5); const b = fullSheet('sam', 5)
  b.cases[0].autoFail = true
  const r = evaluateResponseQuality([a, b])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /automatic failure/.test(x)))
})

test('overall mean below 4.2 fails', () => {
  const r = evaluateResponseQuality([fullSheet('jack', 4), fullSheet('sam', 4)])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /overall mean/.test(x)))
})

test('a critical dimension below 4.0 fails even if overall mean clears', () => {
  const mk = (rev) => ({ reviewer: rev, cases: RESPONSE_EVAL_CASES.map((c) => ({ caseId: c.id, scores: Object.fromEntries(dims.map((k) => [k, k === 'safety' ? 2 : 5])), autoFail: false })) })
  const r = evaluateResponseQuality([mk('jack'), mk('sam')])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /critical dimension "safety"/.test(x)))
})

test('low inter-rater agreement fails', () => {
  const r = evaluateResponseQuality([fullSheet('jack', 5), fullSheet('sam', 1)])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /inter-rater agreement/.test(x)))
})

/* ---------------- manifest binding (U-006) ---------------- */

const BOUND_MANIFEST = {
  releaseSha: 'a'.repeat(40),
  model: 'gemini-2.5-flash-lite',
  promptHash: 'deadbeefcafe',
  corpusHash: 'deadbeefcafe',
  repliesHash: 'deadbeefcafe',
  includesModelReplies: true,
  replyCount: 60,
}

test('R4-002: a MISSING manifest fails in a release run (requireManifest)', () => {
  const sheets = [fullSheet('jack', 5), fullSheet('sam', 5)]
  const r = evaluateResponseQuality(sheets, undefined, { requireManifest: true })
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /bound evaluation manifest is required/.test(x)))
})

test('R4-002: placeholder / self-asserted provenance fails', () => {
  const sheets = [fullSheet('jack', 5), fullSheet('sam', 5)]
  const placeholder = evaluateResponseQuality(sheets, { releaseSha: 'FILL_ME', model: 'FILL_ME', promptHash: 'FILL_ME', includesModelReplies: false, replyCount: 0 })
  assert.equal(placeholder.pass, false)
  // one reply must NOT satisfy the binding
  const oneReply = evaluateResponseQuality(sheets, { ...BOUND_MANIFEST, replyCount: 1 })
  assert.equal(oneReply.pass, false)
  assert.ok(oneReply.reasons.some((x) => /replyCount must be exactly 60/.test(x)))
  // short / non-hex SHA fails
  const badSha = evaluateResponseQuality(sheets, { ...BOUND_MANIFEST, releaseSha: 'abc123' })
  assert.equal(badSha.pass, false)
})

test('R4-002: expected SHA/model mismatch fails', () => {
  const sheets = [fullSheet('jack', 5), fullSheet('sam', 5)]
  const r = evaluateResponseQuality(sheets, BOUND_MANIFEST, { expectedReleaseSha: 'b'.repeat(40) })
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /does not match the expected release/.test(x)))
})

test('a fully bound manifest with all 60 replies passes', () => {
  const sheets = [fullSheet('jack', 5), fullSheet('sam', 5)]
  const bound = evaluateResponseQuality(sheets, BOUND_MANIFEST, { requireManifest: true, expectedReleaseSha: 'a'.repeat(40), expectedModel: 'gemini-2.5-flash-lite' })
  assert.equal(bound.pass, true, bound.reasons.join('; '))
})

test('validateCompleteness returns empty for a complete pair', () => {
  assert.deepEqual(validateCompleteness([fullSheet('jack', 5), fullSheet('sam', 5)]), [])
})
