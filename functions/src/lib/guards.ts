import { getApps, initializeApp } from 'firebase-admin/app'
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'

// Initialise the Admin SDK exactly once (functions may share a warm instance).
if (getApps().length === 0) initializeApp()

/**
 * Single switch for App Check enforcement across every callable (Blocker #4 /
 * Option B, audit F-006 / SA-019). Kept OFF by default until the app is
 * attesting: turning it on before the client sends App Check tokens would reject
 * the live app's own calls (e.g. the meal scan). Rollout is monitor-then-enforce
 * — see docs/APP_CHECK.md:
 *   1. ship `auditAppCheck` (this file) and watch the logs until essentially all
 *      real traffic carries a token,
 *   2. enable enforcement and redeploy.
 *
 * Enforcement is now CONFIG-DRIVEN rather than a hardcoded edit (audit SA-019):
 * set the function env var `APPCHECK_ENFORCE=1` (Firebase config / `.env` /
 * `firebase functions:secrets`/params) and redeploy to flip monitor → enforce
 * per environment, with no code change and an easy rollback. Defaults to OFF.
 */
export const APP_CHECK_ENFORCED = process.env.APPCHECK_ENFORCE === '1'

/**
 * Soft App Check observability, safe to run while enforcement is OFF. When a call
 * arrives WITHOUT a verified App Check token it logs a structured warning (so the
 * owner can confirm real clients attest before flipping `APP_CHECK_ENFORCED`), but
 * it never rejects. Returns whether a token was present. Once enforcement is on,
 * `enforceAppCheck` rejects untokened calls before the handler and this becomes a
 * quiet confirmation.
 */
export function auditAppCheck(req: CallableRequest, label: string): boolean {
  const present = !!req.app
  if (!present) logger.warn('appcheck.missing', { fn: label, enforced: APP_CHECK_ENFORCED })
  return present
}

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

/**
 * Convenience: auth + App Check in one call, honouring the rollout mode.
 * Returns the caller's uid.
 *
 * MONITOR mode (`APP_CHECK_ENFORCED === false`, the current state): a missing
 * App Check token is logged (`auditAppCheck`) but never rejected — the native
 * app cannot attest yet (no App Attest / Play Integrity in the client), so
 * hard-requiring `req.app` here would break every iOS/Android call while the
 * function option `enforceAppCheck: APP_CHECK_ENFORCED` claims monitor mode
 * (audit F-006). ENFORCED mode: the token is required outright, matching the
 * `enforceAppCheck: true` option that rejects before the handler anyway.
 */
export function requireVerifiedUser(req: CallableRequest, label = 'callable'): string {
  if (APP_CHECK_ENFORCED) requireAppCheck(req)
  else auditAppCheck(req, label)
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
