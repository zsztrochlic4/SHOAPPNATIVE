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
// per region" quota (australia-southeast2) is capped at 20,000 milli-vCPU and
// Google won't self-serve raise it yet (young billing account). At maxInstances=10
// the ~30 functions' reserved CPU sat at 100% of that cap, so deploys of new/updated
// functions had no headroom and failed with "Quota exceeded for total allowable CPU
// per project per region". 3 keeps the whole backend comfortably under 20 vCPU.
// Fine at current (pre-launch) traffic; each v2 function here runs 1 request/instance,
// so 3 = 3 concurrent per function.
//
// TODO(scale): once the CPU quota is raised (retry the self-serve increase after the
// billing account matures, or via Support/Sales), raise this back and add per-function
// maxInstances overrides on the hot paths — syncCommunityStats, coachMessage,
// stripeWebhook — before enabling COMMUNITY_BACKEND or onboarding many users.
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
// Admin analytics dashboard (strengthhub-admin.web.app) — owner-only KPI +
// user aggregates. Reads Firebase Auth + entitlements via the Admin SDK.
export { adminAnalytics, adminUsers } from './adminAnalytics'
