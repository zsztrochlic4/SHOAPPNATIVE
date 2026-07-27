/**
 * Local orchestrator: run the full backend validation the way the workflow does, then aggregate.
 *
 *   npm run validate:backend
 *
 * Runs each check in sequence (each writes results/parts/<name>.json), then aggregate-results.mjs
 * produces results/validation-<date>.json and prints the overall verdict. Cross-platform (no shell
 * chaining). Checks that need secrets (Gemini, Firestore) will 'skip' when the env vars are absent —
 * set GEMINI_API_KEY / FIREBASE_* (or FIRESTORE_EMULATOR_HOST) to exercise them locally.
 */
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, PARTS_DIR } from './lib/result.mjs'

const node = process.execPath
function run(args, label) {
  console.log(`\n▶ ${label}`)
  const r = spawnSync(node, args, { cwd: ROOT, stdio: 'inherit' })
  return r.status ?? 0
}

// Fresh parts each run.
rmSync(PARTS_DIR, { recursive: true, force: true })

const S = (p) => resolve(ROOT, 'scripts', p)
run([S('validate-data-sync.mjs')], 'Dataset sync')
run([S('firestore-seed.js')], 'Firestore seed + schema')
run([S('validate-safety-holdouts.mjs')], 'Safety classifier holdouts (Gemini)')
run(
  [
    S('run-step.mjs'),
    '--name',
    'tests',
    '--critical',
    '1',
    '--cmd',
    'npm run typecheck && npm run check && npm run sweep',
  ],
  'Code test suite',
)
run([S('run-step.mjs'), '--name', 'lint', '--critical', '0', '--cmd', 'npm run lint'], 'Lint')

const agg = run([S('aggregate-results.mjs')], 'Aggregate')
process.exit(agg)
