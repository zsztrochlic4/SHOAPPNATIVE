import { httpsCallable } from 'firebase/functions'
import { functions, firebaseEnabled } from './firebase'
import type { MealAnalysis } from './mealScanParse'

export type { MealAnalysis, MealFood, Confidence, Rec } from './mealScanParse'

/**
 * Real meal-photo analysis — now runs on the TRUSTED BACKEND (Cloud Functions v2
 * `analyzeMeal`), not on the device. The Gemini vision call, the food/non-food
 * gate, the honest calorie range, and a per-user rate limit all live server-side
 * (DEVELOPMENT_PLAN.md Phase B / §4.4), so a modified client can no longer reach
 * the model directly. The photo is analysed and not stored.
 *
 * Secured by sign-in + rate limiting (the app's Firebase JS SDK can't do native
 * App Check — §4.3); server-side Play Integrity is a later enhancement.
 *
 * Throws when Firebase isn't configured (demo mode) or the call fails; the UI
 * then offers manual logging.
 */
export async function analyzeMealPhoto(base64: string, mimeType = 'image/jpeg'): Promise<MealAnalysis> {
  if (!firebaseEnabled || !functions) throw new Error('Meal scan is not configured')
  if (!base64) throw new Error('No image data')

  const call = httpsCallable<{ image: string; mimeType: string }, MealAnalysis>(functions, 'analyzeMeal')
  const res = await call({ image: base64, mimeType })
  return res.data
}
