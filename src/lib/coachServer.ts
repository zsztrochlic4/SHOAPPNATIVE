import { httpsCallable } from 'firebase/functions'
import { functions, firebaseEnabled } from './firebase'
import type { ContactButton } from '../backend/coach/safety/types'
import type { CoachActionProposal, CoachAnswerMode, CoachCitation, CoachMemory } from '../backend/coach/contracts'

/**
 * Calls the TRUSTED backend coach (`coachMessage`). The crisis/red-flag precheck,
 * the safety classifier, the model call, and the post-response validator all run
 * server-side, so a modified client cannot bypass the safety floor (§4.4). The
 * server is authoritative: it may return a safety BLOCK even when the client's own
 * fast precheck allowed the turn.
 *
 * Throws when Firebase isn't configured or the call fails — the caller then falls
 * back to the on-device rules engine (same guardrails). The coach stays gated by
 * `COACH_ENABLED`; the server returns `failed-precondition/coach_disabled` until
 * that is flipped, which surfaces here as a throw (→ fallback), so nothing about
 * this path changes behaviour while the coach is off.
 */
export interface CoachServerInput {
  message: string
  recent?: string[]
  isAustralia?: boolean
  affectedRegions?: string[]
  engineExcludedExerciseIds?: string[]
  screeningOutcome?: string | null
  usage?: { dateKey: string; count: number }
}

export interface CoachServerResult {
  text: string
  blocked: boolean
  buttons: ContactButton[]
  mode: CoachAnswerMode | 'safety'
  citations: CoachCitation[]
  memory: CoachMemory | null
  proposal: CoachActionProposal | null
}

export async function askCoachServer(input: CoachServerInput): Promise<CoachServerResult> {
  if (!firebaseEnabled || !functions) throw new Error('Coach backend is not configured')
  if (!input.message?.trim()) throw new Error('Empty message')
  // 35s ceiling, above the function's 60s? keep well under the SDK default; a hung
  // backend falls back to the on-device coach rather than hanging the chat.
  const call = httpsCallable<CoachServerInput, CoachServerResult>(functions, 'coachMessage', { timeout: 40_000 })
  const res = await call(input)
  return res.data
}
