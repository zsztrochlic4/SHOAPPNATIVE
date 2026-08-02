import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getFirestore } from 'firebase-admin/firestore'
import { requireVerifiedUser, APP_CHECK_ENFORCED } from './lib/guards'
import { enforceDailyLimit } from './lib/rateLimit'
import { coachKillSwitch } from './killSwitchRemote'
import {
  loadCoachTurnData,
  saveCoachTurn,
  saveMemoryCandidate,
  saveProposal,
  saveSafetySession,
  type CoachTurnData,
} from './coachWorkspace'

// SINGLE SOURCE: the guardrails run here are the exact same code the app runs,
// copied verbatim into _shared by scripts/sync-shared.mjs (never hand-edited).
import { COACH_ENABLED } from './_shared/backend/coach/coachGate'
import { APPROVED_KNOWLEDGE_SOURCES, buildCoachSystemPrompt, buildConversationTurnHint } from './_shared/backend/coach/operatingRules'
import { selectCoachContext, summarizeRecentTurns, type CoachContextSnapshot } from './_shared/backend/coach/contextSelection'
import { recordCoachTelemetry, recordCoachTurn } from './_shared/backend/coach/coachTelemetry'
import {
  STRUCTURED_COACH_RESPONSE_SCHEMA,
  validateStructuredCoachReply,
} from './_shared/backend/coach/structuredResponse'
import type {
  CoachActionProposal,
  CoachAnswerMode,
  CoachCitation,
  CoachMemory,
} from './_shared/backend/coach/contracts'
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
  /** @deprecated Ignored in production; recent turns are loaded server-side. */
  recent?: string[]
  /** @deprecated Ignored in production; safety/profile context is loaded server-side. */
  isAustralia?: boolean
  affectedRegions?: string[]
  engineExcludedExerciseIds?: string[]
  screeningOutcome?: string | null
  /** @deprecated Ignored in production; the server enforces the authoritative cap. */
  usage?: CoachUsage
}

export interface CoachTurnResult {
  text: string
  blocked: boolean
  buttons: ContactButton[]
  mode: CoachAnswerMode | 'safety'
  citations: CoachCitation[]
  memory: CoachMemory | null
  proposal: CoachActionProposal | null
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
  /** Production uses server-trusted context; tests may omit this and use readDob. */
  loadTurnData?: (uid: string) => Promise<CoachTurnData>
  saveTurn?: typeof saveCoachTurn
  persistSafety?: typeof saveSafetySession
  saveMemory?: typeof saveMemoryCandidate
  saveProposal?: typeof saveProposal
}

const asResponse = (r: { text: string; buttons: ContactButton[] }): CoachTurnResult => ({
  text: r.text,
  buttons: r.buttons,
  blocked: true,
  mode: 'safety',
  citations: [],
  memory: null,
  proposal: null,
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
  try {
    return await coachTurnCore(uid, input, deps)
  } catch (error) {
    if (error instanceof Error && error.message === 'coach_consent_required') {
      throw new HttpsError('failed-precondition', 'coach_consent_required')
    }
    if (error instanceof Error && error.message === 'user_profile_missing') {
      throw new HttpsError('failed-precondition', 'user_profile_missing')
    }
    throw error
  }
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

  const turnData = deps.loadTurnData
    ? await deps.loadTurnData(uid)
    : {
        context: {
          dateOfBirth: await deps.readDob(uid),
          affectedRegions: [], screeningOutcome: null, engineExcludedExerciseIds: [], isAustralia: true,
        } satisfies CoachContext,
        contextText: 'No server user snapshot is available in this test.',
        snapshot: {
          coachingStyle: 'balanced', goal: '', experience: '', units: 'metric', constraints: '',
          profile: '', canonicalProfile: '', program: '', recentTraining: '', trainingSummaries: '',
          activity: '', readiness: '', weights: '', nutrition: '', nutritionCheckins: '', memories: [],
        } satisfies CoachContextSnapshot,
        recent: [],
        safetySession: newSafetySession(),
        memoryEnabled: false,
        coachingStyle: 'balanced' as const,
      }
  const ctx = turnData.context

  // Stored 18+ gate (engine age routing on the server-trusted DOB).
  const elig = coachEligibility(ctx)
  if (!elig.eligible && elig.response) return asResponse(elig.response)

  // The classifier transport is the same server function for every request, so
  // setting it here (idempotent) needs no per-request teardown / no race.
  setClassifierTransport(deps.classify)

  const session = turnData.safetySession
  const recent = turnData.recent
  if (deps.saveTurn) await deps.saveTurn(uid, 'user', message)
  const pre = await coachPrecheckAsync(message, ctx, session, deps.loadTurnData ? undefined : input.usage, deps.todayKey, recent)
  if (deps.persistSafety) await deps.persistSafety(uid, session)
  // Content-free rollout telemetry (final plan Phase 6; dormant until activated).
  recordCoachTelemetry('route', pre.kind === 'block' ? pre.decision.category : pre.kind === 'limit' ? 'daily_limit' : (pre.decision.intent ?? 'allow'))
  if (pre.kind === 'block' || pre.kind === 'limit') {
    if (deps.saveTurn) await deps.saveTurn(uid, 'coach', pre.response.text, {
      blocked: true,
      category: pre.kind === 'block' ? pre.decision.category : 'daily_limit',
      tier: pre.kind === 'block' ? pre.decision.tier : undefined,
    })
    return asResponse(pre.response)
  }

  // Allowed → server-authoritative hard cap, then the model, then outgoing validation.
  try {
    await deps.enforceLimit(uid)
  } catch {
    const limited = dailyLimitResponse()
    if (deps.saveTurn) await deps.saveTurn(uid, 'coach', limited.text, { blocked: true, category: 'daily_limit' })
    return asResponse(limited)
  }
  // Intent-aware, budgeted context (final plan Phase 2) + per-turn conversational hint (Phase 1/3).
  const selectedContext = selectCoachContext(turnData.snapshot, message, { intent: pre.decision.intent })
  const turnHint = buildConversationTurnHint(pre.decision.intent)
  const systemPrompt = [
    buildCoachSystemPrompt(),
    '',
    selectedContext,
    ...(turnHint ? ['', turnHint] : []),
    '',
    'RECENT AUTHORITATIVE CONVERSATION:',
    summarizeRecentTurns(recent),
  ].join('\n')
  const startedAt = Date.now()
  const raw = await deps.generateReply(systemPrompt, message)
  recordCoachTurn(pre.decision.intent ?? 'allow', Date.now() - startedAt) // route category + latency bucket
  const validated = validateStructuredCoachReply(raw)
  const structured = validated.ok
    ? validated.reply
    : { mode: 'general' as const, message: validated.fallback, citations: [], memory: null, proposal: { kind: 'none' as const } }
  const approved = new Map<string, string>(APPROVED_KNOWLEDGE_SOURCES.map((s) => [s.key, s.title]))
  const citations = structured.citations
    .filter((c) => approved.get(c.sourceKey) === c.title)
    .slice(0, 5)
  const safe = guardOutgoing(structured.message, pre.decision, ctx, session)

  let memory: CoachMemory | null = null
  if (turnData.memoryEnabled && structured.memory && deps.saveMemory) {
    memory = await deps.saveMemory(uid, message, structured.memory)
  }
  let proposal: CoachActionProposal | null = null
  if (structured.proposal.kind !== 'none' && structured.proposal.title && structured.proposal.summary && deps.saveProposal) {
    proposal = await deps.saveProposal(uid, {
      kind: structured.proposal.kind,
      title: structured.proposal.title,
      summary: structured.proposal.summary,
      payload: structured.proposal.payload ?? {},
    })
  }
  if (deps.saveTurn) await deps.saveTurn(uid, 'coach', safe, {
    blocked: false,
    mode: structured.mode,
    citations,
    memoryId: memory?.id ?? null,
    proposalId: proposal?.id ?? null,
  })
  return { text: safe, blocked: false, buttons: [], mode: structured.mode, citations, memory, proposal }
}

/** Read the caller's stored DOB from the canonical backendUser record. Missing/unreadable stays null (fail-closed). */
async function readDobFromFirestore(uid: string): Promise<string | null> {
  try {
    const snap = await getFirestore().collection('users').doc(uid).get()
    const d = snap.data() as Record<string, any> | undefined
    return d?.backendUser?.date_of_birth ?? null
  } catch {
    return null
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
  // App Check is enforced consistently with every other callable via APP_CHECK_ENFORCED (currently
  // false, monitor-mode). This avoids the coach uniquely rejecting the native app (which does not yet
  // attest); App Check is rolled out app-wide later per docs/APP_CHECK.md — the coach comes along then.
  { enforceAppCheck: APP_CHECK_ENFORCED, timeoutSeconds: 60, secrets: [GEMINI_API_KEY] },
  async (req: CallableRequest<CoachMessageInput>): Promise<CoachTurnResult> => {
    const uid = requireVerifiedUser(req, 'coachMessage')
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
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 800,
            responseMimeType: 'application/json',
            responseSchema: STRUCTURED_COACH_RESPONSE_SCHEMA as any,
          },
        })
        return (r.response.text() ?? '').trim()
      },
      enforceLimit: (u) => enforceDailyLimit('coach', u, DAILY_COACH_LIMIT),
      killSwitchEngaged: () => coachKillSwitch.engaged(), // remote source: config/coach.killSwitch (Firestore)
      todayKey: new Date().toISOString().slice(0, 10),
      loadTurnData: loadCoachTurnData,
      saveTurn: saveCoachTurn,
      persistSafety: saveSafetySession,
      saveMemory: saveMemoryCandidate,
      saveProposal,
    })
  },
)
