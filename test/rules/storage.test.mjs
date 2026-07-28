// Cloud Storage security-rules tests — run against the emulator via `npm run test:rules`.
// Covers: public exercise read, owner-only user media, image-only + 10MB cap.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { before, after, test } from 'node:test'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { ref, uploadBytes, getBytes } from 'firebase/storage'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const ALICE = 'alice'
const BOB = 'bob'
const PNG = { contentType: 'image/png' }

let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'strengthhub-rules-test',
    storage: { rules: readFileSync(join(repoRoot, 'storage.rules'), 'utf8') },
  })
})

after(async () => {
  await testEnv?.cleanup()
})

const aliceStore = () => testEnv.authenticatedContext(ALICE).storage()
const bobStore = () => testEnv.authenticatedContext(BOB).storage()

// User media is LOCKED until the upload feature ships (Hardening Plan v3 §5).
// The app has no upload path today, so even the owner is denied — no speculative
// recursive write surface. These flip to allow-with-validation only when the
// precise users/{uid}/progressPhotos/{photoId} rule is added.
test('owner cannot upload to user media (feature not shipped — path locked)', async () => {
  const r = ref(aliceStore(), `users/${ALICE}/photo.png`)
  await assertFails(uploadBytes(r, new Uint8Array([1, 2, 3]), PNG))
})

test('owner cannot read user media path while locked', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), `users/${ALICE}/seeded.png`), new Uint8Array([1]), PNG)
  })
  await assertFails(getBytes(ref(aliceStore(), `users/${ALICE}/seeded.png`)))
})

test('stranger cannot write another user media', async () => {
  const r = ref(bobStore(), `users/${ALICE}/hack.png`)
  await assertFails(uploadBytes(r, new Uint8Array([1, 2, 3]), PNG))
})

test('exercise library is world-readable but not client-writable', async () => {
  // Seed a public file with rules disabled, then read it as a stranger.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), 'exercises/squat.mp4'), new Uint8Array([9]), {
      contentType: 'video/mp4',
    })
  })
  await assertSucceeds(getBytes(ref(bobStore(), 'exercises/squat.mp4')))
  await assertFails(uploadBytes(ref(aliceStore(), 'exercises/hack.mp4'), new Uint8Array([1]), {
    contentType: 'video/mp4',
  }))
})
