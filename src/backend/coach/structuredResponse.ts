import { sanitizeMultiline } from '../../lib/sanitize'
import type {
  CoachAnswerMode,
  CoachCitation,
  CoachMemoryCandidate,
  CoachMemorySensitivity,
  CoachProposalKind,
  StructuredCoachReply,
} from './contracts'
import { validateWorkoutActionPayload, WORKOUT_ACTION_NAMES } from './workoutActions'

const MODES: CoachAnswerMode[] = ['general', 'personalised', 'app_help']
const PROPOSALS: CoachProposalKind[] = ['none', 'navigation', 'memory', 'workout_action']
const SENSITIVITIES: CoachMemorySensitivity[] = ['ordinary', 'sensitive']
const SCOPES: CoachMemoryCandidate['scope'][] = [
  'stable', 'current_program', 'current_period', 'current_week', 'current_session',
]
const MESSAGE_MAX = 4000

export const STRUCTURED_COACH_FALLBACK =
  "I couldn't put together a reliable answer just now. Please try asking again in a moment."

export type StructuredReplyValidation =
  // `proposalDropped` marks a reply whose CORE (mode/message/citations/memory) was valid but whose
  // PROPOSAL was malformed: we keep the text and drop just the unactionable proposal (see below).
  // `messageNeutralized` marks the narrow case where that dropped-proposal reply ALSO claimed the
  // change was already done — a guaranteed false success (nothing will apply), so the text is
  // replaced with the honest fallback (see `assertsCompletedWorkoutAction`).
  | { ok: true; reply: StructuredCoachReply; proposalDropped?: boolean; droppedReason?: string; messageNeutralized?: boolean }
  | { ok: false; fallback: string; reason: string }

/**
 * Does the reply TEXT assert that a workout/program change already happened? The coach may only
 * PROPOSE actions (operatingRules HARD NEVER + WORKOUT_ACTION_ALLOWLIST): the app performs and
 * reports a change only after the user confirms and it durably applies. A reply that says
 * "I've swapped… / I've updated your training days / I've applied the deload / done" before that is
 * a false success claim (Step-4 eval MT04/MT06/MT14, auto-fail rule "claimed success for an action
 * that did not durably apply"). This detects that claim so the degraded path can neutralise it and
 * the eval can flag it; it is deliberately conservative (first-person completion of a program-change
 * verb, or an explicit "done"/"all set" phrase) — a PROPOSAL ("want me to…", "I can…", "I'll…")
 * never matches.
 */
const _APPLIED_VERB = 'swapped|switched|changed|updated|applied|adjusted|rescheduled|replaced|removed|added|deloaded|set|scheduled|moved|reprogrammed|regenerated|rebuilt|sorted'
// Perfect form — "I've applied", "I have updated", "I've just gone ahead and changed".
const _APPLIED_PERFECT = new RegExp(`\\bi(?:['’]ve| have)(?:\\s+(?:just|now|already|gone ahead and))*\\s+(?:${_APPLIED_VERB})\\b`, 'i')
// Simple past — "I swapped", "I just updated" (no bare "set/added", which are too ambiguous alone).
const _APPLIED_PAST = /\bi (?:just |already |now )?(?:swapped|switched|changed|updated|applied|adjusted|rescheduled|replaced|removed|deloaded|scheduled|moved|reprogrammed|regenerated|rebuilt)\b/i
// Bare completion phrases.
const _APPLIED_DONE = /\b(?:all set|consider it done|that['’]s (?:done|sorted|applied|updated|changed|swapped))\b|\bdone[.!,—-]/i

export function assertsCompletedWorkoutAction(message: string): boolean {
  if (typeof message !== 'string' || !message) return false
  return _APPLIED_PERFECT.test(message) || _APPLIED_PAST.test(message) || _APPLIED_DONE.test(message)
}

function cleanShort(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const clean = sanitizeMultiline(value, max)
  return clean || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

type ProposalParse =
  | { ok: true; proposal: StructuredCoachReply['proposal'] }
  | { ok: false; reason: string }

/**
 * Parse & bound-check the proposal in isolation. A failure here is DEGRADED by the caller (the
 * reply is kept, the proposal dropped), so it must never let a malformed action through: a
 * workout_action still has to pass validateWorkoutActionPayload — the resolver's trust boundary.
 */
function parseProposal(raw: unknown): ProposalParse {
  if (!isRecord(raw)) return { ok: false, reason: 'bad_proposal' }
  const kind = raw.kind
  if (typeof kind !== 'string' || !PROPOSALS.includes(kind as CoachProposalKind)) {
    return { ok: false, reason: 'bad_proposal_kind' }
  }
  const proposal: StructuredCoachReply['proposal'] = { kind: kind as CoachProposalKind }
  if (kind === 'none') return { ok: true, proposal }

  const title = cleanShort(raw.title, 120)
  const summary = cleanShort(raw.summary, 500)
  if (!title || !summary || !isRecord(raw.payload)) return { ok: false, reason: 'bad_proposal' }
  if (Object.keys(raw.payload).length > 12) return { ok: false, reason: 'bad_proposal_payload' }
  const payload: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(raw.payload)) {
    if (!/^[a-z][a-zA-Z0-9_]{0,39}$/.test(key) || !['string', 'number', 'boolean'].includes(typeof value)) {
      return { ok: false, reason: 'bad_proposal_payload' }
    }
    payload[key] = value as string | number | boolean
  }
  // A workout_action carries an engine-resolvable change: enforce the bounded, per-action schema on
  // top of the generic payload check. The resolver (coachActionResolver.ts) trusts only what passes.
  if (kind === 'workout_action') {
    const wa = validateWorkoutActionPayload(payload)
    if (!wa.ok) return { ok: false, reason: `bad_workout_action:${wa.reason}` }
  }
  proposal.title = title
  proposal.summary = summary
  proposal.payload = payload
  return { ok: true, proposal }
}

export function validateStructuredCoachReply(raw: unknown): StructuredReplyValidation {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!isRecord(parsed)) return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'not_object' }

    const mode = parsed.mode
    if (typeof mode !== 'string' || !MODES.includes(mode as CoachAnswerMode)) {
      return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_mode' }
    }
    const message = cleanShort(parsed.message, MESSAGE_MAX)
    if (!message) return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_message' }

    const citations: CoachCitation[] = []
    if (!Array.isArray(parsed.citations) || parsed.citations.length > 5) {
      return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_citations' }
    }
    for (const item of parsed.citations) {
      if (!isRecord(item)) return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_citation' }
      const sourceKey = cleanShort(item.sourceKey, 80)
      const title = cleanShort(item.title, 200)
      if (!sourceKey || !title) return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_citation' }
      citations.push({ sourceKey, title })
    }

    let memory: CoachMemoryCandidate | null = null
    if (parsed.memory != null) {
      if (!isRecord(parsed.memory)) return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_memory' }
      const category = cleanShort(parsed.memory.category, 80)
      const value = cleanShort(parsed.memory.value, 500)
      const evidenceQuote = cleanShort(parsed.memory.evidenceQuote, 500)
      const scope = parsed.memory.scope
      const sensitivity = parsed.memory.sensitivity
      if (!category || !value || !evidenceQuote || typeof scope !== 'string' || !SCOPES.includes(scope as CoachMemoryCandidate['scope']) ||
          typeof sensitivity !== 'string' || !SENSITIVITIES.includes(sensitivity as CoachMemorySensitivity)) {
        return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_memory' }
      }
      memory = {
        category,
        value,
        evidenceQuote,
        scope: scope as CoachMemoryCandidate['scope'],
        sensitivity: sensitivity as CoachMemorySensitivity,
      }
    }

    // Graceful degradation: the core reply (mode/message/citations/memory) is already valid here,
    // so a MALFORMED PROPOSAL must not discard it into the generic fallback. We keep the model's
    // message and drop just the unactionable proposal (kind → 'none'). This is safe: the engine only
    // ever resolves a proposal that PASSED validateWorkoutActionPayload, so a dropped/degraded
    // proposal can never reach the resolver — and the outgoing message still runs guardOutgoing.
    // (A common flash-lite failure this fixes: putting a prose sentence in payload.action on a plain
    // "swap the bench" request, which validates as bad_workout_action:unknown_action.)
    const parsedProposal = parseProposal(parsed.proposal)
    if (parsedProposal.ok) {
      return { ok: true, reply: { mode: mode as CoachAnswerMode, message, citations, memory, proposal: parsedProposal.proposal } }
    }
    // The proposal is dropped, so NOTHING will apply this turn. If the model's kept text ALSO claims
    // the change already happened ("I've swapped…"), the user would see a false "done" with no confirm
    // card — the exact regression PR #52's degradation could otherwise introduce (Step-4 eval
    // MT04/06/14). With the proposal gone this is an unambiguous false success, so replace the text
    // with the honest fallback rather than surface the claim. (The non-degraded path keeps the model
    // text: the prompt HARD NEVER makes it PROPOSE, and its confirm card still gates the real apply.)
    if (assertsCompletedWorkoutAction(message)) {
      return {
        ok: true,
        reply: { mode: mode as CoachAnswerMode, message: STRUCTURED_COACH_FALLBACK, citations: [], memory: null, proposal: { kind: 'none' } },
        proposalDropped: true,
        droppedReason: parsedProposal.reason,
        messageNeutralized: true,
      }
    }
    return {
      ok: true,
      reply: { mode: mode as CoachAnswerMode, message, citations, memory, proposal: { kind: 'none' } },
      proposalDropped: true,
      droppedReason: parsedProposal.reason,
    }
  } catch {
    return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'invalid_json' }
  }
}

/** Gemini JSON schema kept beside the validator so generation and enforcement cannot drift. */
export const STRUCTURED_COACH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    mode: { type: 'string', enum: MODES },
    message: { type: 'string' },
    citations: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: { sourceKey: { type: 'string' }, title: { type: 'string' } },
        required: ['sourceKey', 'title'],
      },
    },
    memory: {
      type: 'object', nullable: true,
      properties: {
        category: { type: 'string' }, value: { type: 'string' }, evidenceQuote: { type: 'string' },
        scope: { type: 'string', enum: SCOPES }, sensitivity: { type: 'string', enum: SENSITIVITIES },
      },
      required: ['category', 'value', 'evidenceQuote', 'scope', 'sensitivity'],
    },
    proposal: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: PROPOSALS }, title: { type: 'string' }, summary: { type: 'string' },
        // Steer the model toward a VALID bounded action name (a workout_action payload must carry
        // `action` ∈ WORKOUT_ACTION_NAMES). This is a soft hint — extra per-action params are still
        // allowed — that cuts the "prose in payload.action" failures; the validator remains the gate.
        payload: { type: 'object', properties: { action: { type: 'string', enum: WORKOUT_ACTION_NAMES } } },
      },
      required: ['kind'],
    },
  },
  required: ['mode', 'message', 'citations', 'memory', 'proposal'],
} as const
