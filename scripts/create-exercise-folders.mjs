#!/usr/bin/env node
// Pre-create a labelled folder for every exercise in Cloud Storage, named by the
// exercise's readable name, so you open the workout's folder in the Firebase
// console and drop its two files in:
//   exercises/Barbell Bench Press/video.mp4   (form clip)
//   exercises/Barbell Bench Press/thumb.jpg   (thumbnail)
//
// It uploads a tiny note file into each folder so the folder exists. It also
// cleans up the old id-named folders (exercises/CH01/ …) from an earlier run.
//
//   node scripts/create-exercise-folders.mjs                 # dry run
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   npm run media:folders -- --apply                         # create them
//
// Idempotent, DRY-RUN by default.

import { readExercises, folderFor } from './lib/exercises-list.mjs'

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const has = (n) => process.argv.includes(`--${n}`)
const BUCKET = arg('bucket', process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'strengthhub-2ab33.firebasestorage.app')
const APPLY = has('apply')

const exercises = readExercises()
const note = (e) =>
  `${e.name} (${e.id})\n\nDrop TWO files into this folder:\n  * video.mp4   (looping form clip)\n  * thumb.jpg   (thumbnail photo)\n\nThey appear on this exercise in the app automatically.\nYou can delete this note once the files are uploaded.\n`

console.log(`▶ Create exercise folders in bucket "${BUCKET}" — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
console.log(`  ${exercises.length} exercises, folders named by exercise name`)
for (const e of exercises.slice(0, 5)) console.log(`    exercises/${folderFor(e.name)}/`)
console.log(`    … ${Math.max(0, exercises.length - 5)} more`)

if (!APPLY) {
  console.log('\nDry run only — re-run with --apply (and GOOGLE_APPLICATION_CREDENTIALS set) to create them.')
  process.exit(0)
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('\n✖ --apply needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON.')
  process.exit(2)
}

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getStorage } = await import('firebase-admin/storage')
const app = initializeApp({ credential: applicationDefault(), storageBucket: BUCKET })
const bucket = getStorage(app).bucket()

let done = 0
for (const e of exercises) {
  // Clean up the previous id-named folder (exercises/{id}/…) if present.
  await bucket.deleteFiles({ prefix: `exercises/${e.id}/` }).catch(() => {})
  // Create the readable-name folder with a note file inside.
  await bucket
    .file(`exercises/${folderFor(e.name)}/_UPLOAD video.mp4 and thumb.jpg here.txt`)
    .save(note(e), { contentType: 'text/plain; charset=utf-8', resumable: false })
  done++
  if (done % 20 === 0) console.log(`  …${done}/${exercises.length}`)
}
console.log(`\n✔ Created ${done} name-labelled exercise folders (and removed the old id-named ones).`)
console.log(`  Console: https://console.firebase.google.com/project/${BUCKET.split('.')[0]}/storage`)
process.exit(0)
