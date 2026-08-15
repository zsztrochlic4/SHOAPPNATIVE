import { Platform } from 'react-native'
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  connectAuthEmulator,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  // @ts-expect-error — getReactNativePersistence is exported at runtime but
  // missing from the web-typed surface of firebase/auth.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth'
import { getFirestore, initializeFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { initAppCheck } from './appCheck'
import { startCoachKillSwitch } from './coachKillSwitch'

/**
 * Firebase web config. These values are NOT secrets — access is governed by
 * the Firestore/Storage security rules, and every Firebase web app ships its
 * config publicly by design.
 *
 * The project's own config is baked in as the default so a plain clone works
 * with zero env setup. `EXPO_PUBLIC_FIREBASE_*` env vars still take priority
 * when set, which is how you'd point a build at a different Firebase project.
 */

/**
 * Only trust an env-provided key if it's a validly-formed Google API key.
 * This guards against two real failure modes we hit: the project's original
 * auto-created "Browser key" (rejected by Identity Toolkit with
 * API_KEY_INVALID, silently breaking all sign-in) and a corrupted paste where
 * masked bullet characters (AIzaSyCm••••…) ended up inside .env.
 */
const BROKEN_KEY = 'AIzaSyAWbsun4fLVFHl0V67WiNwiFocI9EFV8_0'
const rawEnvKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY
const envApiKey =
  rawEnvKey && rawEnvKey !== BROKEN_KEY && /^AIza[0-9A-Za-z_-]{35}$/.test(rawEnvKey) ? rawEnvKey : ''

const config = {
  apiKey: envApiKey || 'AIzaSyCmPtpRiV61NDW9z4us38JLdh3WK1WxPvQ',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'strengthhub-2ab33.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'strengthhub-2ab33',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'strengthhub-2ab33.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '739154408800',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:739154408800:web:f8941b454d550c3eed9a05',
}

/**
 * Local demo mode: set `EXPO_PUBLIC_DEMO_MODE=1` (e.g. in `.env.local`) to run
 * the app entirely on the built-in seed with no sign-in wall and no cloud sync —
 * handy for previewing screens with demo data. Never set in production.
 */
const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === '1'

export const firebaseEnabled = !demoMode && Boolean(config.apiKey && config.projectId && config.appId)

/** Last 6 chars of the API key actually in use (temp diagnostic aid). */
export const apiKeySuffix = config.apiKey.slice(-6)

/** Storage bucket id (e.g. `project.firebasestorage.app`), for building public media URLs. */
export const storageBucket = config.storageBucket

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null
let functions: Functions | null = null

if (firebaseEnabled) {
  app = initializeApp(config as Required<typeof config>)

  // App Check (abuse/attestation protection) — client scaffolding; a safe no-op until a
  // reCAPTCHA site key is set AND App Check is enabled in the Firebase console (ops step).
  void initAppCheck(app)

  // Native needs AsyncStorage-backed persistence so a login survives app restarts;
  // on web getAuth() uses durable IndexedDB/localStorage by default (verified: the
  // `firebaseLocalStorageDb` store is created), and it is idempotent — important
  // because the firebase↔coachClassifier require cycle can re-enter this module,
  // and initializeAuth() would throw `auth/already-initialized` on the second pass.
  if (Platform.OS === 'web') {
    auth = getAuth(app)
  } else {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  }

  db = Platform.OS === 'web'
    ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
    : getFirestore(app)
  // Coach kill-switch source (spec §20). Dormant while COACH_ENABLED is false — no listener.
  startCoachKillSwitch(db)
  // LLM safety-classifier transport (Gemini via AI Logic). Registered only; it fires solely when a
  // live coach surface runs the async precheck, which stays gated off while COACH_ENABLED is false.
  // Imported LAZILY: coachClassifier itself imports `app` from this module, and a static import
  // created a firebase ↔ coachClassifier require cycle (audit F-036) that surfaced as a Metro
  // console warning and risks undefined bindings at init order changes.
  void import('./coachClassifier').then((m) => m.initCoachClassifier()).catch(() => {})
  storage = getStorage(app)
  // Trusted backend (Cloud Functions v2) — co-located with Firestore. Hosts the
  // server-side meal analysis (and, later, coach / notifications / deletion).
  functions = getFunctions(app, 'australia-southeast2')

  // LOCAL-ONLY: point the SDK at the Firebase emulator suite for on-device coach
  // testing (EXPO_PUBLIC_USE_EMULATORS=1). Never set in a shipping build — it only
  // rewires localhost transports and changes nothing about production behaviour.
  if (process.env.EXPO_PUBLIC_USE_EMULATORS === '1' && auth && db && functions) {
    const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || 'localhost'
    try { connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true }) } catch {}
    try { connectFirestoreEmulator(db, host, 8080) } catch {}
    try { connectFunctionsEmulator(functions, host, 5001) } catch {}
    // Auto-sign-in a FIXED dev user so the coach backend is reachable AND the identity
    // is stable across emulator restarts (localStorage onboarding + the Firestore seed
    // stay valid every run). The auth emulator accepts an unsigned custom token and
    // takes the uid verbatim; fall back to anonymous if that ever fails.
    const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const devEmulatorToken = (uid: string): string => {
      const now = Math.floor(Date.now() / 1000)
      const sa = `firebase-adminsdk@${config.projectId}.iam.gserviceaccount.com`
      return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
        iss: sa, sub: sa, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
        iat: now, exp: now + 3600, uid,
      })}.`
    }
    const authRef = auth
    onAuthStateChanged(authRef, (u) => {
      if (u) return
      void signInWithCustomToken(authRef, devEmulatorToken('coach-demo-user')).catch(() => signInAnonymously(authRef).catch(() => {}))
    })
  }
}

export { app, auth, db, storage, functions }
