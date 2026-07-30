#!/usr/bin/env node
// Owner CLI to send a push notification (Phase D MVP entry point — the in-app
// admin portal is deferred). DRY RUN by default; pass --send to actually deliver.
//
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//   npm --prefix functions run build            # compile the sender first
//   node functions/scripts/send.mjs --uid <UID> --title "Hi" --body "..."          # dry run
//   node functions/scripts/send.mjs --all --title "Update" --body "..." --send      # broadcast, real
//
// Options:
//   --uid <id> | --all         target one user, or everyone (paginated)
//   --title <t> --body <b>      required
//   --deepLink <url>           optional payload
//   --category general|workout|streak   (default general; category opt-outs apply to workout/streak)
//   --override                 deliver even inside a device's quiet hours
//   --send                     COMMIT the send (omit for a dry-run preview)
//
// Runs as the Admin SDK (service-account key), so it needs no owner claim/App
// Check. Uses functions/node_modules — the same firebase-admin the sender uses.

function arg(n, d) {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const PROJECT = arg('project', process.env.GCLOUD_PROJECT || 'strengthhub-2ab33')
const UID = arg('uid', '')
const ALL = process.argv.includes('--all')
const TITLE = arg('title', '')
const BODY = arg('body', '')
const DEEPLINK = arg('deepLink', '')
const CATEGORY = arg('category', 'general')
const OVERRIDE = process.argv.includes('--override')
const SEND = process.argv.includes('--send')

if ((!UID && !ALL) || !TITLE || !BODY) {
  console.error('Usage: (--uid <id> | --all) --title <t> --body <b> [--deepLink <url>] [--category ...] [--override] [--send]')
  process.exit(2)
}

let sendToAudience
try {
  ;({ sendToAudience } = await import('../lib/lib/send.js'))
} catch {
  console.error('Sender not built. Run: npm --prefix functions run build')
  process.exit(2)
}
const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getFirestore } = await import('firebase-admin/firestore')
const { randomUUID } = await import('node:crypto')

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT })
const db = getFirestore(app)

const res = await sendToAudience(
  { db, fetchFn: fetch, now: new Date() },
  {
    audience: ALL ? { all: true } : { uid: UID },
    title: TITLE,
    body: BODY,
    data: DEEPLINK ? { deepLink: DEEPLINK } : undefined,
    category: CATEGORY,
    override: OVERRIDE,
    dryRun: !SEND,
    sendId: randomUUID(),
  },
)

console.log(SEND ? '✅ SENT' : '🔍 DRY RUN (add --send to deliver)')
console.log(JSON.stringify(res, null, 2))
process.exit(0)
