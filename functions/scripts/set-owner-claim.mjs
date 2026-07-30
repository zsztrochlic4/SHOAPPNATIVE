#!/usr/bin/env node
// Grant (or revoke) the app-owner custom claim used by the sendNotification
// callable (Phase D). Run once for the owner's account.
//
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   node functions/scripts/set-owner-claim.mjs --uid <UID>
//   node functions/scripts/set-owner-claim.mjs --email you@example.com
//   node functions/scripts/set-owner-claim.mjs --uid <UID> --revoke
//
// Uses firebase-admin from functions/node_modules (already installed). After
// granting, the user must re-authenticate (or refresh their ID token) before the
// claim is visible to the backend.

function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const PROJECT = arg('project', process.env.GCLOUD_PROJECT || 'strengthhub-2ab33')
const UID = arg('uid', '')
const EMAIL = arg('email', '')
const REVOKE = process.argv.includes('--revoke')

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getAuth } = await import('firebase-admin/auth')

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT })
const auth = getAuth(app)

let uid = UID
if (!uid && EMAIL) uid = (await auth.getUserByEmail(EMAIL)).uid
if (!uid) {
  console.error('Provide --uid <id> or --email <address>.')
  process.exit(2)
}

await auth.setCustomUserClaims(uid, REVOKE ? { owner: false } : { owner: true })
console.log(`${REVOKE ? 'Revoked' : 'Granted'} owner claim for ${uid} on ${PROJECT}.`)
console.log('The user must re-authenticate (or refresh their token) for it to take effect.')
process.exit(0)
