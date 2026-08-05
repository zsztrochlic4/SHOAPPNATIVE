import { Platform } from 'react-native'
import type { FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'

/**
 * Client-side App Check scaffolding — abuse / attestation protection for the app's Firebase calls,
 * including the coach's Firebase AI Logic (Gemini) requests. Once initialised, the Firebase SDK
 * automatically attaches an App Check token to those calls; no per-call code is needed.
 *
 * Provider: reCAPTCHA ENTERPRISE (Hardening Plan v3 §9 — Firebase recommends Enterprise for new web
 * integrations; this replaced the earlier ReCaptchaV3Provider scaffold).
 *
 * IMPORTANT — this is CLIENT WIRING ONLY:
 *  - App Check ENFORCEMENT is turned on separately in the Firebase console (register strengthhub-web,
 *    create the reCAPTCHA Enterprise key, configure permitted production domains, then enable
 *    enforcement per service). Those console steps are ops tasks the owner still needs to do; see
 *    docs/security/HARDENING_RUNBOOK.md §9.
 *  - Until a reCAPTCHA Enterprise site key is supplied (EXPO_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY,
 *    or the legacy EXPO_PUBLIC_APPCHECK_RECAPTCHA_KEY) AND the console is configured, this is a safe
 *    no-op. It never throws and never blocks the app.
 *  - App Check does NOT gate the coach on. `COACH_ENABLED` remains the master switch (and is false);
 *    App Check sits alongside it as endpoint-abuse protection, not an availability gate.
 *  - reCAPTCHA is a WEB provider. Native (iOS/Android) attestation (App Attest / Play Integrity)
 *    needs the native App Check path in a dev build. That bridge is DRAFTED in ./appCheckNative
 *    (App Attest / Play Integrity → JS-SDK CustomProvider); it stays dormant until the owner
 *    installs @react-native-firebase/* and uncomments the two marked lines below. See
 *    docs/APP_CHECK.md §Native and src/lib/appCheckNative.ts for the full activation checklist.
 */

// NATIVE ACTIVATION (owner) — after `npx expo install @react-native-firebase/app
// @react-native-firebase/app-check`, uncomment the next line and the native branch in
// initAppCheck(). Kept commented so the JS-SDK-only build never tries to resolve the native module.
// import { initNativeAppCheck } from './appCheckNative'

const RECAPTCHA_SITE_KEY =
  process.env.EXPO_PUBLIC_APPCHECK_RECAPTCHA_ENTERPRISE_KEY ||
  process.env.EXPO_PUBLIC_APPCHECK_RECAPTCHA_KEY ||
  ''
/** Optional debug token for LOCAL DEVELOPMENT / STAGING ONLY (never set in production, plan §9). */
const DEBUG_TOKEN = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN || ''

let appCheck: AppCheck | null = null

/**
 * Initialise App Check once, right after the Firebase app. Safe no-op on native, or when no site
 * key is configured yet. Never throws — the console gate is authoritative, and App Check failing to
 * start must not break the app.
 */
export function initAppCheck(app: FirebaseApp): AppCheck | null {
  if (appCheck) return appCheck
  if (Platform.OS !== 'web') {
    // NATIVE ACTIVATION (owner): uncomment to bridge App Attest / Play Integrity into the JS SDK.
    // Requires @react-native-firebase/* installed + a dev/EAS build (see ./appCheckNative header).
    //   appCheck = initNativeAppCheck(app)
    //   return appCheck
    return null   // until activated: reCAPTCHA is web-only, native attestation is a dev-build step
  }
  if (!RECAPTCHA_SITE_KEY) return null       // no key yet → stay a no-op until the console + key are set
  try {
    if (DEBUG_TOKEN && typeof globalThis !== 'undefined') {
      ;(globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
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

export interface AppCheckStatus {
  platform: typeof Platform.OS
  /** A reCAPTCHA Enterprise site key is configured (web attestation possible). */
  siteKeyConfigured: boolean
  /** A debug token is set — DEV/STAGING only; must be empty in production. */
  debugToken: boolean
  /** App Check actually initialised on this client. */
  active: boolean
  /**
   * Whether this platform can attest with the CURRENT (JS SDK) wiring. Web can
   * (reCAPTCHA Enterprise). Native attestation (App Attest / Play Integrity)
   * needs the native module + a dev build — see docs/APP_CHECK.md — so it reports
   * false until that path ships.
   */
  attestableNow: boolean
}

/**
 * Diagnostic snapshot for the App Check rollout (audit SA-019). Lets a settings/
 * diagnostics view — and the owner during the monitor phase — confirm the client
 * is actually attesting before enforcement is switched on, without exposing keys.
 */
export function appCheckStatus(): AppCheckStatus {
  return {
    platform: Platform.OS,
    siteKeyConfigured: !!RECAPTCHA_SITE_KEY,
    debugToken: !!DEBUG_TOKEN,
    active: appCheck !== null,
    attestableNow: Platform.OS === 'web' && !!RECAPTCHA_SITE_KEY,
  }
}
