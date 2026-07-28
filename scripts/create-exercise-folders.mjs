#!/usr/bin/env node
// Pre-create a labelled folder for every exercise in Cloud Storage, so you can
// open the workout's folder in the Firebase console and drop its two files in:
//   exercises/{id}/video.mp4   (form clip)
//   exercises/{id}/thumb.jpg   (thumbnail)
//
// It uploads a tiny note file into each `exercises/{id}/` folder named after the
// exercise (e.g. "Barbell Bench Press.txt"), so the folder exists and is easy to
// recognise. Delete the note once you've added the real files (optional).
//
//   node scripts/create-exercise-folders.mjs                 # dry run
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   npm run media:folders -- --apply                         # create them
//
// Idempotent, DRY-RUN by default.

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d }
const has = (n) => process.argv.includes(`--${n}`)
const BUCKET = arg('bucket', process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'strengthhub-2ab33.firebasestorage.app')
const APPLY = has('apply')

// Parse id + name from the generated exercise DB (document order).
const src = readFileSync(join(repoRoot, 'src', 'backend', 'data', 'exercises.ts'), 'utf8')
const ids = [...src.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1])
const names = [...src.matchAll(/"name":\s*"([^"]+)"/g)].map((m) => m[1])
const exercises = ids.map((id, i) => ({ id, name: names[i] || id }))

const safe = (s) => s.replace(/[\\/\r\n]+/g, '-').trim()
const note = (e) => `${e.id} — ${e.name}\n\nDrop TWO files into this folder:\n  * video.mp4   (looping form clip)\n  * thumb.jpg   (thumbnail photo)\n\nThey appear on this exercise in the app automatically.\nYou can delete this note once the files are uploaded.\n`

console.log(`▶ Create exercise folders in bucket "${BUCKET}" — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
console.log(`  ${exercises.length} exercises`)
for (const e of exercises.slice(0, 5)) console.log(`    exercises/${e.id}/  (${e.name})`)
console.log(`    … ${Math.max(0, exercises.length - 5)} more`)

if (!APPLY) { console.log('\nDry run only — re-run with --apply (and GOOGLE_APPLICATION_CREDENTIALS set) to create them.'); process.exit(0) }
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) { console.error('\n✖ --apply needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON.'); process.exit(2) }

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getStorage } = await import('firebase-admin/storage')
const app = initializeApp({ credential: applicationDefault(), storageBucket: BUCKET })
const bucket = getStorage(app).bucket()

let done = 0
for (const e of exercises) {
  const dest = `exercises/${e.id}/${safe(e.name)}.txt`
  await bucket.file(dest).save(note(e), { contentType: 'text/plain; charset=utf-8', resumable: false })
  done++
  if (done % 20 === 0) console.log(`  …${done}/${exercises.length}`)
}
console.log(`\n✔ Created ${done} exercise folders under exercises/. Open one in the console and drop video.mp4 + thumb.jpg in.`)
console.log(`  Console: https://console.firebase.google.com/project/${(BUCKET.split('.')[0])}/storage`)
process.exit(0)
