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
 * by the Firestore/Storage security rules.
 *
 * If the vars are absent (e.g. a fresh clone, or the Bolt preview without a
 * project wired up) `firebaseEnabled` is false and every service below is null.
 * The app then runs in local demo mode: seed data, no login screen. This is
 * what lets us merge the backend to `main` without breaking the preview.
 */

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId)

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
