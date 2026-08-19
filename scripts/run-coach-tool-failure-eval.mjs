/**
 * TF01–TF05 tool-failure CAPTURE runner (Coach response-eval Step 4).
 *
 * Forces each of the five tool-failure cases at the real shipping seams and writes a capture the
 * reviewer scores for the `action_integrity` dimension — the five cases that were previously
 * "pending on-device capture" in docs/COACH_RESPONSE_EVAL.md.
 *
 *   npm run eval:toolfail          # captures the four write-path cases + TF04's src-side contract
 *   npm --prefix functions run build && npm run eval:toolfail   # also exercises the LIVE functions
 *                                                                # provider-resilience timeout for TF04
 *
 * Writes eval-out/tool-failure-capture.json. Exits non-zero if any invariant is breached, so it can
 * gate CI. This drives the real PURE logic; it does NOT replace an on-device capture on the exact
 * shipping binary — that remains a separate release-gate item, and the JSON says so.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runAllToolFailures } from './lib/coachToolFailureHarness.mjs'

const require = createRequire(import.meta.url)

// Try to load the LIVE functions-side provider-resilience module for TF04's timeout→overload half.
// Absent unless `npm --prefix functions run build` has run; we degrade honestly if so.
let resilience = null
try {
  resilience = require('../functions/lib/lib/providerResilience.js')
} catch {
  resilience = null
}

const cases = await runAllToolFailures(resilience)
const allPass = cases.every((c) => c.pass)

const capture = {
  _note:
    'TF01–TF05 tool-failure capture: forced failures driven through the real shipping action-layer ' +
    '(coachActionResolver, programVersion, coachActionOutboxCore, structuredResponse). Produced by ' +
    'scripts/run-coach-tool-failure-eval.mjs. Scope: real PURE logic with injected faults — NOT a ' +
    'substitute for an on-device capture on the exact shipping binary (native persistence, live ' +
    'Firestore transaction, real over-the-wire model timeout), which remains a separate gate item.',
  generatedFor: 'coach response-eval Step 4 — action_integrity dimension',
  tf04LiveResilience: resilience
    ? 'exercised the real functions callWithResilience (transient timeout → typed resource-exhausted)'
    : 'src-side no-fabrication contract only; run `npm --prefix functions run build` first to also exercise the live functions timeout→overload path',
  allPass,
  cases,
}

mkdirSync('eval-out', { recursive: true })
writeFileSync('eval-out/tool-failure-capture.json', JSON.stringify(capture, null, 2) + '\n')

// Human-readable summary.
const line = (s) => process.stdout.write(s + '\n')
line('')
line('TF01–TF05 tool-failure capture')
line('─'.repeat(72))
for (const c of cases) {
  const mark = c.pass ? 'PASS' : 'FAIL'
  line(`${mark}  ${c.id}  ${c.userMessage}`)
  line(`      forced: ${c.scenario}`)
  line(`      did:    ${summarise(c)}`)
  for (const inv of c.invariants) line(`        ${inv.pass ? '✓' : '✗'} ${inv.name}`)
}
line('─'.repeat(72))
line(`TF04 live functions resilience: ${resilience ? 'YES' : 'no (src-side contract only)'}`)
line(`${allPass ? 'ALL PASS' : 'FAILURES PRESENT'} — wrote eval-out/tool-failure-capture.json`)
line('')

function summarise(c) {
  const b = c.behaviour
  const parts = [`status=${b.finalStatus}`]
  if (b.button) parts.push(`button=${b.button}`)
  parts.push(`claimedApplied=${b.claimedApplied}`)
  if (b.versionBefore !== undefined) parts.push(`version ${b.versionBefore}→${b.versionAfter}`)
  if (Array.isArray(b.outbox)) parts.push(`outbox=[${b.outbox.map((e) => e.outcome).join(',')}]`)
  return parts.join('  ')
}

process.exit(allPass ? 0 : 1)
