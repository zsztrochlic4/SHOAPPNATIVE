// @ts-nocheck
/**
 * NATIVE App Check bridge (iOS App Attest / Android Play Integrity) — ACTIVATED, UNTESTED ON DEVICE.
 * =================================================================================================
 * Metro loads THIS file only on native (`.native.ts`); web loads the no-op `appCheckNative.ts`
 * instead, so `@react-native-firebase/*` is never pulled into the web bundle. `@ts-nocheck` keeps the
 * RNFirebase ↔ JS-SDK glue out of tsc's way. It has NOT run on a device yet — verify with an EAS dev
 * build (docs/APP_CHECK.md §Native, Phase 4): confirm `appCheckStatus().active === true` and that
 * Functions logs stop showing `appcheck.missing`.
 *
 * WHY A BRIDGE: the app uses the Firebase **JS SDK** (`firebase/*`), which only ships the web
 * reCAPTCHA App Check provider. So on native we mint a real token with `@react-native-firebase/
 * app-check` (App Attest / Play Integrity) and feed it into the JS SDK via a `CustomProvider`, so the
 * SDK attaches it to its Firestore / Functions / AI-Logic calls (what the backend enforces).
 *
 * DEV vs PROD: in `__DEV__` this uses the **debug** provider — register the printed debug token in the
 * console (App Check → Manage debug tokens), DEV/STAGING ONLY, never ship it. Release builds use App
 * Attest (Apple) / Play Integrity (Google).
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
