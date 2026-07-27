/**
 * Generic step runner: run a shell command and record its outcome as a result part.
 *
 *   node scripts/run-step.mjs --name tests --critical 1 --cmd "npm run typecheck && npm run check"
 *   node scripts/run-step.mjs --name rules --critical 0 --skip-if-missing test/rules --cmd "..."
 *
 * Streams the command's output, then writes results/parts/<name>.json with status pass|fail from the
 * exit code. Exits non-zero only when a CRITICAL step fails, so the workflow can `continue-on-error`
 * on non-critical steps and let the aggregate gate decide the overall result. `--skip-if-missing <path>`
 * records a 'skip' (and does not run) when the path is absent — used so a step whose inputs aren't part
 * of this changeset (e.g. the test/rules suite) doesn't hard-fail before those inputs exist.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { finish, ROOT } from './lib/result.mjs'

function arg(flag, def) {
  const i = process.argv.indexOf(flag)
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : def
}

const name = arg('--name')
const critical = arg('--critical', '0') === '1'
const cmd = arg('--cmd')
const skipIfMissing = arg('--skip-if-missing')

if (!name || !cmd) {
  console.error(
    'usage: node scripts/run-step.mjs --name <name> --critical <0|1> [--skip-if-missing <path>] --cmd "<command>"',
  )
  process.exit(2)
}

if (skipIfMissing && !existsSync(resolve(ROOT, skipIfMissing))) {
  finish(name, {
    status: 'skip',
    critical,
    summary: `skipped — "${skipIfMissing}" not present`,
    metrics: { skipped: true },
    details: { skip_if_missing: skipIfMissing, command: cmd },
  })
  process.exit(0)
}

const started = Date.now()
const child = spawn(cmd, { shell: true, stdio: 'inherit' })

child.on('close', (code) => {
  const seconds = Math.round((Date.now() - started) / 1000)
  const status = code === 0 ? 'pass' : 'fail'
  finish(name, {
    status,
    critical,
    summary: `${status === 'pass' ? 'ok' : `exit ${code}`} in ${seconds}s — \`${cmd}\``,
    metrics: { exit_code: code, seconds },
    details: { command: cmd },
  })
})
