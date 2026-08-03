#!/usr/bin/env node
/**
 * Sync the SHARED coach-safety + engine source into functions/src/_shared so the
 * server-side coach runs the EXACT SAME guardrails as the app — the spec's hard
 * "one source, no drift" rule. The single source of truth stays src/**; this makes
 * a verbatim, GENERATED copy (functions/src/_shared/** is gitignored and must never
 * be hand-edited). Runs as a prebuild step before `tsc`, like the app's generated
 * data files.
 *
 * It copies ONLY the transitive closure of the coach entry points below (following
 * relative imports), so it can never pull in an app-only module: the sole
 * Firebase-client dependency in src/backend is src/backend/repo/** (via
 * ../../lib/firebase), which the coach path does not reach and which therefore
 * never enters the closure. A missing file would fail the functions `tsc`.
 *
 *   node functions/scripts/sync-shared.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const srcRoot = join(repoRoot, 'src')
const outRoot = join(repoRoot, 'functions', 'src', '_shared')

// Entry points the server coach (functions/src/coach.ts) + its test suite import.
// Everything else is discovered by following relative imports from these.
const ENTRIES = [
  'backend/coach/coachGate.ts',
  'backend/coach/requestControls.ts',
  'backend/coach/operatingRules.ts',
  'backend/coach/contracts.ts',
  'backend/coach/structuredResponse.ts',
  'backend/coach/contextSelection.ts',
  'backend/coach/coachTelemetry.ts',
  'backend/coach/safety/index.ts',
  'backend/coach/safety/llmClassifier.ts',
  'backend/coach/safety/types.ts',
  'backend/coach/safety/runCoachSafetyTests.ts',
].map((p) => join(srcRoot, p))

/** Resolve a relative import specifier from `fromFile` to an existing .ts under src/. */
function resolveTs(spec, fromFile) {
  if (!spec.startsWith('.')) return null // bare module (firebase-admin, node:*) — not ours
  const base = resolve(dirname(fromFile), spec)
  const candidates = [base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

// Match static import/export specifiers (incl. `import type`, side-effect imports, re-exports).
const SPEC_RE = /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g

const visited = new Set()
function visit(file) {
  if (visited.has(file)) return
  visited.add(file)
  const code = readFileSync(file, 'utf8')
  for (const m of code.matchAll(SPEC_RE)) {
    const dep = resolveTs(m[1], file)
    if (dep) visit(dep)
    else if (m[1].startsWith('.') === false && /firebase\/(app|ai|firestore)|\/firebase'$/.test(m[1])) {
      throw new Error(`Shared-sync closure reached a Firebase CLIENT import "${m[1]}" from ${relative(repoRoot, file)} — that must never be server-side.`)
    }
  }
}
for (const e of ENTRIES) {
  if (!existsSync(e)) throw new Error(`sync entry not found: ${relative(repoRoot, e)}`)
  visit(e)
}

// Fresh mirror each run — no stale files, structure preserved so relative imports resolve.
rmSync(outRoot, { recursive: true, force: true })
let count = 0
for (const file of visited) {
  const rel = relative(srcRoot, file)
  const dest = join(outRoot, rel)
  mkdirSync(dirname(dest), { recursive: true })
  const banner = `/* GENERATED — copied from src/${rel.replace(/\\/g, '/')} by functions/scripts/sync-shared.mjs. Do NOT edit. */\n`
  writeFileSync(dest, banner + readFileSync(file, 'utf8'))
  count++
}
console.log(`✓ synced ${count} shared files → functions/src/_shared`)
