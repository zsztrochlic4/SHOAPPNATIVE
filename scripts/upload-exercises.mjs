#!/usr/bin/env node
// Upload editable EXERCISE INFO (name, what-it-does, how-to steps, common
// mistake, safety note) from the workbook to the Firestore `exercises`
// collection, so the exercise detail screen can be edited WITHOUT an app release.
//
// Only the DISPLAY/INFO fields are uploaded — the workout engine keeps using the
// bundled src/backend/data/exercises.ts. The app overlays these docs on top of
// the bundled data for the detail view (see src/data/exerciseInfo.ts).
//
//   # dry run (no credentials needed):
//   node scripts/upload-exercises.mjs
//   # apply (needs a service-account key that can write Firestore):
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   npm run exercises:upload -- --apply --file "C:/path/StrengthHub_Workout_Backend_v16.xlsx"
//
// Idempotent (upsert by id). DRY-RUN by default.

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readExerciseInfo } from './lib/parse-exercises.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d }
const has = (n) => process.argv.includes(`--${n}`)
const XLSX = arg('file', join(repoRoot, 'data', 'exercises', 'StrengthHub_Workout_Backend.xlsx'))
const PROJECT = arg('project', process.env.GCLOUD_PROJECT || 'strengthhub-2ab33')
const APPLY = has('apply')
const BATCH = 200 // 2 ops per record (set name-doc + delete old id-doc), stay < 500

let records
try {
  records = readExerciseInfo(XLSX)
} catch (e) {
  console.error(`✖ Could not read workbook at ${XLSX}\n  ${e.message}`)
  console.error('  Pass --file "C:/path/to/StrengthHub_Workout_Backend_v16.xlsx" or copy it to data/exercises/StrengthHub_Workout_Backend.xlsx')
  process.exit(2)
}

const withSteps = records.filter((r) => r.steps.length).length
console.log(`▶ Exercise info upload to "${PROJECT}" — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
console.log(`  source: ${XLSX}`)
console.log(`  ${records.length} exercises  (${withSteps} with how-to steps)`)
for (const r of records.slice(0, 3)) console.log(`    ${r.id}  ${r.name}  — ${r.steps.length} steps`)

if (!APPLY) { console.log('\nDry run only — re-run with --apply (and GOOGLE_APPLICATION_CREDENTIALS set) to write.'); process.exit(0) }
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) { console.error('\n✖ --apply needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON.'); process.exit(2) }

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT }))

function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

// Documents are keyed by the exercise NAME (readable in the console). The app
// keys off the `id` field inside each doc, so the doc id can be anything.
let written = 0
for (const part of chunk(records, BATCH)) {
  const b = db.batch()
  for (const r of part) {
    b.set(db.collection('exercises').doc(r.name), { ...r, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    b.delete(db.collection('exercises').doc(r.id)) // remove the old id-keyed doc (CH01…)
  }
  await b.commit()
  written += part.length
  console.log(`  …wrote ${written}/${records.length}`)
}
const total = (await db.collection('exercises').count().get()).data().count
console.log(`\n✔ Uploaded ${written} exercise info docs (named by exercise). Collection now has ${total} docs.`)
process.exit(0)
