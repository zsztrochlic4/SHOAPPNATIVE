/**
 * NATIVE App Check bridge — WEB / DEFAULT no-op.
 *
 * The real bridge (App Attest / Play Integrity via `@react-native-firebase/*`) lives in
 * `appCheckNative.native.ts`, which Metro loads only on native. On web there is no App Attest /
 * Play Integrity — the JS SDK's reCAPTCHA path is used instead (see `appCheck.ts`) — so this
 * default resolves for the web bundle and returns null, keeping the native module out of it.
 */
import type { FirebaseApp } from 'firebase/app'
import type { AppCheck } from 'firebase/app-check'

export function initNativeAppCheck(_app: FirebaseApp): AppCheck | null {
  return null
}
