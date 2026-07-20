import { getAI, getGenerativeModel, GoogleAIBackend, type AI } from 'firebase/ai'
import { app, firebaseEnabled } from './firebase'
import { setClassifierTransport } from '../backend/coach/safety'

/**
 * Production transport for the LLM safety classifier (src/backend/coach/safety/llmClassifier.ts).
 *
 * The classifier itself is pure and model-agnostic; this wires it to the app's existing model access
 * — Gemini via Firebase AI Logic, the same backend the coach uses — with a SEPARATE, deterministic
 * classification call (temperature 0, low token budget, JSON out). It is registered once at startup.
 *
 * This does NOT enable the coach: the classifier only runs when a live coach surface calls the async
 * precheck, and those surfaces stay gated by `coachOperational()` / `COACH_ENABLED` (false). Wiring a
 * model is not validating it — `activeClassifier.validated` stays false.
 */
const MODEL = 'gemini-2.5-flash-lite'

/** Exact model + config used for classification — surfaced in the dev validation report header. */
export const CLASSIFIER_MODEL_INFO = { backend: 'firebase-ai-logic', model: MODEL, temperature: 0, maxOutputTokens: 120 } as const

const SYSTEM = [
  'You are a safety classifier, not a chatbot. You receive a prompt describing safety categories and a',
  'user message, and you output ONLY the requested JSON. You never coach, advise, or reply to the user.',
  'When uncertain whether a message is a safety concern, you flag it (recall matters more than precision).',
].join(' ')

let ai: AI | null = null
function model() {
  if (!app) throw new Error('Firebase not configured')
  if (!ai) ai = getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: MODEL,
    systemInstruction: SYSTEM,
    generationConfig: { maxOutputTokens: CLASSIFIER_MODEL_INFO.maxOutputTokens, temperature: CLASSIFIER_MODEL_INFO.temperature },
  })
}

/**
 * Register the Firebase AI Logic transport. Safe no-op when Firebase isn't configured (demo/web
 * without config) — the classifier then reports UNAVAILABLE and the router fails safe. Never throws
 * at startup; a per-call failure rejects and the router escalates protectively.
 */
export function initCoachClassifier(): void {
  if (!firebaseEnabled || !app) return
  setClassifierTransport(async (prompt: string) => {
    const result = await model().generateContent(prompt)
    return (result.response.text() ?? '').trim()
  })
}
