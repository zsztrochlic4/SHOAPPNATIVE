#!/usr/bin/env node
// Upload the 8×12-minute bodyweight workouts to a new Firestore `workouts`
// collection, and add the handful of NEW bodyweight exercises those workouts
// introduce to the `exercises` collection (info docs, same shape as
// scripts/upload-exercises.mjs). Lets the "12-Minute Bodyweight Exercises" data
// be stored/edited server-side, mirroring the recipes + exercises pipeline.
//
//   # dry run (no credentials needed) — parse + report what would be written:
//   node scripts/upload-workouts.mjs
//
//   # apply — needs a service-account key that can write Firestore:
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   npm run workouts:upload -- --apply
//
// Behaviour:
//   • Upserts each workout → workouts/{workout name}  (readable doc ids).
//   • Upserts the 4 new exercise info docs → exercises/{exercise name} (merge).
//     The 27 exercises the workouts reuse already exist and are left untouched.
// Idempotent; safe to re-run. DRY-RUN by default.
//
// After editing the spreadsheet: run `npm run workouts:build` too, so the bundled
// seed (src/data/quickWorkouts.generated.ts, the offline/render source) matches.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readQuickWorkouts } from './lib/parse-quick-workouts.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const has = (n) => process.argv.includes(`--${n}`)
const XLSX = arg('file', join(repoRoot, 'data', 'quick-workouts', '8x12min.xlsx'))
const PROJECT = arg('project', process.env.GCLOUD_PROJECT || 'strengthhub-2ab33')
const APPLY = has('apply')
const BATCH = 200

// The exercises these workouts introduce that were not already in the DB. IDs
// are assigned in src/backend/data/exercises.ts (Step Jack's sheet id FB06 clashed
// with an existing exercise, so it is FB15 here). We read the exercise INFO fields
// straight out of the bundled DB so Firestore can never drift from the app.
const NEW_EXERCISE_IDS = ['BK16', 'BK17', 'BK18', 'FB15']
const INFO_FIELDS = [
  'id',
  'name',
  'muscleGroup',
  'skillLevel',
  'whyInDatabase',
  'whatItDoes',
  'steps',
  'commonMistake',
  'safetyNote',
]

/** Pull a single `{ … }` exercise object out of exercises.ts by id (each is clean JSON). */
function exerciseById(src, id) {
  const at = src.indexOf(`"id": "${id}"`)
  if (at < 0) return null
  const start = src.lastIndexOf('{', at)
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return JSON.parse(src.slice(start, i + 1))
  }
  return null
}

const { workouts, problems } = readQuickWorkouts(XLSX)
if (problems.length) {
  console.error('✖ workout problems:\n  ' + problems.join('\n  '))
  process.exit(1)
}

const exSrc = readFileSync(join(repoRoot, 'src', 'backend', 'data', 'exercises.ts'), 'utf8')
const newExercises = NEW_EXERCISE_IDS.map((id) => {
  const full = exerciseById(exSrc, id)
  if (!full) {
    console.error(`✖ new exercise ${id} not found in src/backend/data/exercises.ts`)
    process.exit(1)
  }
  return Object.fromEntries(INFO_FIELDS.map((k) => [k, full[k]]))
})

console.log(`▶ Workout upload to "${PROJECT}" — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
console.log(`  source: ${XLSX}`)
console.log(`  workouts → "workouts" collection: ${workouts.length}`)
for (const w of workouts)
  console.log(`    ${w.order}. ${w.name}  [${w.level}]  ${w.rounds.length}×${w.rounds[0].stations.length}`)
console.log(`  new exercise info docs → "exercises" collection: ${newExercises.length}`)
for (const e of newExercises) console.log(`    ${e.id}  ${e.name}  (${e.muscleGroup})`)

if (!APPLY) {
  console.log('\nDry run only — re-run with --apply (and GOOGLE_APPLICATION_CREDENTIALS set) to write.')
  process.exit(0)
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('\n✖ --apply needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON.')
  process.exit(2)
}

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT }))

function chunk(a, n) {
  const o = []
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n))
  return o
}

// Workouts → workouts/{name}. Exercises → exercises/{name}. Docs keyed by readable
// name (console-friendly), matching the exercises/recipes convention.
let w = 0
for (const part of chunk(workouts, BATCH)) {
  const b = db.batch()
  for (const wk of part)
    b.set(db.collection('workouts').doc(wk.name), { ...wk, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  await b.commit()
  w += part.length
  console.log(`  …wrote ${w}/${workouts.length} workouts`)
}
{
  const b = db.batch()
  for (const e of newExercises)
    b.set(db.collection('exercises').doc(e.name), { ...e, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  await b.commit()
}
const wt = (await db.collection('workouts').count().get()).data().count
const et = (await db.collection('exercises').count().get()).data().count
console.log(
  `\n✔ Wrote ${workouts.length} workouts (collection now ${wt}) and ${newExercises.length} new exercise docs (collection now ${et}).`,
)
process.exit(0)
