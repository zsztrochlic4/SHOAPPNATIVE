import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Coach behaviour + limits, editable from the Firebase console WITHOUT a code
 * change. Create a Firestore document at `config/coach` with any of these
 * fields to override the defaults below. This is how you "manage the AI from
 * the backend": tighten limits, add house rules, pause it, or swap the model.
 *
 * Read is public (see firestore.rules) and cached for 5 minutes, so edits go
 * live within a few minutes and cost almost nothing to read.
 */
export type CoachConfig = {
  /** Master switch. Set false to force the on-device fallback (no AI/token use). */
  enabled: boolean
  /** Gemini model id. Cheapest capable default. */
  model: string
  /** Hard cap on reply length — the main lever on cost per message. */
  maxOutputTokens: number
  /** Lower = more focused/less likely to wander or hallucinate. */
  temperature: number
  /** Max coach messages per user per day (token-burn guard). */
  dailyMessageLimit: number
  /** Extra house rules appended to the system prompt (your instructions). */
  extraInstructions: string
}

const DEFAULTS: CoachConfig = {
  enabled: true,
  model: 'gemini-2.5-flash-lite',
  maxOutputTokens: 350,
  temperature: 0.6,
  dailyMessageLimit: 30,
  extraInstructions: '',
}

let cache: CoachConfig | null = null
let fetchedAt = 0
const TTL = 5 * 60 * 1000

/** Current coach config (merged over defaults), cached briefly. Never throws. */
export async function getCoachConfig(): Promise<CoachConfig> {
  if (cache && Date.now() - fetchedAt < TTL) return cache
  if (!db) return DEFAULTS
  try {
    const snap = await getDoc(doc(db, 'config', 'coach'))
    const data = (snap.exists() ? snap.data() : {}) as Partial<CoachConfig>
    cache = { ...DEFAULTS, ...data }
    fetchedAt = Date.now()
    return cache
  } catch {
    return cache ?? DEFAULTS
  }
}
