// Coach remote kill-switch drill (release condition #4).
// Flips config/coach.killSwitch in Firestore and reads it back, so an operator can prove the coach
// can be disabled in production WITHOUT a redeploy (functions/src/killSwitchRemote.ts reads this doc).
//
// EMULATOR (rehearsal):  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=strengthhub-2ab33 node coach-killswitch-drill.mjs <engage|release|status>
// PRODUCTION (real drill): GOOGLE_APPLICATION_CREDENTIALS=<sa.json> GCLOUD_PROJECT=strengthhub-2ab33 node coach-killswitch-drill.mjs <engage|release|status>
//
// Full drill = engage -> send a coach message in the app and confirm it REFUSES (coach_unavailable)
// within ~30s (the switch TTL) -> release -> confirm the coach answers again. Record owner + timestamps.
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const mode = (process.argv[2] || 'status').toLowerCase()
if (!['engage', 'release', 'status'].includes(mode)) { console.error('usage: node coach-killswitch-drill.mjs <engage|release|status>'); process.exit(1) }

initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'strengthhub-2ab33' })
const db = getFirestore()
const ref = db.doc('config/coach')

const read = async () => (await ref.get()).get('killSwitch') === true

const run = async () => {
  const before = await read()
  if (mode === 'status') { console.log(`killSwitch = ${before}`); return }
  const value = mode === 'engage'
  await ref.set({ killSwitch: value, killSwitchUpdatedAt: FieldValue.serverTimestamp(), killSwitchDrill: true }, { merge: true })
  const after = await read()
  console.log(`killSwitch ${before} -> ${after} (${mode})`)
  if (mode === 'engage') {
    console.log('DRILL: within ~30s send a coach message in the app — it must be REFUSED (coach_unavailable), no redeploy.')
    console.log('Then run: node coach-killswitch-drill.mjs release  — and confirm the coach answers again.')
  } else {
    console.log('Released. Confirm the coach answers again. Record owner + timestamps in STATUS.md / COACH_RELEASE_STATE.md.')
  }
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
