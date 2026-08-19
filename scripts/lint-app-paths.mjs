/**
 * App-path lint (hardening step 1 — Option 1, the EXISTENCE oracle).
 *
 * Scores the coach's app-help answers against data/app-paths.json: every UI control / destination the
 * coach quotes must be a REAL surface in the catalogue. Flags quoted labels that do not exist — the
 * "fabricated destination" class ("go to 'Dashboard Preferences'" when no such control exists).
 *
 * DETERMINISTIC: pure string matching, no model. It checks EXISTENCE, not intent-correctness (a real
 * but wrong destination passes — that is Option 2's job).
 *
 * Usage:  node scripts/lint-app-paths.mjs [results.jsonl] [--all] [--out report.md]
 *   results.jsonl : eval output with {id, prompt, response:{mode,text}} rows. Defaults to the post-fix
 *                   scratchpad run. --all lints every answer; default lints only mode==='app_help'.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const outIdx = argv.indexOf('--out')
const outPath = outIdx >= 0 ? argv[outIdx + 1] : null
const all = argv.includes('--all')
const resultsPath =
  argv.find((a) => !a.startsWith('--') && a !== outPath) ||
  'C:/Users/zsztr/AppData/Local/Temp/claude/C--Users-zsztr-OneDrive-Documents-Git--claude-worktrees-coach-signoff-gate-49d5f5/d9684ae0-8f89-4785-b2e3-28d817e186e9/scratchpad/results_v2.jsonl'

// ---- catalogue ----
const cat = JSON.parse(readFileSync(resolve(ROOT, 'data', 'app-paths.json'), 'utf8'))
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[^a-z0-9 &+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const known = new Set()
for (const c of cat.knownControls) known.add(norm(c))
for (const t of cat.tabs) known.add(norm(t))
for (const d of cat.destinations) {
  known.add(norm(d.label))
  for (const s of d.serves) known.add(norm(s))
}
// Generic navigation words that are always fine to say (not specific controls).
const GENERIC = new Set(
  [
    'app',
    'the app',
    'this app',
    'menu',
    'settings',
    'tab',
    'screen',
    'back',
    'back arrow',
    'top left',
    'bottom',
    'section',
    'button',
    'home',
    'here',
    'there',
    'page',
    'sheet',
    'toggle',
    'switch',
    'x',
    'close',
    'save',
    'confirm',
    'coach',
    'chat',
  ].map(norm),
)
const isKnown = (label) => {
  const n = norm(label)
  return (
    !n ||
    n.length < 2 ||
    GENERIC.has(n) ||
    known.has(n) ||
    [...known].some((k) => k.length > 3 && (n === k || n.includes(k) || k.includes(n)))
  )
}

// A navigation instruction context — only lint answers that actually give directions.
const NAV_CUE =
  /\b(go to|tap|select|open|head to|navigate|under|in the|from the|find|menu|settings|dashboard|tab|screen|section)\b/i
// Quoted labels. The opening quote must NOT be preceded by a letter, so a contraction apostrophe
// ("you'll find 'Settings'") never starts a capture. We only treat a quoted, Capitalized token as a
// claimed UI control — contraction fragments ("ll find the") and quoted content words ("on-track") are
// lowercase and skipped by the isControlLabel filter below.
const QUOTED = /(?<![A-Za-z])["'“‘]([A-Za-z][A-Za-z0-9 &+/-]{1,38}?)["'”’]/g
// A claimed UI control the coach quotes is Capitalized (Settings, Budget Eats, Skip Rest). This drops
// contraction fragments and lowercase content words, keeping precision high for the existence check.
const isControlLabel = (l) =>
  /^[A-Z]/.test(l) && !/^(I|You|Your|The|This|That|It|We|My|A|An|And|Or|But|If|So|To)\b/.test(l)

const rows = readFileSync(resultsPath, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))
const answers = rows.filter(
  (r) => r.response && r.response.text && !r.response.blocked && (all || r.response.mode === 'app_help'),
)

const flaggedByLabel = new Map() // norm label -> {label, count, examples:[{id,prompt}]}
let answersWithFlag = 0
for (const r of answers) {
  const text = r.response.text
  if (!NAV_CUE.test(text)) continue
  const labels = [...text.matchAll(QUOTED)].map((m) => m[1].trim()).filter(isControlLabel)
  const bad = [...new Set(labels)].filter((l) => !isKnown(l))
  if (!bad.length) continue
  answersWithFlag++
  for (const l of bad) {
    const key = norm(l)
    const e = flaggedByLabel.get(key) || { label: l, count: 0, examples: [] }
    e.count++
    if (e.examples.length < 4) e.examples.push({ id: r.id, prompt: r.prompt.slice(0, 80) })
    flaggedByLabel.set(key, e)
  }
}

const flagged = [...flaggedByLabel.values()].sort((a, b) => b.count - a.count)
let md = `# Coach app-path lint (existence oracle)\n\n`
md += `Results: \`${resultsPath.split('/').pop()}\` · scope: ${all ? 'all answers' : 'app_help answers'}\n\n`
md += `- App answers checked (with a navigation instruction): **${answers.filter((r) => NAV_CUE.test(r.response.text)).length}** of ${answers.length}\n`
md += `- Answers naming a **fabricated destination** (quoted control not in the catalogue): **${answersWithFlag}**\n`
md += `- Distinct fabricated labels: **${flagged.length}**\n\n`
md += flagged.length
  ? `## Candidate fabricated destinations (verify vs data/app-paths.json)\n\n| label | count | example prompt |\n|--|--|--|\n`
  : `No fabricated destinations found. ✅\n`
for (const f of flagged) md += `| "${f.label}" | ${f.count} | ${f.examples[0]?.prompt ?? ''} |\n`

console.log(md)
if (outPath) {
  writeFileSync(outPath, md)
  console.error('wrote', outPath)
}
// Non-zero exit when fabrications exist, so this can gate CI (reviewer step-2 gate: zero fabricated destinations).
process.exit(flagged.length ? 1 : 0)
