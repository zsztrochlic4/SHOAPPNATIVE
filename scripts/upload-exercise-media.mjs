#!/usr/bin/env node
// Upload exercise media (form-clip videos + thumbnail images) to Cloud Storage,
// so they appear in the app WITHOUT an app release.
//
//   # 1. Put files in data/exercise-media/ named by exercise id:
//   #      bench.mp4   (looping form clip)   bench.jpg   (thumbnail/poster)
//   # 2. Dry run (no credentials needed) — see what would upload:
//   node scripts/upload-exercise-media.mjs
//   # 3. Upload (needs a service-account key that can write Storage):
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   npm run media:upload -- --apply
//
// Files land under `exercises/<filename>` in the bucket, which is public-read
// (storage.rules). The app resolves `exercises/{id}.mp4` / `{id}.jpg` by
// convention (see src/lib/media.ts), so naming a file by the exercise id is all
// that's needed — it shows on that exercise automatically. DRY-RUN by default.

import { readdirSync, statSync } from 'node:fs'
import { join, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readExercises, folderFor } from './lib/exercises-list.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const NAME_BY_ID = Object.fromEntries(readExercises().map((e) => [e.id, e.name]))
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d }
const has = (n) => process.argv.includes(`--${n}`)
const DIR = arg('dir', join(repoRoot, 'data', 'exercise-media'))
const BUCKET = arg('bucket', process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'strengthhub-2ab33.firebasestorage.app')
const APPLY = has('apply')

const CT = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
}
const publicUrl = (dest) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(dest)}?alt=media`

let files = []
try {
  files = readdirSync(DIR)
    .filter((f) => !f.startsWith('.') && f.toLowerCase() !== 'readme.md')
    .filter((f) => statSync(join(DIR, f)).isFile())
} catch {
  console.error(`✖ Drop folder not found: ${DIR}`)
  process.exit(2)
}

const items = []
const skipped = []
for (const f of files) {
  const ext = extname(f).toLowerCase()
  if (!CT[ext]) { skipped.push(`${f} (unsupported type)`); continue }
  const id = basename(f, ext)
  const folder = folderFor(NAME_BY_ID[id] ?? id) // name-based folder; falls back to id
  const kind = ext.match(/mp4|mov|webm|m4v/) ? 'video' : 'image'
  // Per-exercise folder convention: exercises/{name}/video.mp4 + exercises/{name}/thumb.jpg
  const dest = `exercises/${folder}/${kind === 'video' ? 'video' : 'thumb'}${ext}`
  items.push({ file: f, dest, id: folder, kind, contentType: CT[ext] })
}

console.log(`▶ Exercise media upload to bucket "${BUCKET}" — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
console.log(`  folder: ${DIR}`)
console.log(`  ${items.length} file(s) to upload${skipped.length ? `, ${skipped.length} skipped` : ''}`)
for (const it of items) console.log(`    ${it.kind.padEnd(5)} ${it.file}  →  exercise "${it.id}"`)
for (const s of skipped) console.log(`    skip  ${s}`)

if (!items.length) { console.log('\nNothing to upload — drop files into the folder first.'); process.exit(0) }
if (!APPLY) { console.log('\nDry run only — re-run with --apply (and GOOGLE_APPLICATION_CREDENTIALS set) to upload.'); process.exit(0) }

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('\n✖ --apply needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON.')
  process.exit(2)
}

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getStorage } = await import('firebase-admin/storage')
const app = initializeApp({ credential: applicationDefault(), storageBucket: BUCKET })
const bucket = getStorage(app).bucket()

let done = 0
for (const it of items) {
  await bucket.upload(join(DIR, it.file), { destination: it.dest, metadata: { contentType: it.contentType, cacheControl: 'public, max-age=86400' } })
  done++
  console.log(`  ✓ ${it.file}  →  ${publicUrl(it.dest)}`)
}
console.log(`\n✔ Uploaded ${done} file(s) to exercises/. They are public-read and live in the app on next launch.`)
process.exit(0)
