/**
 * Aggregate every results/parts/*.json into a single results/validation-<date>.json and decide the
 * overall pass/fail (fail iff any CRITICAL part failed).
 *
 *   node scripts/aggregate-results.mjs
 *
 * Writes:
 *   • results/validation-<UTC-date>.json  — the detailed report (uploaded as the workflow artifact)
 *   • GITHUB_OUTPUT overall=pass|fail      — read by the workflow's gate + email steps
 *   • GITHUB_STEP_SUMMARY                  — a human table
 *
 * This script does NOT fail the job itself (so artifact upload + email still run); the workflow's gate
 * step fails the job when overall=fail.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, PARTS_DIR, dateKey } from './lib/result.mjs'

const RESULTS_DIR = resolve(ROOT, 'results')

/** Map internal part names → the report's top-level sections (per the requested schema). */
const SECTION = {
  'firestore-seed': 'firestore',
  'safety-holdouts': 'holdouts',
  'data-sync': 'data_sync',
  tests: 'tests',
  lint: 'lint',
  rules: 'rules',
}

function loadParts() {
  if (!existsSync(PARTS_DIR)) return []
  return readdirSync(PARTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(PARTS_DIR, f), 'utf8')))
}

function main() {
  const parts = loadParts()
  const date = dateKey()

  const sections = {}
  for (const p of parts) sections[SECTION[p.name] ?? p.name] = p

  const criticalFails = parts.filter((p) => p.critical && p.status === 'fail')
  const nonCriticalFails = parts.filter((p) => !p.critical && p.status === 'fail')
  const skips = parts.filter((p) => p.status === 'skip')
  const overall = criticalFails.length ? 'fail' : 'pass'

  const report = {
    date,
    generated_at: new Date().toISOString(),
    overall,
    git: {
      sha: process.env.GITHUB_SHA ?? null,
      ref: process.env.GITHUB_REF ?? null,
      run_id: process.env.GITHUB_RUN_ID ?? null,
      run_url:
        process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
          ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
          : null,
    },
    summary: {
      total_checks: parts.length,
      passed: parts.filter((p) => p.status === 'pass').length,
      failed: parts.filter((p) => p.status === 'fail').length,
      skipped: skips.length,
      critical_failures: criticalFails.length,
    },
    sections,
    parts,
  }

  mkdirSync(RESULTS_DIR, { recursive: true })
  const outFile = resolve(RESULTS_DIR, `validation-${date}.json`)
  writeFileSync(outFile, JSON.stringify(report, null, 2))

  // Console banner
  console.log('\n================ SHO BACKEND VALIDATION ================')
  console.log(`Date        : ${date}`)
  console.log(`Overall     : ${overall.toUpperCase()}`)
  console.log(
    `Checks      : ${report.summary.passed} pass · ${report.summary.failed} fail · ${report.summary.skipped} skip`,
  )
  for (const p of parts) {
    const icon = p.status === 'pass' ? '✅' : p.status === 'skip' ? '⏭️' : '❌'
    console.log(`  ${icon} ${p.name}${p.critical ? ' (critical)' : ''}: ${p.summary}`)
  }
  if (criticalFails.length) console.log(`\nCRITICAL FAILURES: ${criticalFails.map((p) => p.name).join(', ')}`)
  if (nonCriticalFails.length) console.log(`Non-critical failures: ${nonCriticalFails.map((p) => p.name).join(', ')}`)
  console.log(`\nReport      : ${outFile}`)
  console.log('=======================================================\n')

  // GitHub Actions wiring
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `overall=${overall}\nreport=${outFile}\ndate=${date}\n`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = parts
      .map((p) => {
        const icon = p.status === 'pass' ? '✅' : p.status === 'skip' ? '⏭️' : '❌'
        return `| ${icon} ${p.name} | ${p.status} | ${p.critical ? 'yes' : 'no'} | ${p.summary.replace(/\|/g, '\\|')} |`
      })
      .join('\n')
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n## SHO backend validation — ${overall.toUpperCase()} (${date})\n\n` +
        `| Check | Status | Critical | Summary |\n|---|---|---|---|\n${rows}\n`,
    )
  }
}

main()
