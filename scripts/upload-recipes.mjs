#!/usr/bin/env node
// Upload recipes from the spreadsheet to the Firestore `recipes` collection, so
// the app's Nutrition → Recipes list can be edited WITHOUT an app release.
//
//   # dry run (no credentials needed) — parse + report what would be written:
//   node scripts/upload-recipes.mjs
//
//   # apply — needs a service-account key that can write Firestore:
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   npm run recipes:upload -- --apply
//   node scripts/upload-recipes.mjs --file "C:/path/to/your.xlsx" --apply
//
// Behaviour:
//   • Upserts every active recipe → recipes/{id} (merge), deprecated:false.
//   • Marks the "Firebase Deprecations" ids as deprecated:true stubs so any old
//     favourite/reference still resolves gracefully (never hard-deleted).
//   • Idempotent; safe to re-run. DRY-RUN by default.
//
// After editing recipes: run `npm run recipes:build` too, so the bundled seed
// (offline fallback) matches what you upload.

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkbook, countByCategory } from './lib/parse-recipes.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d }
const has = (n) => process.argv.includes(`--${n}`)
const XLSX = arg('file', join(repoRoot, 'data', 'recipes', 'StrengthHub_Recipe_Template.xlsx'))
const PROJECT = arg('project', process.env.GCLOUD_PROJECT || 'strengthhub-2ab33')
const APPLY = has('apply')
const BATCH = 400

const { recipes, deprecations, problems } = readWorkbook(XLSX)
if (problems.length) { console.error('✖ recipe problems:\n  ' + problems.join('\n  ')); process.exit(1) }

// Deprecations that aren't superseded by an active recipe of the same id.
const activeIds = new Set(recipes.map((r) => r.id))
const depStubs = deprecations.filter((d) => !activeIds.has(d.id))

console.log(`▶ Recipe upload to "${PROJECT}" — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
console.log(`  active recipes: ${recipes.length}  (${Object.entries(countByCategory(recipes)).map(([k, v]) => `${k}:${v}`).join(' ')})`)
console.log(`  deprecated stubs: ${depStubs.length}`)

if (!APPLY) {
  console.log('\nDry run only — re-run with --apply (and GOOGLE_APPLICATION_CREDENTIALS set) to write.')
  process.exit(0)
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('✖ --apply needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON.')
  process.exit(2)
}

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT })
const db = getFirestore(app)

function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

const activeDocs = recipes.map((r) => ({ id: r.id, data: { ...r, deprecated: false, updatedAt: FieldValue.serverTimestamp() } }))
const depDocs = depStubs.map((d) => ({ id: d.id, data: { id: d.id, name: d.name, category: d.category, deprecated: true, replacement: d.replacement || '', updatedAt: FieldValue.serverTimestamp() } }))
const all = [...activeDocs, ...depDocs]

let written = 0
for (const part of chunk(all, BATCH)) {
  const b = db.batch()
  for (const { id, data } of part) b.set(db.collection('recipes').doc(id), data, { merge: true })
  await b.commit()
  written += part.length
  console.log(`  …wrote ${written}/${all.length}`)
}

const total = (await db.collection('recipes').count().get()).data().count
console.log(`\n✔ Uploaded ${activeDocs.length} recipes + ${depDocs.length} deprecated stubs. Collection now has ${total} docs.`)
process.exit(0)
