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
//
// maxInstances is 3 (was 10) because the project's Cloud Run "Total CPU allocation
// per region" quota (australia-southeast2) is capped and Google won't self-serve
// raise it yet (young billing account). Reserved CPU is sum(cpu x maxInstances)
// across all functions in the region.
//
// IMPORTANT: this is a GLOBAL default. Changing it re-hashes EVERY function's config
// and forces the whole backend to redeploy at once, which then trips the SEPARATE
// "Write requests per minute per region" Cloud Run quota. So do NOT tune this to make
// room for a few new functions; instead give the new/low-traffic ones a per-function
// `maxInstances: 1` so only they redeploy and they add minimal reserved CPU (see the
// community moderation/metrics callables).
//
// TODO(scale): once the CPU quota is raised (retry the self-serve increase after the
// billing account matures, or via Support/Sales), add per-function maxInstances
// overrides on the hot paths (syncCommunityStats, coachMessage, stripeWebhook)
// before enabling COMMUNITY_BACKEND or onboarding many users.
setGlobalOptions({ region: 'australia-southeast2', maxInstances: 3 })

export { ping } from './ping'
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
  recordCoachFeedback,
} from './coachProfile'
export { deleteAccount, resumeAccountDeletions } from './account'
export { reconcileCoachActions } from './coachReconciler'
export { reportClientError, monitorSlo } from './observability'
export { sendNotification, dedupePushToken } from './notifications'
export { createCheckoutSession, createBillingPortalSession, stripeWebhook } from './billing'
// Community competition hub (leagues + forgiving streaks). Client is feature-
// flagged OFF until these are emulator-tested and deployed.
export { claimUsername, syncCommunityStats, globalStreaks, rolloverLeagues, grantStreakFreezes, reprocessStandings, pruneScoreLog, appealStanding, resolveStandingReview } from './community'
// Private friend groups (create / join / leave / delete / goal / cheer). Also
// feature-flagged OFF client-side.
export { createGroup, joinGroupByPasscode, joinGroupByCode, leaveGroup, deleteGroup, setGroupGoal, cheerGroupActivity } from './communityGroups'
// Content moderation (report an offensive username/group) + owner triage.
export { reportContent, resolveContentReport } from './communityModeration'
// Community ops/health metrics (daily aggregate + owner on-demand refresh).
export { computeCommunityMetrics, refreshCommunityMetrics } from './communityMetrics'
