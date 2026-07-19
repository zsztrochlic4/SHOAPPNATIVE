import { Platform } from 'react-native'
import type { FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check'

/**
 * Client-side App Check scaffolding — abuse / attestation protection for the app's Firebase calls,
 * including the coach's Firebase AI Logic (Gemini) requests. Once initialised, the Firebase SDK
 * automatically attaches an App Check token to those calls; no per-call code is needed.
 *
 * IMPORTANT — this is CLIENT WIRING ONLY:
 *  - App Check ENFORCEMENT is turned on separately in the Firebase console (register the app, pick
 *    a provider). That console step is an ops task the owner still needs to do.
 *  - Until a reCAPTCHA site key is supplied (EXPO_PUBLIC_APPCHECK_RECAPTCHA_KEY) AND the console is
 *    configured, this is a safe no-op. It never throws and never blocks the app.
 *  - App Check does NOT gate the coach on. `COACH_ENABLED` remains the master switch (and is false);
 *    App Check sits alongside it as endpoint-abuse protection, not an availability gate.
 *  - reCAPTCHA is a WEB provider. Native (iOS/Android) attestation (App Attest / Play Integrity)
 *    needs the native App Check path in a dev build — a separate follow-up (see coach/safety/STATUS.md).
 */

const RECAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_APPCHECK_RECAPTCHA_KEY || ''
/** Optional debug token for local web development (never set in production). */
const DEBUG_TOKEN = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN || ''

let appCheck: AppCheck | null = null

/**
 * Initialise App Check once, right after the Firebase app. Safe no-op on native, or when no site
 * key is configured yet. Never throws — the console gate is authoritative, and App Check failing to
 * start must not break the app.
 */
export function initAppCheck(app: FirebaseApp): AppCheck | null {
  if (appCheck) return appCheck
  if (Platform.OS !== 'web') return null   // reCAPTCHA is web-only; native attestation is a dev-build step
  if (!RECAPTCHA_SITE_KEY) return null       // no key yet → stay a no-op until the console + key are set
  try {
    if (DEBUG_TOKEN && typeof globalThis !== 'undefined') {
      ;(globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
    return appCheck
  } catch {
    return null
  }
}

/** True once App Check has actually initialised on this client (web + key + console). */
export function appCheckReady(): boolean {
  return appCheck !== null
}
