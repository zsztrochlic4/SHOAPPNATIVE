/**
 * Review coach feedback (dev). Lists 'not_helpful' end-of-chat ratings with the surrounding coach turns,
 * so each real miss can be turned into a case in functions/test/coach-evals.test.mjs, which closes the
 * accuracy loop: real mistake -> eval case -> deterministic fix -> permanent regression guard.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=strengthhub-2ab33 \
 *     node functions/scripts/review-coach-feedback.mjs [uid]
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run without FIRESTORE_EMULATOR_HOST (this is a local dev tool).')
  process.exit(1)
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'strengthhub-2ab33' })
const db = getFirestore()
const onlyUid = process.argv[2] || null

const users = onlyUid ? [onlyUid] : (await db.collection('coachUsers').listDocuments()).map((d) => d.id)
let count = 0
for (const uid of users) {
  const fb = await db.collection('coachUsers').doc(uid).collection('feedback').where('rating', '==', 'not_helpful').get()
  if (fb.empty) continue
  for (const doc of fb.docs) {
    count++
    const at = doc.get('createdAt')
    const when = at?.toDate?.().toISOString?.() ?? String(at ?? '')
    console.log(`\n--- not_helpful  uid=${uid}  at=${when}  reason=${doc.get('reason') ?? ''}`)
    // End-of-chat rating: the most recent turns are the exchange the user rated.
    const turns = await db.collection('coachUsers').doc(uid).collection('turns').orderBy('createdAt', 'desc').limit(6).get()
    for (const t of turns.docs.reverse()) console.log(`   [${t.get('role')}] ${String(t.get('text') ?? '').slice(0, 160)}`)
  }
}
console.log(`\n${count} not_helpful rating(s). Turn each real miss into a case in functions/test/coach-evals.test.mjs.`)
