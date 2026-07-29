import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { requireVerifiedUser } from './lib/guards'

interface CoachMessageInput {
  message: string
}

/**
 * STUB — server-side AI coach.
 *
 * The coach's Gemini call must run here, not on the client (DEVELOPMENT_PLAN.md
 * Phase B / §4.4), so the deterministic safety floor cannot be bypassed by a
 * modified app. This is where the crisis/red-flag precheck, the LLM classifier,
 * the post-response validator, the daily message limit, and the kill switch run
 * BEFORE and AFTER the model — the same guardrails that exist in src/backend/coach.
 *
 * RELEASE GATE: stays disabled until a fresh independent holdout passes with zero
 * critical misses and the required sign-offs are in (see the coach-safety memory).
 * Not implemented yet.
 */
export const coachMessage = onCall<CoachMessageInput>(
  { enforceAppCheck: true, timeoutSeconds: 60 },
  (req: CallableRequest<CoachMessageInput>) => {
    const uid = requireVerifiedUser(req)
    void uid
    throw new HttpsError('unimplemented', 'coachMessage is scaffolded but gated off until the safety release gate is cleared.')
  },
)
