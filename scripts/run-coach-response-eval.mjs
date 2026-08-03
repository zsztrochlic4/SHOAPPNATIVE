/**
 * Coach response-quality evaluation runner (audit C-017, report §6). TWO modes:
 *
 *   sheet  (default) — emit a blank per-case reviewer SCORING SHEET (CSV) + a run MANIFEST (JSON).
 *                      Optionally merge a REPLIES file so reviewers score real model output.
 *   score            — read two filled reviewer sheets (JSON) and print PASS/FAIL vs the release gate.
 *
 * The paid model run and the human scoring are DELIBERATELY not here — they need an isolated key, a
 * cost envelope and independent reviewers (owner-owned). This makes everything AROUND them turnkey:
 * the corpus, the scoring instrument, the manifest, and the deterministic gate.
 *
 * Build the TS corpus/scorer once, then run:
 *   npm run eval:response                                            # emit blank sheet
 *   REPLIES=replies.json npm run eval:response                       # sheet incl. model replies
 *   MODE=score SHEETS=jack.json,sam.json npm run eval:response       # score two filled sheets
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  RESPONSE_EVAL_CASES, EVAL_DIMENSIONS, GROUP_MINIMUMS, AUTO_FAILURE_RULES,
  MEAN_THRESHOLD, CRITICAL_MIN, IRR_MIN, MAX_AUTO_FAILS,
} from '../.sweep-out/backend/coach/eval/responseQualityCorpus.js'
import { evaluateResponseQuality } from '../.sweep-out/backend/coach/eval/scoreResponseQuality.js'

const OUT = process.env.OUT || 'eval-out'
const MODE = (process.env.MODE || 'sheet').toLowerCase()

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ').trim()}"`

function emitSheet() {
  mkdirSync(OUT, { recursive: true })

  let replies = {}
  if (process.env.REPLIES) {
    try { replies = JSON.parse(readFileSync(process.env.REPLIES, 'utf8')) } catch { replies = {} }
  }
  const hasReplies = Object.keys(replies).length > 0

  const dimCols = EVAL_DIMENSIONS.map((d) => `${d.label} (1-5)${d.critical ? ' *critical' : ''}`)
  const header = [
    'case_id', 'group', 'scenario', 'prompt', 'expected', 'auto_fail_watch',
    ...(hasReplies ? ['model_reply'] : []),
    ...dimCols, 'auto_fail (Y/N)', 'notes',
  ].map(csvCell).join(',')

  const rows = RESPONSE_EVAL_CASES.map((c) => [
    c.id, c.group, c.scenario ?? '', c.prompt, c.expected, c.autoFailWatch,
    ...(hasReplies ? [replies[c.id] ?? ''] : []),
    ...EVAL_DIMENSIONS.map(() => ''), '', '',
  ].map(csvCell).join(','))

  const sheetPath = join(OUT, 'response-eval-sheet.csv')
  writeFileSync(sheetPath, [header, ...rows].join('\n') + '\n', 'utf8')

  const template = {
    reviewer: 'REVIEWER_NAME',
    cases: RESPONSE_EVAL_CASES.map((c) => ({
      caseId: c.id,
      scores: Object.fromEntries(EVAL_DIMENSIONS.map((d) => [d.key, 0])),
      autoFail: false,
    })),
  }
  writeFileSync(join(OUT, 'reviewer-template.json'), JSON.stringify(template, null, 2), 'utf8')

  const manifest = {
    purpose: 'Coach response-quality evaluation (audit C-017 / report §6)',
    generatedFrom: 'src/backend/coach/eval/responseQualityCorpus.ts',
    caseCount: RESPONSE_EVAL_CASES.length,
    groupCounts: RESPONSE_EVAL_CASES.reduce((m, c) => { m[c.group] = (m[c.group] ?? 0) + 1; return m }, {}),
    groupMinimums: GROUP_MINIMUMS,
    dimensions: EVAL_DIMENSIONS,
    thresholds: { MEAN_THRESHOLD, CRITICAL_MIN, IRR_MIN, MAX_AUTO_FAILS },
    autoFailureRules: AUTO_FAILURE_RULES,
    includesModelReplies: hasReplies,
    releaseSha: process.env.RELEASE_SHA || 'FILL_ME',
    model: process.env.MODEL || 'FILL_ME',
    promptHash: process.env.PROMPT_HASH || 'FILL_ME',
  }
  writeFileSync(join(OUT, 'response-eval-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  console.log(`Wrote scoring sheet (${RESPONSE_EVAL_CASES.length} cases${hasReplies ? ', with model replies' : ''}) → ${sheetPath}`)
  console.log(`Wrote reviewer template → ${join(OUT, 'reviewer-template.json')}`)
  console.log(`Wrote manifest → ${join(OUT, 'response-eval-manifest.json')}`)
  if (!hasReplies) console.log('Tip: set REPLIES=<file.json> (caseId→reply) to include model output for scoring.')
}

function scoreFilled() {
  const files = (process.env.SHEETS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (files.length < 2) {
    console.error('MODE=score needs SHEETS=fileA.json,fileB.json (two independent reviewers).')
    process.exit(2)
  }
  const sheets = files.map((f) => JSON.parse(readFileSync(f, 'utf8')))
  const result = evaluateResponseQuality(sheets)
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.pass ? 0 : 1)
}

if (MODE === 'score') scoreFilled()
else emitSheet()
