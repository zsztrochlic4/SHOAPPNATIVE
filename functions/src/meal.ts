import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { requireVerifiedUser } from './lib/guards'

interface AnalyzeMealInput {
  /** Base64-encoded photo. */
  image: string
  mimeType?: string
}

/**
 * STUB — server-side meal-photo analysis.
 *
 * Moves the Gemini vision call OFF the client (DEVELOPMENT_PLAN.md Phase B /
 * §4.4): the model is called here, behind Auth + App Check, so the API can be
 * attested, rate-limited, and audited — a modified client can no longer reach it
 * directly. Mirrors the client parser in src/lib/mealScanParse.ts (food gate +
 * honest range + confidence). Not implemented yet.
 *
 * TODO(Phase B): call Gemini via the Admin/AI SDK; apply a per-user rate limit;
 * validate + clamp the result (reuse the mealScanParse logic); write an audit
 * record; return the same shape the client expects.
 */
export const analyzeMeal = onCall<AnalyzeMealInput>(
  { enforceAppCheck: true, timeoutSeconds: 30 },
  (req: CallableRequest<AnalyzeMealInput>) => {
    const uid = requireVerifiedUser(req)
    void uid
    void req.data.image
    throw new HttpsError('unimplemented', 'analyzeMeal is scaffolded but not implemented yet.')
  },
)
