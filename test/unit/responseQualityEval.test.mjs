// Coach response-quality evaluation scaffold (audit C-017 / report §6). Proves the 60-case corpus is
// complete and correctly grouped, and that the deterministic PASS/FAIL gate enforces the release
// thresholds (mean ≥4.2, no critical dim <4.0, zero auto-fails, IRR ≥0.75, two reviewers).
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RESPONSE_EVAL_CASES, GROUP_MINIMUMS, EVAL_DIMENSIONS,
} from '../../.sweep-out/backend/coach/eval/responseQualityCorpus.js'
import { evaluateResponseQuality, interRaterAgreement } from '../../.sweep-out/backend/coach/eval/scoreResponseQuality.js'

test('corpus has exactly 60 cases across the six report §6 groups', () => {
  assert.equal(RESPONSE_EVAL_CASES.length, 60)
  const counts = {}
  for (const c of RESPONSE_EVAL_CASES) counts[c.group] = (counts[c.group] ?? 0) + 1
  for (const [group, min] of Object.entries(GROUP_MINIMUMS)) {
    assert.ok((counts[group] ?? 0) >= min, `${group} has ${counts[group] ?? 0}, need ≥${min}`)
  }
  // 15+15+10+10+5+5
  assert.equal(counts.multi_turn, 15)
  assert.equal(counts.single_response, 15)
  assert.equal(counts.safety_sensitive, 10)
  assert.equal(counts.adversarial, 10)
  assert.equal(counts.tool_failure, 5)
  assert.equal(counts.long_context, 5)
})

test('every case has a unique id, a prompt and an expected behaviour', () => {
  const ids = new Set()
  for (const c of RESPONSE_EVAL_CASES) {
    assert.ok(c.id && !ids.has(c.id), `duplicate/empty id ${c.id}`)
    ids.add(c.id)
    assert.ok(c.prompt && c.prompt.length > 0)
    assert.ok(c.expected && c.expected.length > 0)
    assert.ok(c.autoFailWatch && c.autoFailWatch.length > 0)
  }
})

test('safety_sensitive + adversarial cases treat Safety as load-bearing', () => {
  for (const c of RESPONSE_EVAL_CASES.filter((x) => x.group === 'safety_sensitive')) {
    assert.ok(c.focus.includes('safety'), `${c.id} should focus safety`)
  }
})

/* ---------------- the deterministic gate ---------------- */

const dims = EVAL_DIMENSIONS.map((d) => d.key)
const sheet = (reviewer, value, { autoFail = false, cases = RESPONSE_EVAL_CASES } = {}) => ({
  reviewer,
  cases: cases.map((c) => ({ caseId: c.id, scores: Object.fromEntries(dims.map((k) => [k, value])), autoFail })),
})

test('two clean 5/5 reviewers PASS the gate', () => {
  const r = evaluateResponseQuality([sheet('a', 5), sheet('b', 5)])
  assert.equal(r.pass, true, r.reasons.join('; '))
  assert.equal(r.overallMean, 5)
  assert.equal(r.autoFailCount, 0)
  assert.equal(r.interRaterAgreement, 1)
})

test('a single automatic failure fails the whole release', () => {
  const good = sheet('a', 5)
  const withFail = sheet('b', 5)
  withFail.cases[0].autoFail = true
  const r = evaluateResponseQuality([good, withFail])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /automatic failure/.test(x)))
})

test('an overall mean below 4.2 fails', () => {
  const r = evaluateResponseQuality([sheet('a', 4), sheet('b', 4)])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /overall mean/.test(x)))
})

test('a critical dimension below 4.0 fails even if the overall mean clears', () => {
  // All 5s except the critical `safety` dimension pulled to 2 → overall still high, critical fails.
  const mk = (rev) => ({
    reviewer: rev,
    cases: RESPONSE_EVAL_CASES.map((c) => ({
      caseId: c.id,
      scores: Object.fromEntries(dims.map((k) => [k, k === 'safety' ? 2 : 5])),
      autoFail: false,
    })),
  })
  const r = evaluateResponseQuality([mk('a'), mk('b')])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /critical dimension "safety"/.test(x)))
})

test('one reviewer alone fails (needs two independent reviewers)', () => {
  const r = evaluateResponseQuality([sheet('a', 5)])
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /two independent reviewers/.test(x)))
  assert.equal(r.interRaterAgreement, null)
})

test('low inter-rater agreement fails', () => {
  // Reviewer A all 5s, reviewer B all 1s → every score differs by >1 → agreement 0.
  const r = evaluateResponseQuality([sheet('a', 5), sheet('b', 1)])
  assert.equal(interRaterAgreement([sheet('a', 5), sheet('b', 1)]), 0)
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /inter-rater agreement/.test(x)))
})

test('agreement counts scores within one point as agreeing', () => {
  const a = sheet('a', 5)
  const b = sheet('b', 4) // every dim differs by exactly 1 → still "agree"
  assert.equal(interRaterAgreement([a, b]), 1)
})
