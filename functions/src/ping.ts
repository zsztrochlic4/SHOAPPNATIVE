import { onCall } from 'firebase-functions/v2/https'

/**
 * Health check — verifies the backend is deployed and reachable, and echoes
 * whether the caller is authenticated. App Check is NOT enforced here so you can
 * smoke-test connectivity easily; every real feature callable enforces it.
 *
 * Call from the app with the Functions SDK: `httpsCallable(functions, 'ping')()`.
 */
export const ping = onCall({ enforceAppCheck: false }, (req) => {
  return {
    ok: true,
    at: new Date().toISOString(),
    uid: req.auth?.uid ?? null,
    appCheck: req.app ? 'present' : 'absent',
  }
})
