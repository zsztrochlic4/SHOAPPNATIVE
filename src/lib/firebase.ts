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
 * Firebase web config. These values are NOT secrets — access is governed by
 * the Firestore/Storage security rules, and every Firebase web app ships its
 * config publicly by design.
 *
 * The project's own config is baked in as the default so a plain clone works
 * with zero env setup. `EXPO_PUBLIC_FIREBASE_*` env vars still take priority
 * when set, which is how you'd point a build at a different Firebase project.
 */

/**
 * The project's original auto-created "Browser key" is rejected by the
 * Identity Toolkit API (API_KEY_INVALID) even though it works for Firestore,
 * which silently breaks all sign-in. Env vars beat .env files in Expo, so a
 * stale shell/system variable can keep injecting it — refuse it outright.
 */
const BROKEN_KEY = 'AIzaSyAWbsun4fLVFHl0V67WiNwiFocI9EFV8_0'
const envApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY

const config = {
  apiKey: (envApiKey && envApiKey !== BROKEN_KEY ? envApiKey : '') || 'AIzaSyCmPtpRiV61NDW9z4us38JLdh3WK1WxPvQ',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'strengthhub-2ab33.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'strengthhub-2ab33',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'strengthhub-2ab33.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '739154408800',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:739154408800:web:f8941b454d550c3eed9a05',
}

export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId)

/** Last 6 chars of the API key actually in use (temp diagnostic aid). */
export const apiKeySuffix = config.apiKey.slice(-6)

/** Storage bucket id (e.g. `project.firebasestorage.app`), for building public media URLs. */
export const storageBucket = config.storageBucket

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
