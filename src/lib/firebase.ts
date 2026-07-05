import { Platform } from 'react-native'
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error — getReactNativePersistence is exported at runtime but
  // missing from the web-typed surface of firebase/auth.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Firebase is configured entirely from `EXPO_PUBLIC_FIREBASE_*` env vars (see
 * .env.example). These web config values are NOT secrets — access is governed
 * by the Firestore/Storage security rules — so it's safe to ship them.
 *
 * If the vars are absent (e.g. a fresh clone, or the Bolt preview without a
 * project wired up) `firebaseEnabled` is false and every service below is null.
 * The app then runs exactly as it does today: local demo data, no login. This
 * is what lets us merge the backend to `main` without breaking the preview.
 *
 * The values below are the project's PUBLIC web config — not secrets. They ship
 * inside any built client anyway, and access is enforced by the Firestore rules,
 * so committing them is safe and lets the preview (Bolt/main) work with no env
 * setup. Env vars still override them, so a fork can point at its own project.
 * (Future hardening: enable Firebase App Check to curb signup/quota abuse.)
 */
const PUBLIC_CONFIG = {
  apiKey: 'AIzaSyAWbsun4flVFHl0V67WiNwiFocI9EFV8_0',
  authDomain: 'strengthhub-2ab33.firebaseapp.com',
  projectId: 'strengthhub-2ab33',
  storageBucket: 'strengthhub-2ab33.firebasestorage.app',
  messagingSenderId: '739154408800',
  appId: '1:739154408800:web:f8941b454d550c3eed9a05',
}

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? PUBLIC_CONFIG.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? PUBLIC_CONFIG.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? PUBLIC_CONFIG.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? PUBLIC_CONFIG.storageBucket,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? PUBLIC_CONFIG.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? PUBLIC_CONFIG.appId,
}

export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null

if (firebaseEnabled) {
  app = initializeApp(config as Required<typeof config>)

  // Native needs AsyncStorage-backed persistence so a login survives app
  // restarts; on web the SDK uses IndexedDB/local storage by default.
  if (Platform.OS === 'web') {
    auth = getAuth(app)
  } else {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  }

  db = getFirestore(app)
  storage = getStorage(app)
}

export { app, auth, db, storage }
