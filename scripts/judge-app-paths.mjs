/**
 * App-path judge (hardening step 2 — Option 2, the CORRECTNESS oracle).
 *
 * For each coach app-help answer, an LLM judge decides — against the machine-readable app map
 * (data/app-paths.json) — whether the answer sends the user to the RIGHT destination for what they
 * asked, and whether it names any control that is not real. Unlike the deterministic lint (Option 1,
 * existence only), this catches "real but wrong" directions.
 *
 * Judge model: Gemini (REST). Key from env GEMINI_API_KEY or functions/.secret.local. Judges only
 * app_help answers by default. Outputs a markdown report + a verdicts jsonl.
 *
 * Usage: node scripts/judge-app-paths.mjs [results.jsonl] [--all] [--limit N] [--out report.md]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const val = (n, d) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : d
}
const all = flag('--all')
const limit = parseInt(val('--limit', '0'), 10) || Infinity
const outPath = val('--out', null)
const resultsPath =
  argv.find((a) => !a.startsWith('--') && a !== outPath) ||
  `${process.env.SCRATCH || 'C:/Users/zsztr/AppData/Local/Temp/claude/C--Users-zsztr-OneDrive-Documents-Git--claude-worktrees-coach-signoff-gate-49d5f5/d9684ae0-8f89-4785-b2e3-28d817e186e9/scratchpad'}/results_v3.jsonl`

// ---- Gemini key ----
let KEY = process.env.GEMINI_API_KEY || ''
if (!KEY) {
  try {
    KEY = (
      readFileSync(resolve(ROOT, 'functions', '.secret.local'), 'utf8').match(/GEMINI_API_KEY=(.+)/)?.[1] || ''
    ).trim()
  } catch {}
}
if (!KEY) {
  console.error('No GEMINI_API_KEY (env or functions/.secret.local).')
  process.exit(2)
}
const MODEL = process.env.JUDGE_MODEL || 'gemini-2.5-flash-lite'
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`

// ---- app map text from the catalogue ----
const cat = JSON.parse(readFileSync(resolve(ROOT, 'data', 'app-paths.json'), 'utf8'))
const mapText = [
  `TABS: ${cat.tabs.join(', ')}.`,
  ...cat.destinations.map((d) => `- ${d.label} | route: ${d.route} | for: ${d.serves.join(', ')}`),
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    is_navigation: { type: 'boolean' },
    destination_correct: { type: 'boolean' },
    fabricated_control: { type: 'boolean' },
    expected_route: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['is_navigation', 'destination_correct', 'fabricated_control', 'expected_route', 'reason'],
}
function prompt(q, a) {
  return `You audit the StrengthHub fitness app's in-app coach. Below is the app's REAL navigation map (the only real screens/controls).\n\nAPP MAP:\n${mapText}\n\nUSER ASKED:\n"${q}"\n\nCOACH ANSWERED:\n"${a}"\n\nJudge strictly against the map:\n- is_navigation: true if the user asked how to do/find something in the app (a navigation/how-to task), false otherwise (e.g. a concept question or a safety deflection).\n- destination_correct: true if the answer sends the user to the RIGHT place per the map to accomplish what they asked. If not a navigation task, set true.\n- fabricated_control: true if the answer names ANY specific screen/button/control that is NOT in the map (an invented label), false otherwise.\n- expected_route: the correct route from the map for this intent, or "n/a".\n- reason: one short sentence.\nReturn ONLY the JSON.`
}
async function judge(q, a) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt(q, a) }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        if (r.status === 429 || r.status >= 500) {
          await new Promise((s) => setTimeout(s, 800 * (attempt + 1)))
          continue
        }
        throw new Error('http ' + r.status + ' ' + (await r.text()).slice(0, 120))
      }
      const j = await r.json()
      const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text
      return JSON.parse(txt)
    } catch (e) {
      if (attempt === 2) return { error: String(e?.message || e) }
      await new Promise((s) => setTimeout(s, 600 * (attempt + 1)))
    }
  }
}

const rows = readFileSync(resultsPath, 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))
let answers = rows.filter(
  (r) => r.response && r.response.text && !r.response.blocked && (all || r.response.mode === 'app_help'),
)
if (limit !== Infinity) answers = answers.slice(0, limit)
console.error(`judging ${answers.length} answers with ${MODEL}...`)

const verdicts = []
const CONC = 6
let idx = 0,
  done = 0
async function worker() {
  while (idx < answers.length) {
    const r = answers[idx++]
    const v = await judge(r.prompt, r.response.text)
    verdicts.push({ id: r.id, prompt: r.prompt, text: r.response.text, ...v })
    if (++done % 25 === 0) console.error(`  ${done}/${answers.length}`)
  }
}
await Promise.all(Array.from({ length: CONC }, worker))

const nav = verdicts.filter((v) => v.is_navigation && !v.error)
const wrongDest = nav.filter((v) => !v.destination_correct)
const fab = verdicts.filter((v) => v.fabricated_control && !v.error)
const errs = verdicts.filter((v) => v.error)
let md = `# Coach app-path judge (intent-correctness oracle)\n\n`
md += `Results: \`${resultsPath.split('/').pop()}\` · model: ${MODEL} · judged: ${verdicts.length} app-help answers\n\n`
md += `- Navigation/how-to answers: **${nav.length}**\n`
md += `- **Wrong destination** (real-but-wrong, the gap Option 1 misses): **${wrongDest.length}** (${nav.length ? Math.round((100 * wrongDest.length) / nav.length) : 0}%)\n`
md += `- **Fabricated control named**: **${fab.length}**\n`
md += `- Path accuracy (correct destination / navigation answers): **${nav.length ? Math.round((100 * (nav.length - wrongDest.length)) / nav.length) : 0}%**\n`
md += `- Judge errors: ${errs.length}\n\n`
md += `## Wrong-destination answers\n\n| id | prompt | expected route | reason |\n|--|--|--|--|\n`
for (const v of wrongDest.slice(0, 60))
  md += `| ${v.id} | ${String(v.prompt).slice(0, 60)} | ${String(v.expected_route).slice(0, 50)} | ${String(v.reason).slice(0, 80)} |\n`
md += `\n## Fabricated-control answers\n\n| id | prompt | reason |\n|--|--|--|\n`
for (const v of fab.slice(0, 60))
  md += `| ${v.id} | ${String(v.prompt).slice(0, 60)} | ${String(v.reason).slice(0, 90)} |\n`
console.log(md)
const verdictsPath = resultsPath.replace(/\.jsonl$/, '') + '.judge.jsonl'
writeFileSync(verdictsPath, verdicts.map((v) => JSON.stringify(v)).join('\n'))
console.error('wrote verdicts:', verdictsPath)
if (outPath) {
  writeFileSync(outPath, md)
  console.error('wrote', outPath)
}
process.exit(wrongDest.length || fab.length ? 1 : 0)
