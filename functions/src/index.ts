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
  recordCoachActionOutcome,
} from './coachProfile'
export { deleteAccount, resumeAccountDeletions } from './account'
export { reconcileCoachActions } from './coachReconciler'
export { reportClientError, monitorSlo } from './observability'
export { sendNotification, dedupePushToken } from './notifications'
export { createCheckoutSession, createBillingPortalSession, stripeWebhook } from './billing'
// Community competition hub (leagues + forgiving streaks). Client is feature-
// flagged OFF until these are emulator-tested and deployed.
export { claimUsername, syncCommunityStats, rolloverLeagues, grantStreakFreezes, reprocessStandings } from './community'
// Private friend groups (create / join / leave / delete / goal / cheer). Also
// feature-flagged OFF client-side.
export { createGroup, joinGroupByPasscode, leaveGroup, deleteGroup, setGroupGoal, cheerGroupActivity } from './communityGroups'
