/**
 * Shared product contracts for the persistent, data-aware StrengthHub coach.
 * These types are deliberately platform-neutral so the app and trusted backend
 * agree on one bounded schema.
 */

export type CoachAnswerMode = 'general' | 'personalised' | 'app_help'
export type CoachMemoryStatus = 'confirmed' | 'observation' | 'hypothesis' | 'pending'
export type CoachMemorySensitivity = 'ordinary' | 'sensitive'

export interface CoachMemory {
  id: string
  category: string
  value: string
  status: CoachMemoryStatus
  confidence: number
  source: 'user_statement' | 'onboarding' | 'app_record' | 'coach_observation'
  evidenceRef: string
  scope: 'stable' | 'current_program' | 'current_period' | 'current_week' | 'current_session'
  sensitivity: CoachMemorySensitivity
  visible: boolean
  createdAt: string
  updatedAt: string
  expiresAt?: string
}

export interface CoachWorkspaceSummary {
  schemaVersion: number
  consentVersion: number | null
  memoryEnabled: boolean
  proactiveEnabled: boolean
  coachingStyle: 'supportive' | 'direct' | 'balanced'
  memories: CoachMemory[]
  updatedAt: string | null
}

export type CoachProposalKind = 'none' | 'navigation' | 'memory' | 'workout_action'

export interface CoachActionProposal {
  id: string
  kind: Exclude<CoachProposalKind, 'none'>
  title: string
  summary: string
  status: 'pending' | 'confirmed' | 'rejected' | 'expired'
  payload: Record<string, string | number | boolean>
  createdAt: string
  expiresAt: string
}

export interface CoachCitation {
  sourceKey: string
  title: string
}

export interface CoachMemoryCandidate {
  category: string
  value: string
  evidenceQuote: string
  scope: CoachMemory['scope']
  sensitivity: CoachMemorySensitivity
}

export interface StructuredCoachReply {
  mode: CoachAnswerMode
  message: string
  citations: CoachCitation[]
  memory: CoachMemoryCandidate | null
  proposal: {
    kind: CoachProposalKind
    title?: string
    summary?: string
    payload?: Record<string, string | number | boolean>
  }
}
