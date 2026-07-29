import { getAI, getGenerativeModel, GoogleAIBackend, type AI } from 'firebase/ai'
import { app, firebaseEnabled } from './firebase'
import { MEAL_SCAN_PROMPT, parseMealAnalysis, type MealAnalysis } from './mealScanParse'

export type { MealAnalysis, MealFood, Confidence, Rec } from './mealScanParse'

/**
 * Real meal-photo analysis, powered by Gemini vision via Firebase AI Logic — the
 * same client-side pipeline the coach uses (the API key is held by Firebase, not
 * shipped in the app).
 *
 * IMPORTANT (Production Readiness plan §4.4): this runs ON THE CLIENT. It is an
 * honest estimate — a calorie RANGE with a confidence level and a visible
 * disclaimer — NOT a nutrition label, and it has no AUS nutrition DB / dietitian
 * review yet. Before scale it should move server-side behind the trusted backend
 * so the call can be attested. It also requires Firebase AI Logic to be enabled
 * on the project; if it is not, `analyzeMealPhoto` throws and the UI offers
 * manual logging instead.
 */
const MODEL = 'gemini-2.5-flash-lite'

let ai: AI | null = null
function getAiInstance(): AI {
  if (!app) throw new Error('Firebase not configured')
  if (!ai) ai = getAI(app, { backend: new GoogleAIBackend() })
  return ai
}

/** Analyse a base64-encoded meal photo. Resolves to a validated food/not-food result, or throws. */
export async function analyzeMealPhoto(base64: string, mimeType = 'image/jpeg'): Promise<MealAnalysis> {
  if (!firebaseEnabled) throw new Error('Meal scan is not configured')
  if (!base64) throw new Error('No image data')

  const model = getGenerativeModel(getAiInstance(), {
    model: MODEL,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 500 },
  })

  const result = await model.generateContent([
    { text: MEAL_SCAN_PROMPT },
    { inlineData: { mimeType, data: base64 } },
  ])
  return parseMealAnalysis(result.response.text() ?? '')
}
