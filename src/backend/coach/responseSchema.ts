/**
 * AI coach STRUCTURED-RESPONSE schema validation (Hardening Plan v3 §8.1, §8.2).
 *
 * The governing principle (plan §8): the coach PROPOSES and a deterministic
 * safety engine VALIDATES and PERFORMS. No model response is trusted by default,
 * and the coach has NO privileged path to user data. This module is the schema
 * gate every parsed coach response must pass before anything downstream may act
 * on it:
 *
 *   - Request structured output against a FIXED schema (set `responseMimeType`/
 *     `responseSchema` at the AI Logic call site).
 *   - Validate every response against that schema with the same rigour applied to
 *     Firestore writes: required fields, types, enums, numeric bounds, array caps
 *     (plan §8.1). REJECT on any mismatch rather than best-effort parsing.
 *   - Every parse failure — empty, truncated/cut-off JSON, prose wrapped around
 *     JSON, wrong types, nulls — maps to a DEFINED SAFE FALLBACK, never a crash
 *     or a silent partial write (plan §8.1, §8.5).
 *
 * The output of this module is always a PROPOSAL (see `CoachProposal`). Applying
 * it is the job of the safety/validation engine, which writes through the same
 * validated client paths + Firestore rules as any other write — there is no
 * AI-privileged write path (plan §8.2). A proposal that fails validation here is
 * discarded with a safe message and is NEVER partially applied.
 */

import { sanitizeMultiline, isValidId, sanitizeNumber } from '../../lib/sanitize'

/* ------------------------------------------------------------------ */
/*  The proposal schema                                                */
/* ------------------------------------------------------------------ */

export type CoachProposalKind = 'guidance' | 'set_adjustment' | 'none'
export const COACH_PROPOSAL_KINDS: CoachProposalKind[] = ['guidance', 'set_adjustment', 'none']

/** One proposed change to a single logged/prescribed set. Bounds mirror the
 *  Safety Rules' realistic ranges; the engine re-clamps again before any write. */
export interface ProposedSetAdjustment {
  exercise_id: string
  set_number: number
  load_kg?: number
  reps?: number
  rir?: number
}

export interface CoachProposal {
  kind: CoachProposalKind
  /** Plain-text message shown to the user. Never rendered as HTML/markup. */
  message: string
  /** Only present for kind === 'set_adjustment'. */
  adjustments?: ProposedSetAdjustment[]
}

/** Caps (plan §8.1 array caps / §7 field caps). */
const MESSAGE_MAX = 4000
const MAX_ADJUSTMENTS = 50
const SET_NUMBER_MAX = 50
const LOAD_KG_MAX = 1000
const REPS_MAX = 1000
const RIR_MIN = 0
const RIR_MAX = 10

/* ------------------------------------------------------------------ */
/*  Validation result                                                  */
/* ------------------------------------------------------------------ */

export type CoachValidation =
  | { ok: true; proposal: CoachProposal }
  | { ok: false; reason: CoachRejectReason; fallback: string }

export type CoachRejectReason =
  | 'empty'
  | 'not_json'
  | 'not_object'
  | 'bad_kind'
  | 'bad_message'
  | 'bad_adjustments'
  | 'exception'

/**
 * The single defined safe fallback message (plan §8.1, §8.3). Kept deliberately
 * calm and non-alarming; the caller shows this instead of the raw model output.
 * A crisis/safety suppression uses its OWN approved affordance (see
 * src/backend/coach/safety) — this fallback is for schema/parse failures only.
 */
export const SAFE_FALLBACK_MESSAGE =
  "I couldn't put together a reliable answer just now. Let's keep it simple — check your plan for today, and try asking again in a moment."

function reject(reason: CoachRejectReason): CoachValidation {
  return { ok: false, reason, fallback: SAFE_FALLBACK_MESSAGE }
}

/* ------------------------------------------------------------------ */
/*  Strict parse + validate                                            */
/* ------------------------------------------------------------------ */

/**
 * Validate a RAW coach response string against the fixed schema. `raw` is the
 * exact text the model returned (for a streamed response, pass the COMPLETED
 * message only — never act on partial content; a cut-off stream is invalid,
 * plan §8.5). Returns a validated `CoachProposal` or a safe fallback. Never
 * throws.
 *
 * Parsing is STRICT: the response must be a single JSON object. Prose-wrapped
 * JSON, truncated JSON, wrong types, and nulls all resolve to the safe fallback
 * rather than a best-effort salvage (plan §8.1).
 */
export function validateCoachResponse(raw: unknown): CoachValidation {
  try {
    if (raw == null) return reject('empty')
    const text = typeof raw === 'string' ? raw.trim() : ''
    if (typeof raw === 'string') {
      if (text.length === 0) return reject('empty')
      return validateParsed(safeParse(text))
    }
    // Already-parsed object handed in (e.g. from a structured-output SDK).
    if (typeof raw === 'object') return validateParsed(raw)
    return reject('not_object')
  } catch {
    // Any unexpected error maps to the safe fallback — never a crash (plan §8.5).
    return reject('exception')
  }
}

/** JSON.parse that returns a sentinel instead of throwing on invalid/truncated. */
const PARSE_FAILED = Symbol('parse_failed')
function safeParse(text: string): unknown | typeof PARSE_FAILED {
  try {
    return JSON.parse(text)
  } catch {
    return PARSE_FAILED
  }
}

function validateParsed(data: unknown): CoachValidation {
  if (data === PARSE_FAILED) return reject('not_json')
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return reject('not_object')

  const obj = data as Record<string, unknown>

  // kind: required enum.
  const kind = obj.kind
  if (typeof kind !== 'string' || !COACH_PROPOSAL_KINDS.includes(kind as CoachProposalKind)) {
    return reject('bad_kind')
  }

  // message: required non-empty string, sanitised + bounded.
  if (typeof obj.message !== 'string') return reject('bad_message')
  const message = sanitizeMultiline(obj.message, MESSAGE_MAX)
  if (message.length === 0) return reject('bad_message')

  const proposal: CoachProposal = { kind: kind as CoachProposalKind, message }

  // adjustments: only for set_adjustment; must be a bounded array of valid items.
  if (kind === 'set_adjustment') {
    const adj = obj.adjustments
    if (!Array.isArray(adj) || adj.length === 0 || adj.length > MAX_ADJUSTMENTS) {
      return reject('bad_adjustments')
    }
    const out: ProposedSetAdjustment[] = []
    for (const item of adj) {
      const v = validateAdjustment(item)
      if (!v) return reject('bad_adjustments') // no partial apply — reject the whole proposal
      out.push(v)
    }
    proposal.adjustments = out
  } else if ('adjustments' in obj && obj.adjustments != null) {
    // adjustments present on a non-adjustment kind → schema violation.
    return reject('bad_adjustments')
  }

  return { ok: true, proposal }
}

function validateAdjustment(item: unknown): ProposedSetAdjustment | null {
  if (item == null || typeof item !== 'object' || Array.isArray(item)) return null
  const o = item as Record<string, unknown>

  if (!isValidId(o.exercise_id)) return null

  const setNumber = sanitizeNumber(o.set_number, { min: 1, max: SET_NUMBER_MAX })
  if (setNumber == null || !Number.isInteger(setNumber)) return null

  const out: ProposedSetAdjustment = {
    exercise_id: o.exercise_id as string,
    set_number: setNumber,
  }

  // Optional numeric fields: if present they must be finite and in range.
  if (o.load_kg != null) {
    const load = sanitizeNumber(o.load_kg, { min: 0, max: LOAD_KG_MAX })
    if (load == null) return null
    out.load_kg = load
  }
  if (o.reps != null) {
    const reps = sanitizeNumber(o.reps, { min: 0, max: REPS_MAX })
    if (reps == null || !Number.isInteger(reps)) return null
    out.reps = reps
  }
  if (o.rir != null) {
    const rir = sanitizeNumber(o.rir, { min: RIR_MIN, max: RIR_MAX })
    if (rir == null || !Number.isInteger(rir)) return null
    out.rir = rir
  }

  return out
}
