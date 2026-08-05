/**
 * Parse a FILLED reviewer packet (StrengthHub_Coach_Review_Packet.docx) into the reviewer-JSON the
 * response-quality gate consumes (audit R5-003 / Step 4). Lets reviewers score in the human-friendly
 * Word doc; this converts their numbers into jack.json / sam.json for `MODE=score npm run eval:response`.
 *
 *   node scripts/parse-review-packet.mjs <filled-packet.docx> <ReviewerName> [out.json]
 *   e.g. node scripts/parse-review-packet.mjs eval-out/44.docx "Reviewer 1" eval-out/jack.json
 *
 * A case is INCLUDED only if all 15 dimensions carry an integer 1–5 (cases left "—" / "skipped" are
 * omitted, so an incomplete pass correctly fails the gate's completeness check rather than passing on
 * partial evidence).
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const [docxPath, reviewerName, outPath = 'reviewer.json'] = process.argv.slice(2)
if (!docxPath || !reviewerName) {
  console.error('Usage: node scripts/parse-review-packet.mjs <filled-packet.docx> <ReviewerName> [out.json]')
  process.exit(2)
}

// Label (as printed in the packet) → reviewer-JSON dimension key. Order matches the packet table.
const LABEL_TO_KEY = new Map([
  ['accuracy', 'accuracy'], ['relevance', 'relevance'], ['personalisation', 'personalisation'],
  ['helpfulness', 'helpfulness'], ['actionability', 'actionability'], ['clarity', 'clarity'],
  ['tone', 'tone'], ['context use', 'context_use'], ['follow-up quality', 'follow_up'],
  ['uncertainty honesty', 'uncertainty'], ['safety', 'safety'], ['cross-turn consistency', 'consistency'],
  ['units & preferences', 'units'], ['action integrity', 'action_integrity'], ['failure recovery', 'failure_recovery'],
])
const DIM_KEYS = [...LABEL_TO_KEY.values()]

const CELL = '@@CELL@@' // marker inserted between table cells
const PARA = '@@PARA@@' // marker inserted between paragraphs / rows

/** Extract the document text with a marker between table cells and newlines between paragraphs/rows. */
function extractText(docx) {
  const dir = mkdtempSync(join(tmpdir(), 'packet-'))
  execFileSync('unzip', ['-o', '-q', resolve(docx), '-d', dir])
  let x = readFileSync(join(dir, 'word', 'document.xml'), 'utf8')
  // Insert markers for cell / paragraph / row boundaries BEFORE stripping tags.
  x = x.replace(/<\/w:tc>/g, CELL).replace(/<\/w:p>/g, PARA).replace(/<\/w:tr>/g, PARA).replace(/<[^>]+>/g, '')
  x = x.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  return x.split(CELL).join(' | ').split(PARA).join('\n')
}

const text = extractText(docxPath)

// Split into per-case blocks on "Case <ID>" headers (IDs like MT01, SR15, AD09, SF10, TF03, LC05).
const parts = text.split(/\bCase\s+([A-Z]{2}\d{2})\b/)
const cases = []
const skipped = []
for (let i = 1; i < parts.length; i += 2) {
  const id = parts[i]
  const block = (parts[i + 1] || '').split(/\bCase\s+[A-Z]{2}\d{2}\b/)[0]
  const lower = block.toLowerCase()
  const scores = {}
  let complete = true
  for (const [labelText, key] of LABEL_TO_KEY) {
    // Match "<label> [*] | <n>" — the score cell right after the (possibly critical-starred) label.
    const re = new RegExp(labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\*?\\s*\\|\\s*([1-5]|—|-|skip)', 'i')
    const m = lower.match(re)
    const val = m && /^[1-5]$/.test(m[1]) ? Number(m[1]) : null
    if (val == null) { complete = false; break }
    scores[key] = val
  }
  if (!complete) { skipped.push(id); continue }
  const afm = lower.match(/automatic failure[^|]*\|\s*(yes|no|y|n)\b/i)
  const autoFail = !!(afm && /^y/i.test(afm[1]))
  cases.push({ caseId: id, scores, autoFail })
}

const sheet = { reviewer: reviewerName, cases }
writeFileSync(outPath, JSON.stringify(sheet, null, 2))
console.log(`Parsed ${cases.length} fully-scored case(s) for "${reviewerName}" -> ${outPath}`)
if (cases.length) console.log(`  ${DIM_KEYS.length} dimensions per case; auto-fails flagged: ${cases.filter((c) => c.autoFail).length}`)
if (skipped.length) console.log(`  SKIPPED ${skipped.length} incomplete/blank case(s): ${skipped.join(', ')}`)
