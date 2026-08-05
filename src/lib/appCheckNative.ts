// @ts-nocheck
/**
 * NATIVE App Check bridge (iOS App Attest / Android Play Integrity) — DRAFTED, UNTESTED.
 * =====================================================================================
 *
 * ⚠️  This file is NOT in the app's import graph yet, and it intentionally imports
 *     `@react-native-firebase/*`, which are NOT installed. `@ts-nocheck` + eslint-disable keep
 *     the repo green (tsc / lint / metro never touch an unimported, unchecked file). NOTHING
 *     here runs until the owner completes the activation steps below. It has never executed on a
 *     device — treat every line as a starting point to verify, not proven code.
 *
 * WHY A BRIDGE IS NEEDED
 * ----------------------
 * The app talks to Firebase through the **JS SDK** (`firebase/*`). The JS SDK only ships the web
 * reCAPTCHA App Check provider — it cannot do App Attest / Play Integrity. So on native we:
 *   1. Use `@react-native-firebase/app-check` (the NATIVE module) to attest the device and mint a
 *      real App Check token, then
 *   2. Feed that token into the **JS SDK** via a `CustomProvider`, so the JS SDK attaches it to its
 *      Firestore / Functions / AI-Logic calls (which is what the backend enforces).
 * Without step 2 the JS SDK's own calls would carry no token and be rejected once enforcement is on.
 *
 * OWNER ACTIVATION (all of these; see docs/APP_CHECK.md §Native for the console half)
 * ----------------------------------------------------------------------------------
 *   A. Register the **iOS** and **Android** apps in the Firebase project (only a WEB app exists
 *      today) and download `GoogleService-Info.plist` (iOS) + `google-services.json` (Android).
 *   B. Firebase console → App Check → register iOS with **App Attest** (needs the paid Apple
 *      Developer account) and Android with **Play Integrity**.
 *   C. `npx expo install @react-native-firebase/app @react-native-firebase/app-check`
 *      (app.config.js already auto-appends their config plugins once installed — see that file).
 *   D. Put the two native config files in the project and point app.json/app.config at them
 *      (`ios.googleServicesFile`, `android.googleServicesFile`).
 *   E. In `src/lib/appCheck.ts`, UNCOMMENT the two `./appCheckNative` lines (the import and the
 *      native branch inside `initAppCheck`). That is the only code edit needed to go live.
 *   F. Build a **dev/EAS build** (App Attest / Play Integrity do NOT work in Expo Go), install on a
 *      real device, and confirm `appCheckStatus().active === true` and that Functions logs stop
 *      showing `appcheck.missing` for that client. THEN follow the monitor → enforce steps.
 *
 * DEV vs PROD providers: in `__DEV__` we use the **debug** provider (register the printed debug
 * token in the console, DEV/STAGING ONLY — never ship a debug token). Release builds use App Attest
 * (Apple) / Play Integrity (Google).
 */

import { firebase } from '@react-native-firebase/app-check'
import { CustomProvider } from 'firebase/app-check'
import type { FirebaseApp } from 'firebase/app'
import type { AppCheck } from 'firebase/app-check'
import { initializeAppCheck } from 'firebase/app-check'

/** DEV/STAGING debug token (optional). Register it in the console; must be empty in production. */
const DEBUG_TOKEN = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN || ''

let nativeReady = false

/**
 * Initialise the NATIVE App Check module once. Idempotent; swallows errors so a failed attestation
 * setup can never crash startup (the backend enforcement gate is authoritative, not this).
 */
async function ensureNativeAppCheck(): Promise<boolean> {
  if (nativeReady) return true
  try {
    const provider = firebase.appCheck().newReactNativeFirebaseAppCheckProvider()
    provider.configure({
      android: { provider: __DEV__ ? 'debug' : 'playIntegrity', debugToken: DEBUG_TOKEN || undefined },
      apple: { provider: __DEV__ ? 'debug' : 'appAttest', debugToken: DEBUG_TOKEN || undefined },
    })
    await firebase.appCheck().initializeAppCheck({ provider, isTokenAutoRefreshEnabled: true })
    nativeReady = true
    return true
  } catch {
    return false
  }
}

/** Decode a JWT's `exp` (seconds) → epoch millis. Falls back to now+30min if it can't be read. */
function tokenExpiryMillis(jwt: string): number {
  try {
    const payload = jwt.split('.')[1]
    const json = JSON.parse(globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof json.exp === 'number') return json.exp * 1000
  } catch {
    /* fall through */
  }
  return Date.now() + 30 * 60 * 1000
}

/**
 * Initialise JS-SDK App Check on native by bridging to the native attestation module. Returns the
 * JS `AppCheck` instance (so the JS SDK attaches native-attested tokens to its calls), or null if
 * the native module isn't available / init failed — in which case the app runs as a safe no-op.
 */
export function initNativeAppCheck(app: FirebaseApp): AppCheck | null {
  try {
    // Kick off native init in the background; the CustomProvider awaits readiness per-token.
    void ensureNativeAppCheck()
    const provider = new CustomProvider({
      getToken: async () => {
        const ok = await ensureNativeAppCheck()
        if (!ok) throw new Error('native App Check unavailable')
        const { token } = await firebase.appCheck().getToken(/* forceRefresh */ false)
        return { token, expireTimeMillis: tokenExpiryMillis(token) }
      },
    })
    return initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true })
  } catch {
    return null
  }
}
