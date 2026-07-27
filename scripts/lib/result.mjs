/**
 * Shared helpers for the backend-validation scripts: consistent result "part" files and logging.
 *
 * Each check writes results/parts/<name>.json with a stable shape so aggregate-results.mjs can
 * assemble the final results/validation-<date>.json without knowing each check's internals.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PARTS_DIR = resolve(ROOT, 'results', 'parts')

/** UTC date key (YYYY-MM-DD) — the shared filename stamp for a run. */
export function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

/**
 * A check result. status: 'pass' | 'fail' | 'skip'.
 * `critical: true` means a 'fail' must fail the whole workflow.
 */
export function writePart(name, { status, critical = false, summary = '', metrics = {}, details = {} }) {
  mkdirSync(PARTS_DIR, { recursive: true })
  const part = { name, status, critical, summary, metrics, details, finished_at: new Date().toISOString() }
  writeFileSync(resolve(PARTS_DIR, `${name}.json`), JSON.stringify(part, null, 2))
  return part
}

/** Emit a GitHub Actions step-summary line if running in CI (best-effort, no-op locally). */
export function ghSummary(md) {
  const f = process.env.GITHUB_STEP_SUMMARY
  if (!f) return
  try {
    writeFileSync(f, md + '\n', { flag: 'a' })
  } catch {
    /* best-effort */
  }
}

/** Finish a check: print a banner, write its part, and exit non-zero on a critical failure. */
export function finish(name, result) {
  const part = writePart(name, result)
  const icon = part.status === 'pass' ? '✅' : part.status === 'skip' ? '⏭️' : '❌'
  console.log(`\n${icon} [${name}] ${part.status.toUpperCase()} — ${part.summary}`)
  ghSummary(`${icon} **${name}** — ${part.status.toUpperCase()}: ${part.summary}`)
  // A non-critical fail (or a skip) still exits 0 so the workflow can aggregate; the gate step decides.
  if (part.status === 'fail' && part.critical) process.exitCode = 1
}
