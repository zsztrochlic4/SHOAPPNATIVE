import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'
import { enforceDailyLimit } from './lib/rateLimit'
import { MEAL_SCAN_PROMPT, parseMealAnalysis, type MealAnalysis } from './lib/mealParse'

/**
 * Server-side meal-photo analysis (DEVELOPMENT_PLAN.md Phase B / §4.4).
 *
 * The Gemini vision call runs HERE, behind Auth + App Check, so it can be
 * attested and rate-limited and a modified client can no longer hit the model
 * directly. The photo is analysed and NOT stored (matches the privacy policy).
 * Returns the same shape as the client parser (src/lib/mealScanParse.ts).
 *
 * Uses the Gemini Developer API via a secret key — set once before deploy:
 *   firebase functions:secrets:set GEMINI_API_KEY
 * (create a key at https://aistudio.google.com/apikey). Can migrate to the
 * unified @google/genai SDK or Vertex AI later.
 */
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

const MODEL = 'gemini-2.5-flash-lite'
const MAX_SCANS_PER_DAY = 40
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // ~5 MB decoded
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

interface AnalyzeMealInput {
  /** Base64-encoded photo, no `data:` prefix. */
  image: string
  mimeType?: string
}

// Secured by sign-in + a per-user daily rate limit. App Check is scaffolded in
// monitor mode (auditAppCheck below; enforceAppCheck follows the APP_CHECK_ENFORCED
// flag) — see docs/APP_CHECK.md.
export const analyzeMeal = onCall<AnalyzeMealInput>(
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 30, memory: '512MiB', secrets: [GEMINI_API_KEY] },
  async (req: CallableRequest<AnalyzeMealInput>): Promise<MealAnalysis> => {
    auditAppCheck(req, 'analyzeMeal')
    const uid = requireAuth(req)

    const image = req.data?.image
    if (!image || typeof image !== 'string') {
      throw new HttpsError('invalid-argument', 'No image provided.')
    }
    // base64 length is ~4/3 of the decoded byte size.
    if (image.length * 0.75 > MAX_IMAGE_BYTES) {
      throw new HttpsError('invalid-argument', 'That image is too large.')
    }
    const mimeType = typeof req.data.mimeType === 'string' ? req.data.mimeType : 'image/jpeg'
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new HttpsError('invalid-argument', 'Unsupported image type.')
    }

    // Cost/abuse guard — per user, per day.
    await enforceDailyLimit('meal', uid, MAX_SCANS_PER_DAY)

    const model = new GoogleGenerativeAI(GEMINI_API_KEY.value()).getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 500 },
    })

    let text: string
    try {
      const result = await model.generateContent([
        { text: MEAL_SCAN_PROMPT },
        { inlineData: { mimeType, data: image } },
      ])
      text = result.response.text() ?? ''
    } catch {
      throw new HttpsError('unavailable', 'The scan service is temporarily unavailable. Please try again.')
    }

    try {
      return parseMealAnalysis(text)
    } catch {
      throw new HttpsError('internal', 'Could not read the estimate. Please try again.')
    }
  },
)
