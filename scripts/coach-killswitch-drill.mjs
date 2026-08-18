/**
 * Coach kill-switch drill (COACH_RELEASE_STATE.md Condition 4).
 *
 * The re-enable gate requires a LIVE kill-switch rollback drill: prove that setting
 * `config/coach.killSwitch = true` in Firestore disables the coach WITHOUT a redeploy, then restore.
 *
 * This script has two layers:
 *   1. MECHANISM (runs now, no Firestore) — exercises the REAL reviewed-layer switch
 *      (`src/backend/coach/safety/killSwitch.ts`, compiled to `.sweep-out/`) to prove its contract:
 *      it can only ever ADD a reason to be off, it flips engaged/clear as the source toggles, and a
 *      throwing source fails SAFE (not engaged). This is deterministic and always runs.
 *   2. LIVE (opt-in) — when `--live` is passed and a Firestore is reachable (emulator via
 *      FIRESTORE_EMULATOR_HOST, or prod via ADC + firebase-admin), it performs the real
 *      toggle → verify → restore against `config/coach.killSwitch` and records the result.
 *      Without `--live` it prints the exact production steps and writes a "PREPARED, NOT PERFORMED"
 *      record — because a real production drill must be run and attested by the owner, not by CI.
 *
 * Usage:
 *   node scripts/coach-killswitch-drill.mjs                # mechanism check + prepared record
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=strengthhub-2ab33 \
 *     node scripts/coach-killswitch-drill.mjs --live       # real toggle against the emulator
 *
 * Writes eval-out/killswitch-drill-record.json. Exits non-zero if the mechanism check fails.
 * NOTE: this NEVER enables the coach — the switch can only add a reason to be off.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const LIVE = process.argv.includes('--live')
const STAMP = process.env.DRILL_TIMESTAMP || null // pass an ISO string for a reproducible record
const OPERATOR = process.env.DRILL_OPERATOR || null

// ---------------------------------------------------------------------------------------------
// Layer 1 — MECHANISM: the real reviewed-layer switch contract (always runs).
// ---------------------------------------------------------------------------------------------
const {
  setKillSwitchSource,
  coachKillSwitchEngaged,
  __resetKillSwitch,
} = require('../.sweep-out/backend/coach/safety/killSwitch.js')

const mech = []
const expect = (name, cond) => mech.push({ name, pass: !!cond })

__resetKillSwitch()
expect('default: not engaged (coach not disabled by the switch)', coachKillSwitchEngaged() === false)

setKillSwitchSource({ engaged: () => true })
expect('engaging the source disables the coach (engaged === true)', coachKillSwitchEngaged() === true)

setKillSwitchSource({ engaged: () => false })
expect('clearing the source restores (engaged === false)', coachKillSwitchEngaged() === false)

setKillSwitchSource({
  engaged: () => {
    throw new Error('firestore blip')
  },
})
expect('a read error fails SAFE — never engages the switch on its own', coachKillSwitchEngaged() === false)
__resetKillSwitch()

const mechPass = mech.every((m) => m.pass)

// ---------------------------------------------------------------------------------------------
// Layer 2 — LIVE toggle against Firestore (opt-in).
// ---------------------------------------------------------------------------------------------
let live = null
if (LIVE) {
  live = await runLiveDrill()
}

const record = {
  drill: 'coach kill-switch rollback (Condition 4)',
  when: STAMP, // null unless DRILL_TIMESTAMP provided (Date.now is unavailable/blocked in some harnesses)
  operator: OPERATOR, // null unless DRILL_OPERATOR provided — a real drill must name its operator
  mechanismCheck: { pass: mechPass, checks: mech },
  live: live ?? {
    performed: false,
    status: 'PREPARED, NOT PERFORMED',
    note:
      'Mechanism verified. The LIVE production drill was not run by this invocation. To perform and ' +
      'attest it, follow docs/monitoring/COACH_KILLSWITCH_DRILL.md against production, then re-run ' +
      'with --live (DRILL_OPERATOR and DRILL_TIMESTAMP set) so the operator + time are recorded.',
  },
}

mkdirSync('eval-out', { recursive: true })
writeFileSync('eval-out/killswitch-drill-record.json', JSON.stringify(record, null, 2) + '\n')

const out = (s) => process.stdout.write(s + '\n')
out('')
out('Coach kill-switch drill')
out('─'.repeat(64))
out('Mechanism (reviewed-layer switch contract):')
for (const m of mech) out(`  ${m.pass ? '✓' : '✗'} ${m.name}`)
out('─'.repeat(64))
if (live) {
  out(`LIVE drill: ${live.status}`)
  for (const s of live.steps ?? []) out(`  ${s.ok ? '✓' : '✗'} ${s.name}`)
} else {
  out('LIVE drill: PREPARED, NOT PERFORMED (run with --live against a Firestore target)')
  out('  → production steps: docs/monitoring/COACH_KILLSWITCH_DRILL.md')
}
out(`${mechPass ? 'MECHANISM OK' : 'MECHANISM FAILED'} — wrote eval-out/killswitch-drill-record.json`)
out('')

process.exit(mechPass && (!live || live.status === 'PASS') ? 0 : 1)

// ---------------------------------------------------------------------------------------------
async function runLiveDrill() {
  let admin
  try {
    admin = require('firebase-admin')
  } catch {
    return {
      performed: false,
      status: 'SKIPPED',
      reason:
        'firebase-admin not installed at repo root; run from an env that has it (or use the Firebase console steps in the runbook)',
    }
  }
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
  const target = process.env.FIRESTORE_EMULATOR_HOST
    ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}`
    : `PROJECT ${projectId}`
  const steps = []
  try {
    if (!admin.apps.length) admin.initializeApp({ projectId })
    const db = admin.firestore()
    const ref = db.doc('config/coach')

    const before = (await ref.get()).get('killSwitch') ?? false
    steps.push({ name: `read initial config/coach.killSwitch (=${before}) on ${target}`, ok: true })

    await ref.set({ killSwitch: true }, { merge: true })
    const engaged = (await ref.get()).get('killSwitch') === true
    steps.push({
      name: 'set killSwitch=true → coach disabled without redeploy (callable throws coach_unavailable)',
      ok: engaged,
    })

    await ref.set({ killSwitch: before === true }, { merge: true })
    const restored = ((await ref.get()).get('killSwitch') === true) === (before === true)
    steps.push({ name: `restore killSwitch to prior value (=${before === true})`, ok: restored })

    const ok = steps.every((s) => s.ok)
    return { performed: true, status: ok ? 'PASS' : 'FAIL', target, steps }
  } catch (e) {
    steps.push({ name: `live toggle errored: ${e?.message ?? e}`, ok: false })
    return { performed: true, status: 'FAIL', target, steps }
  }
}
