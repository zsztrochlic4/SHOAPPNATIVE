import { sanitizeMultiline } from '../../lib/sanitize'
import type {
  CoachAnswerMode,
  CoachCitation,
  CoachMemoryCandidate,
  CoachMemorySensitivity,
  CoachProposalKind,
  StructuredCoachReply,
} from './contracts'
import { validateWorkoutActionPayload } from './workoutActions'

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
  | { ok: true; reply: StructuredCoachReply }
  | { ok: false; fallback: string; reason: string }

function cleanShort(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const clean = sanitizeMultiline(value, max)
  return clean || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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

    if (!isRecord(parsed.proposal)) return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_proposal' }
    const kind = parsed.proposal.kind
    if (typeof kind !== 'string' || !PROPOSALS.includes(kind as CoachProposalKind)) {
      return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_proposal_kind' }
    }
    const proposal: StructuredCoachReply['proposal'] = { kind: kind as CoachProposalKind }
    if (kind !== 'none') {
      const title = cleanShort(parsed.proposal.title, 120)
      const summary = cleanShort(parsed.proposal.summary, 500)
      if (!title || !summary || !isRecord(parsed.proposal.payload)) {
        return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_proposal' }
      }
      const payload: Record<string, string | number | boolean> = {}
      if (Object.keys(parsed.proposal.payload).length > 12) {
        return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_proposal_payload' }
      }
      for (const [key, value] of Object.entries(parsed.proposal.payload)) {
        if (!/^[a-z][a-zA-Z0-9_]{0,39}$/.test(key) || !['string', 'number', 'boolean'].includes(typeof value)) {
          return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: 'bad_proposal_payload' }
        }
        payload[key] = value as string | number | boolean
      }
      // A workout_action carries an engine-resolvable change: enforce the bounded,
      // per-action schema on top of the generic payload check. The resolver
      // (coachActionResolver.ts) trusts only a payload that passes here.
      if (kind === 'workout_action') {
        const wa = validateWorkoutActionPayload(payload)
        if (!wa.ok) return { ok: false, fallback: STRUCTURED_COACH_FALLBACK, reason: `bad_workout_action:${wa.reason}` }
      }
      proposal.title = title
      proposal.summary = summary
      proposal.payload = payload
    }

    return { ok: true, reply: { mode: mode as CoachAnswerMode, message, citations, memory, proposal } }
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
        payload: { type: 'object' },
      },
      required: ['kind'],
    },
  },
  required: ['mode', 'message', 'citations', 'memory', 'proposal'],
} as const
