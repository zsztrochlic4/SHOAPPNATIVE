#!/usr/bin/env node
// One-time migration (Hardening Plan v3 §11 "migrate invalid/obsolete data") for
// LEGACY accounts whose root users/{uid} doc still embeds the unbounded log
// arrays (weights, habits, meals, …). The hardened rules' root allowlist rejects
// those keys, so this moves each array's elements into its per-entry
// subcollection — exactly what src/store/cloudRepo.ts does on the next save —
// then removes the arrays from the root doc.
//
// SAFETY:
//   • Lossless + ordered: writes subcollections FIRST, verifies counts, and only
//     THEN deletes the root arrays. A failure mid-way leaves the root intact.
//   • Backs up each affected root doc to <backup-dir>/<uid>.json before mutating.
//   • Idempotent: subcollection docs are keyed by their stable id/dateKey, so a
//     re-run overwrites rather than duplicates.
//   • DRY-RUN by default — prints the plan and writes nothing. Pass --apply to act.
//
// Usage:
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   node scripts/migrate-legacy-root-arrays.mjs --project strengthhub-2ab33            # dry run (all affected users)
//   node scripts/migrate-legacy-root-arrays.mjs --project strengthhub-2ab33 --apply    # do it
//   node scripts/migrate-legacy-root-arrays.mjs --project strengthhub-2ab33 --uid <uid> --apply
//
// Exit: 0 ok, 2 setup error.

import { mkdirSync, writeFileSync } from 'node:fs'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

/* keying — MUST match src/store/cloudRepo.ts SUBCOLLECTIONS */
const KEY_OF = {
  sessions: (e) => e.id,
  weights: (e) => e.dateKey,
  habits: (e) => e.dateKey,
  meals: (e) => e.id,
  activities: (e) => e.id,
  foodReviews: (e) => e.dateKey,
  chat: (e) => e.id,
  coachThread: (e) => e.id,
  notifications: (e) => e.id,
}
const COLS = Object.keys(KEY_OF)
const BATCH = 400
const clean = (v) => JSON.parse(JSON.stringify(v)) // strip undefined, like cloudRepo

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const has = (n) => process.argv.includes(`--${n}`)
const PROJECT = arg('project', process.env.GCLOUD_PROJECT || 'strengthhub-2ab33')
const ONLY_UID = arg('uid', '')
const APPLY = has('apply')
const BACKUP_DIR = arg('backup-dir', 'migration-backups')

function chunk(a, n) {
  const o = []
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n))
  return o
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('✖ Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON.')
    process.exit(2)
  }
  const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT })
  const db = getFirestore(app)
  console.log(`▶ Legacy root-array migration on "${PROJECT}" — ${APPLY ? 'APPLY' : 'DRY RUN'}`)

  const users = ONLY_UID
    ? [await db.collection('users').doc(ONLY_UID).get()]
    : (await db.collection('users').get()).docs

  let affected = 0
  for (const snap of users) {
    if (!snap.exists) {
      console.log(`  ${snap.id}: not found`)
      continue
    }
    const uid = snap.id
    const data = snap.data() || {}
    // Any of the 9 log keys present as an array (EMPTY arrays count too — an empty
    // `foodReviews: []` at the root is still rejected by the allowlist and must go).
    const present = COLS.filter((c) => Array.isArray(data[c]))
    if (present.length === 0) continue
    affected++

    // Build the write plan; skip elements missing a stable key (never lose them silently).
    const plan = {}
    const skipped = {}
    for (const c of present) {
      plan[c] = []
      for (const e of data[c]) {
        const id = KEY_OF[c](e)
        if (id == null || id === '') {
          ;(skipped[c] ??= []).push(e)
          continue
        }
        plan[c].push({ id: String(id), data: clean(e) })
      }
    }
    const counts = present
      .map((c) => `${c}:${plan[c].length}${skipped[c] ? `(+${skipped[c].length} skipped)` : ''}`)
      .join('  ')
    console.log(`\n  ${uid}\n    migrate → ${counts}`)

    const anySkipped = Object.keys(skipped).length > 0
    if (anySkipped)
      console.log(`    ⚠ some elements lack a stable id/dateKey and will NOT be moved or deleted (kept in root).`)

    if (!APPLY) continue

    // 1. Backup the root doc.
    mkdirSync(BACKUP_DIR, { recursive: true })
    writeFileSync(`${BACKUP_DIR}/${uid}.json`, JSON.stringify(data, null, 2))
    console.log(`    ✓ backup → ${BACKUP_DIR}/${uid}.json`)

    // 2. Write subcollection docs (first — data now duplicated, nothing lost yet).
    for (const c of present) {
      const ops = plan[c]
      for (const part of chunk(ops, BATCH)) {
        const b = db.batch()
        for (const { id, data: doc } of part)
          b.set(db.collection('users').doc(uid).collection(c).doc(id), doc, { merge: true })
        await b.commit()
      }
    }
    // 3. Verify counts before deleting anything.
    let verifyOk = true
    for (const c of present) {
      const got = (await db.collection('users').doc(uid).collection(c).count().get()).data().count
      if (got < plan[c].length) {
        verifyOk = false
        console.log(`    ✖ verify ${c}: sub=${got} < expected ${plan[c].length} — NOT deleting root arrays`)
      }
    }
    if (!verifyOk) {
      console.log(`    ✖ aborting root cleanup for ${uid} (data preserved in root).`)
      continue
    }
    console.log(`    ✓ subcollections written + verified`)

    // 4. Remove the migrated arrays from the root doc (skip any field that had skipped elements).
    const del = {}
    for (const c of present) if (!skipped[c]) del[c] = FieldValue.delete()
    if (Object.keys(del).length) {
      await db.collection('users').doc(uid).update(del)
      console.log(`    ✓ root arrays removed: ${Object.keys(del).join(', ')}`)
    }
  }

  console.log(
    `\n${affected === 0 ? '✔ No legacy accounts with embedded arrays found.' : APPLY ? `✔ Migrated ${affected} account(s).` : `Found ${affected} account(s) to migrate. Re-run with --apply.`}`,
  )
  process.exit(0)
}
main().catch((e) => {
  console.error('migration failed:', e)
  process.exit(2)
})
