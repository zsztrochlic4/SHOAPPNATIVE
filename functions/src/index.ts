/**
 * StrengthHub Online — trusted backend (Cloud Functions v2).
 *
 * The App Check enforcement point and server-side home for AI, notifications and
 * account deletion. See docs/DEVELOPMENT_PLAN.md §2 / Phase B. This is a SCAFFOLD:
 * `ping` works; the feature callables enforce Auth + App Check but are stubs.
 */
import { setGlobalOptions } from 'firebase-functions/v2'

// Co-locate with Firestore (australia-southeast2) and cap fan-out to protect the
// budget while everything scales to zero.
setGlobalOptions({ region: 'australia-southeast2', maxInstances: 10 })

export { ping } from './ping'
export { analyzeMeal } from './meal'
export { coachMessage } from './coach'
export {
  getCoachWorkspace,
  grantCoachConsent,
  revokeCoachConsent,
  updateCoachPreferences,
  deleteCoachMemory,
  clearCoachMemories,
  respondToCoachProposal,
} from './coachProfile'
export { deleteAccount } from './account'
export { sendNotification } from './notifications'
export { createCheckoutSession, createBillingPortalSession, stripeWebhook } from './billing'
