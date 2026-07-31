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
 * Secured by sign-in + a per-user daily rate limit. App Check is scaffolded in
 * monitor mode (see docs/APP_CHECK.md); enforcement is an owner flip.
 *
 * Bounded by a client timeout so a hung backend can't leave the user waiting
 * forever — on timeout (or any failure) it throws and the UI offers manual
 * logging. Also throws when Firebase isn't configured (demo mode).
 */
export async function analyzeMealPhoto(base64: string, mimeType = 'image/jpeg'): Promise<MealAnalysis> {
  if (!firebaseEnabled || !functions) throw new Error('Meal scan is not configured')
  if (!base64) throw new Error('No image data')

  // 35s ceiling — just above the function's own 30s timeout, so a stuck request
  // fails fast with a clear error instead of hanging the scanner UI.
  const call = httpsCallable<{ image: string; mimeType: string }, MealAnalysis>(functions, 'analyzeMeal', {
    timeout: 35_000,
  })
  const res = await call({ image: base64, mimeType })
  return res.data
}
