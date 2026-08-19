/**
 * OBSERVABLE kill-switch drill against the Firestore emulator (COACH_RELEASE_STATE Condition 4, local).
 *
 * Exercises the REAL server gate: it enables the coach (COACH_RELEASE_CHANNEL=internal), reads the REAL
 * `config/coach.killSwitch` field via the production reader (`coachKillSwitch`), and calls the real
 * `runCoachTurn`. It shows the turn go: answers (past the gate) → killSwitch=true → `coach_unavailable`
 * (no redeploy) → killSwitch=false → answers again. loadTurnData throws a sentinel so we can tell the
 * turn got PAST the kill-switch gate without needing a seeded user or a live model.
 *
 * Prereq: the Firestore emulator running, and functions built (functions/lib).
 *   Terminal 1:  npx firebase emulators:start --only firestore --project strengthhub-2ab33
 *   Terminal 2:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=strengthhub-2ab33 \
 *                  node scripts/killswitch-emulator-drill.mjs
 *
 * LOCAL drill — proves the mechanism end-to-end. The PRODUCTION Condition-4 drill (toggling the real
 * prod config/coach.killSwitch against the deployed, enabled coach) is still performed at enablement.
 */
process.env.COACH_RELEASE_CHANNEL = 'internal' // MUST be set before importing coach (COACH_ENABLED is import-time)
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Set FIRESTORE_EMULATOR_HOST (e.g. 127.0.0.1:8080) — refusing to run against real Firestore.')
  process.exit(2)
}

const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
try {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'strengthhub-2ab33' })
} catch (e) {
  if (!/already exists/i.test(String(e?.message))) throw e
}
const { runCoachTurn } = require('../functions/lib/coach.js')
const { coachKillSwitch, coachReleaseGate } = require('../functions/lib/killSwitchRemote.js')

async function setKill(v) {
  await getFirestore().doc('config/coach').set({ killSwitch: v }, { merge: true })
  await coachKillSwitch.refresh() // pull the new value into the cached reader (what production does on its TTL)
}

// Open the server-authoritative release gate for the drill (defence in depth: the coach requires
// config/coach.releaseEnabled === true in ADDITION to the internal build channel). Without this the
// turn would be refused with coach_disabled before it ever reached the kill-switch check.
async function setReleaseEnabled(v) {
  await getFirestore().doc('config/coach').set({ releaseEnabled: v }, { merge: true })
  await coachReleaseGate.refresh()
}

async function turn() {
  const deps = {
    readDob: async () => '1995-01-01',
    classify: async () => ({ decision: { action: 'allow' } }),
    generateReply: async () => '',
    enforceLimit: async () => {},
    killSwitchEngaged: () => coachKillSwitch.engaged(), // the REAL reader, bound to the emulator field
    releaseEnabledFresh: () => coachReleaseGate.enabledFresh(), // the REAL default-closed release gate
    todayKey: '2026-08-16',
    loadTurnData: async () => {
      throw new Error('GATE_PASSED')
    }, // sentinel: reached only if the kill-switch let the turn through
  }
  try {
    await runCoachTurn('drill-user', { message: 'hi' }, deps)
    return 'ANSWERS (past kill-switch)'
  } catch (e) {
    if (e.message === 'GATE_PASSED') return 'ANSWERS (past kill-switch)'
    return e.message // 'coach_unavailable' when the switch is engaged, 'coach_disabled' if not enabled
  }
}

const line = (s) => process.stdout.write(s + '\n')
line('')
line('Kill-switch drill (Firestore emulator, real runCoachTurn gate)')
line('─'.repeat(60))
await setReleaseEnabled(true) // open the default-closed release gate so the kill switch is what we exercise
await setKill(false)
line(`killSwitch=false → ${await turn()}`)
await setKill(true)
const killed = await turn()
line(`killSwitch=true  → ${killed}`)
await setKill(false)
line(`killSwitch=false → ${await turn()}`)
line('─'.repeat(60))
line(
  killed === 'coach_unavailable'
    ? 'PASS — the switch disables the coach with no redeploy.'
    : `UNEXPECTED — got "${killed}"`,
)
line('')
process.exit(killed === 'coach_unavailable' ? 0 : 1)
