import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'

// Public Firebase web config for strengthhub-2ab33. These values are NOT secrets
// (security is the `owner` custom claim + Firestore rules), so they ship as
// working defaults; override any via a .env (see .env.example). The bundled
// apiKey is the project key from google-services.json — if Google sign-in is
// ever rejected, paste the Web app's exact apiKey/appId from the Firebase
// console into .env.
const env = import.meta.env
const firebaseConfig = {
  apiKey: env.VITE_FB_API_KEY || 'AIzaSyBlef1hF_Wv7UP_rUjZ777y5sK77Rzq-7A',
  authDomain: env.VITE_FB_AUTH_DOMAIN || 'strengthhub-2ab33.firebaseapp.com',
  projectId: env.VITE_FB_PROJECT_ID || 'strengthhub-2ab33',
  storageBucket: env.VITE_FB_STORAGE_BUCKET || 'strengthhub-2ab33.firebasestorage.app',
  messagingSenderId: env.VITE_FB_MESSAGING_SENDER_ID || '739154408800',
  appId: env.VITE_FB_APP_ID || undefined,
}

// Must match functions/src/index.ts → setGlobalOptions({ region }).
export const FUNCTIONS_REGION = env.VITE_FB_REGION || 'australia-southeast2'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const functions = getFunctions(app, FUNCTIONS_REGION)
export const googleProvider = new GoogleAuthProvider()
