#!/usr/bin/env node
// Read-only production schema audit (Hardening Plan v3 §11 step "read-only
// production schema audit"). Scans every users/{uid} document and its
// subcollections for anything the HARDENED rules (firestore.rules) would REJECT,
// so you can migrate offenders BEFORE deploying — otherwise those users' saves
// start failing silently.
//
// This script NEVER writes. It only reads and reports.
//
// Usage:
//   # auth with a service account that can read Firestore:
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   npm run audit:schema                      # audits the default project
//   node scripts/audit-production-schema.mjs --project strengthhub-2ab33 --limit 0
//
// Options:
//   --project <id>   Firebase project id (default: strengthhub-2ab33 / GCLOUD_PROJECT)
//   --limit <n>      Max users to scan (0 = all; default 0)
//   --json <path>    Also write the full findings to a JSON file
//
// Requires firebase-admin (install once, not committed):
//   npm install --no-save firebase-admin
//
// Exit code: 0 = clean, 1 = violations found, 2 = setup error.

import { readFileSync } from 'node:fs'
import { writeFileSync } from 'node:fs'

/* ----------------------------- schema contract ---------------------------- */
// Mirrors firestore.rules + docs/security/DATA_SCHEMA.md. Keep in sync.

const ROOT_ALLOWED_KEYS = new Set([
  'profile', 'settings', 'mealPlan', 'postComments', 'nutritionTags', 'foods',
  'program', 'posts', 'leaderboard', 'challenges', 'badges', 'events', 'groups',
  'partners', 'myMeals', 'templates', 'workoutStartedKeys', 'nutritionAskedKeys',
  'beginnerProgress', 'coachUsage', 'integrations', 'plannedPeriods',
  'backendUser', 'generatedProgram', 'workoutInstances', 'programStatus',
  'demo', 'v', 'updatedAt',
])

const FORBIDDEN_TOKEN_KEYS = new Set(['accessToken', 'refreshToken', 'expiresAt'])
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const PLATFORMS = new Set(['ios', 'android', 'web', 'windows', 'macos'])

const SUBCOLLECTIONS = [
  'sessions', 'weights', 'habits', 'meals', 'activities', 'foodReviews', 'chat',
  'coachThread', 'notifications', 'programs', 'workout_instances', 'set_logs',
  'progression_state', 'pushTokens',
]

const strlen = (v) => (typeof v === 'string' ? [...v].length : 0)

/* --------------------------------- args ----------------------------------- */

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const PROJECT = arg('project', process.env.GCLOUD_PROJECT || 'strengthhub-2ab33')
const LIMIT = Number(arg('limit', '0'))
const JSON_OUT = arg('json', '')

/* --------------------------------- checks --------------------------------- */

const findings = []
const add = (uid, path, rule, detail) => findings.push({ uid, path, rule, detail })

/** Recursively search an object for forbidden token keys with a real value. */
function scanForTokens(uid, path, obj) {
  if (!obj || typeof obj !== 'object') return
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_TOKEN_KEYS.has(k) && v != null && v !== '') {
      add(uid, path, 'plaintext-token', `field "${k}" present (§6)`)
    }
    if (v && typeof v === 'object') scanForTokens(uid, `${path}.${k}`, v)
  }
}

function auditRoot(uid, data) {
  // top-level allowlist
  for (const k of Object.keys(data)) {
    if (!ROOT_ALLOWED_KEYS.has(k)) add(uid, `users/${uid}`, 'unknown-root-field', `"${k}"`)
    if (FORBIDDEN_TOKEN_KEYS.has(k)) add(uid, `users/${uid}`, 'plaintext-token', `top-level "${k}"`)
  }
  // free-text caps
  const p = data.profile || {}
  if (strlen(p.motivation) > 2000) add(uid, `users/${uid}`, 'oversize', `profile.motivation ${strlen(p.motivation)}>2000`)
  if (strlen(p.injuries) > 2000) add(uid, `users/${uid}`, 'oversize', `profile.injuries ${strlen(p.injuries)}>2000`)
  if (strlen(p.name) > 200) add(uid, `users/${uid}`, 'oversize', `profile.name ${strlen(p.name)}>200`)
  const b = data.backendUser || {}
  if (strlen(b.notes) > 4000) add(uid, `users/${uid}`, 'oversize', `backendUser.notes ${strlen(b.notes)}>4000`)
  if (strlen(b.motivation) > 2000) add(uid, `users/${uid}`, 'oversize', `backendUser.motivation ${strlen(b.motivation)}>2000`)
  // nested tokens (integrations etc.)
  scanForTokens(uid, `users/${uid}`, data)
  // premium sanity (should be false/absent for a client doc)
  if (p.premium === true) add(uid, `users/${uid}`, 'premium-true', 'profile.premium is true (should be Zone B entitlement)')
}

function auditEntry(uid, col, id, d) {
  const path = `users/${uid}/${col}/${id}`
  const idFields = { sessions: 'id', meals: 'id', activities: 'id', chat: 'id', coachThread: 'id', notifications: 'id' }
  const dateCols = new Set(['weights', 'habits', 'foodReviews'])

  if (idFields[col] && d[idFields[col]] !== id) add(uid, path, 'id-mismatch', `${idFields[col]}="${d[idFields[col]]}" != docId`)
  if (dateCols.has(col)) {
    if (d.dateKey !== id) add(uid, path, 'id-mismatch', `dateKey="${d.dateKey}" != docId`)
    if (!DATE_KEY.test(id)) add(uid, path, 'bad-datekey', `docId "${id}" not YYYY-MM-DD`)
  }
  if (['programs', 'workout_instances', 'set_logs', 'progression_state'].includes(col) && d.uid !== uid) {
    add(uid, path, 'uid-mismatch', `uid="${d.uid}" != path`)
  }
  if (col === 'programs' && d.program_id !== id) add(uid, path, 'id-mismatch', `program_id != docId`)
  if (col === 'workout_instances' && d.instance_id !== id) add(uid, path, 'id-mismatch', `instance_id != docId`)
  if (col === 'set_logs' && d.log_id !== id) add(uid, path, 'id-mismatch', `log_id != docId`)
  if (col === 'progression_state' && id !== `${uid}_${d.exercise_id}`) add(uid, path, 'id-mismatch', `docId != uid_exerciseId`)
  if (col === 'pushTokens') {
    if (d.token !== id) add(uid, path, 'id-mismatch', `token != docId`)
    if (!PLATFORMS.has(d.platform)) add(uid, path, 'bad-enum', `platform="${d.platform}"`)
  }
  // text caps
  const caps = { chat: ['text', 8000], coachThread: ['body', 8000], foodReviews: ['text', 4000], notifications: ['body', 1000], activities: ['note', 1000] }
  if (caps[col]) {
    const [f, max] = caps[col]
    if (strlen(d[f]) > max) add(uid, path, 'oversize', `${f} ${strlen(d[f])}>${max}`)
  }
  scanForTokens(uid, path, d)
  if (Object.keys(d).length >= 100) add(uid, path, 'too-many-keys', `${Object.keys(d).length} keys >= 100`)
}

/* --------------------------------- main ----------------------------------- */

async function main() {
  let admin
  try {
    admin = await import('firebase-admin')
  } catch {
    console.error('✖ firebase-admin not installed. Run:  npm install --no-save firebase-admin')
    process.exit(2)
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_CONFIG) {
    console.error('✖ No credentials. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON that can read Firestore.')
    process.exit(2)
  }

  const app = admin.default.initializeApp({ projectId: PROJECT })
  const db = admin.default.firestore(app)
  console.log(`▶ Auditing project "${PROJECT}" (read-only)…`)

  let usersQuery = db.collection('users')
  const usersSnap = await (LIMIT > 0 ? usersQuery.limit(LIMIT) : usersQuery).get()
  console.log(`  ${usersSnap.size} user docs`)

  let scanned = 0
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id
    auditRoot(uid, userDoc.data() || {})
    for (const col of SUBCOLLECTIONS) {
      const sub = await db.collection('users').doc(uid).collection(col).get()
      for (const d of sub.docs) auditEntry(uid, col, d.id, d.data() || {})
    }
    if (++scanned % 25 === 0) console.log(`  …${scanned}/${usersSnap.size} users scanned`)
  }

  // report
  const byRule = {}
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1
  console.log('\n──────── AUDIT RESULT ────────')
  console.log(`users scanned: ${usersSnap.size}`)
  console.log(`violations:    ${findings.length}`)
  for (const [rule, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) console.log(`  ${rule.padEnd(20)} ${n}`)
  if (findings.length) {
    console.log('\nfirst 20:')
    for (const f of findings.slice(0, 20)) console.log(`  [${f.rule}] ${f.path} — ${f.detail}`)
  }
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({ project: PROJECT, scanned: usersSnap.size, findings }, null, 2))
    console.log(`\nfull findings → ${JSON_OUT}`)
  }
  console.log(findings.length ? '\n✖ NOT clean — migrate the above before deploying hardened rules.' : '\n✔ Clean — safe to deploy the hardened rules.')
  process.exit(findings.length ? 1 : 0)
}

main().catch((e) => { console.error('audit failed:', e); process.exit(2) })
