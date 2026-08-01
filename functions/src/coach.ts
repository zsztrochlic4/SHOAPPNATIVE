import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getFirestore } from 'firebase-admin/firestore'
import { requireVerifiedUser } from './lib/guards'
import { enforceDailyLimit } from './lib/rateLimit'
import { coachKillSwitch } from './killSwitchRemote'

// SINGLE SOURCE: the guardrails run here are the exact same code the app runs,
// copied verbatim into _shared by scripts/sync-shared.mjs (never hand-edited).
import { COACH_ENABLED } from './_shared/backend/coach/coachGate'
import { buildCoachSystemPrompt } from './_shared/backend/coach/operatingRules'
import {
  coachPrecheckAsync,
  guardOutgoing,
  coachEligibility,
  newSafetySession,
  setClassifierTransport,
  DAILY_COACH_LIMIT,
  type CoachContext,
  type CoachUsage,
} from './_shared/backend/coach/safety/index'
import { dailyLimitResponse } from './_shared/backend/coach/safety/dailyLimit'
import type { ContactButton } from './_shared/backend/coach/safety/types'
import type { ClassifierTransport } from './_shared/backend/coach/safety/llmClassifier'

/**
 * Server-side AI coach (DEVELOPMENT_PLAN §4.4). The crisis/red-flag precheck, the
 * LLM safety classifier, the post-response validator, and the daily limit all run
 * HERE — before and after the model — so a modified client cannot bypass the
 * deterministic safety floor. The guardrail code is the app's, shared verbatim.
 *
 * RELEASE GATE: `COACH_ENABLED` stays false and this returns `coach_disabled`
 * until a fresh independent holdout passes (Jack §4) and the §19/§23 sign-offs are
 * in (see the coach-safety memory + src/backend/coach/safety/STATUS.md). This file
 * makes the backend READY to flip; it does not enable anything.
 */
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
const MODEL = 'gemini-2.5-flash-lite'
const MAX_MESSAGE_LEN = 2000

export interface CoachMessageInput {
  message: string
  /** Recent turns (oldest first) for multi-turn classifier context. */
  recent?: string[]
  isAustralia?: boolean
  affectedRegions?: string[]
  engineExcludedExerciseIds?: string[]
  screeningOutcome?: string | null
  /** Client's soft per-day usage; the server also enforces a hard cap. */
  usage?: CoachUsage
}

export interface CoachTurnResult {
  text: string
  blocked: boolean
  buttons: ContactButton[]
}

/** Injected side-effects so the orchestration is unit-testable without Firebase/Gemini. */
export interface CoachTurnDeps {
  /** Server-trusted date of birth (age gate can't be spoofed by the client). */
  readDob: (uid: string) => Promise<string | null>
  /** The safety classifier transport (server Gemini in prod, a fake in tests). */
  classify: ClassifierTransport
  /** Generate the coach reply given the system prompt + user text. */
  generateReply: (systemPrompt: string, userText: string) => Promise<string>
  /** Server-authoritative hard daily cap; throws when exceeded. */
  enforceLimit: (uid: string) => Promise<void>
  /** Remote kill switch (spec §20) — true ⇒ coach off regardless of the model. */
  killSwitchEngaged: () => boolean
  /** Today's key for the soft daily-limit check. */
  todayKey: string
}

const asResponse = (r: { text: string; buttons: ContactButton[] }): CoachTurnResult => ({
  text: r.text,
  buttons: r.buttons,
  blocked: true,
})

/**
 * One coach turn, guardrails first. Order is enforced by coachPrecheckAsync: a
 * crisis/safety block is returned regardless of the daily limit, and the model is
 * NEVER called on a block. Fails safe (the shared layer returns service-unavailable
 * + crisis options on any classifier error — never "allow").
 */
export async function runCoachTurn(uid: string, input: CoachMessageInput, deps: CoachTurnDeps): Promise<CoachTurnResult> {
  // THE flip point — nothing below runs while the coach is gated off.
  if (!COACH_ENABLED) throw new HttpsError('failed-precondition', 'coach_disabled')
  if (deps.killSwitchEngaged()) throw new HttpsError('unavailable', 'coach_unavailable')
  return coachTurnCore(uid, input, deps)
}

/**
 * The guarded orchestration WITHOUT the enable-gate — split out so the safety
 * behaviour (block never calls the model, allow does, outgoing validation) is
 * unit-testable while `COACH_ENABLED` stays false. The gate is tested separately
 * via `runCoachTurn` (throws `coach_disabled`); production only reaches here
 * through `runCoachTurn`, i.e. after the gate + kill switch.
 */
export async function coachTurnCore(uid: string, input: CoachMessageInput, deps: CoachTurnDeps): Promise<CoachTurnResult> {
  const message = typeof input.message === 'string' ? input.message.slice(0, MAX_MESSAGE_LEN) : ''
  if (!message.trim()) throw new HttpsError('invalid-argument', 'Empty message.')

  const ctx: CoachContext = {
    dateOfBirth: await deps.readDob(uid),
    affectedRegions: Array.isArray(input.affectedRegions) ? input.affectedRegions : [],
    screeningOutcome: input.screeningOutcome ?? null,
    engineExcludedExerciseIds: Array.isArray(input.engineExcludedExerciseIds) ? input.engineExcludedExerciseIds : [],
    isAustralia: input.isAustralia !== false, // AU app; default true so AU crisis numbers show
  }

  // Stored 18+ gate (engine age routing on the server-trusted DOB).
  const elig = coachEligibility(ctx)
  if (!elig.eligible && elig.response) return asResponse(elig.response)

  // The classifier transport is the same server function for every request, so
  // setting it here (idempotent) needs no per-request teardown / no race.
  setClassifierTransport(deps.classify)

  const session = newSafetySession()
  const recent = Array.isArray(input.recent) ? input.recent.filter((s) => typeof s === 'string') : []
  const pre = await coachPrecheckAsync(message, ctx, session, input.usage, deps.todayKey, recent)
  if (pre.kind === 'block') return asResponse(pre.response)
  if (pre.kind === 'limit') return asResponse(pre.response)

  // Allowed → server-authoritative hard cap, then the model, then outgoing validation.
  try {
    await deps.enforceLimit(uid)
  } catch {
    return asResponse(dailyLimitResponse())
  }
  const reply = await deps.generateReply(buildCoachSystemPrompt(), message)
  const safe = guardOutgoing(reply, pre.decision, ctx, session)
  return { text: safe, blocked: false, buttons: [] }
}

/** Read the caller's stored DOB from the canonical user doc (best-effort field probing). */
async function readDobFromFirestore(uid: string): Promise<string | null> {
  try {
    const snap = await getFirestore().collection('users').doc(uid).get()
    const d = snap.data() as Record<string, any> | undefined
    return d?.date_of_birth ?? d?.dateOfBirth ?? d?.profile?.dateOfBirth ?? null
  } catch {
    return null // engine failure must not itself block a legitimate adult; the router still guards content
  }
}

/** A server Gemini call bound to the secret key; used for both classification and replies. */
function geminiModel(systemInstruction?: string) {
  return new GoogleGenerativeAI(GEMINI_API_KEY.value()).getGenerativeModel({
    model: MODEL,
    ...(systemInstruction ? { systemInstruction } : {}),
  })
}

// Warm the remote kill switch on cold start so the first request serves a fresh value.
void coachKillSwitch.refresh()

export const coachMessage = onCall<CoachMessageInput>(
  { enforceAppCheck: true, timeoutSeconds: 60, secrets: [GEMINI_API_KEY] },
  async (req: CallableRequest<CoachMessageInput>): Promise<CoachTurnResult> => {
    const uid = requireVerifiedUser(req)
    const classify: ClassifierTransport = async (prompt) => {
      const m = geminiModel()
      const r = await m.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 200 },
      })
      return r.response.text() ?? ''
    }
    return runCoachTurn(uid, req.data ?? { message: '' }, {
      readDob: readDobFromFirestore,
      classify,
      generateReply: async (systemPrompt, userText) => {
        const m = geminiModel(systemPrompt)
        const r = await m.generateContent({
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 400 },
        })
        return (r.response.text() ?? '').trim()
      },
      enforceLimit: (u) => enforceDailyLimit('coach', u, DAILY_COACH_LIMIT),
      killSwitchEngaged: () => coachKillSwitch.engaged(), // remote source: config/coach.killSwitch (Firestore)
      todayKey: new Date().toISOString().slice(0, 10),
    })
  },
)
