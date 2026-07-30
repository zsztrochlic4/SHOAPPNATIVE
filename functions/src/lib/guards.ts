import { getApps, initializeApp } from 'firebase-admin/app'
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'

// Initialise the Admin SDK exactly once (functions may share a warm instance).
if (getApps().length === 0) initializeApp()

/**
 * Require a signed-in Firebase user. Returns their uid, or throws so the client
 * gets a clean `unauthenticated` error. Use at the top of every callable that
 * touches user data.
 */
export function requireAuth(req: CallableRequest): string {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.')
  return uid
}

/**
 * Require a verified App Check token. Callables should ALSO set
 * `{ enforceAppCheck: true }` (which rejects before the handler runs); this is a
 * belt-and-suspenders check and the enforcement point for Blocker #4 / Option B —
 * "only our attested app may call the backend". See docs/DEVELOPMENT_PLAN.md §2.
 */
export function requireAppCheck(req: CallableRequest): void {
  if (!req.app) {
    throw new HttpsError('failed-precondition', 'App Check verification is required.')
  }
}

/** Convenience: assert App Check + auth in one call. Returns the caller's uid. */
export function requireVerifiedUser(req: CallableRequest): string {
  requireAppCheck(req)
  return requireAuth(req)
}

/**
 * Require the caller to be the app owner — a Firebase custom claim `owner: true`
 * (set once via scripts/set-owner-claim.mjs). Gates owner-only operations such as
 * the notification sender. Returns the owner's uid.
 */
export function requireOwner(req: CallableRequest): string {
  const uid = requireAuth(req)
  if (req.auth?.token?.owner !== true) {
    throw new HttpsError('permission-denied', 'This operation is restricted to the app owner.')
  }
  return uid
}
