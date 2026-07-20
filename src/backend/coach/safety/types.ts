/**
 * Coach Safety Guardrails — shared types (single source of truth for BOTH coach paths).
 *
 * Implements the architecture of "Coach Safety Guardrail Specification v12":
 * a pre-response safety ROUTER (high-recall rules + a validated classifier) feeds a
 * deterministic safety STATE MACHINE the coaching model cannot override; fixed RESPONSES
 * are used for enforced tiers; a post-response VALIDATOR inspects the outgoing message.
 *
 * This layer NEVER re-implements injury/age/screening/exercise-safety logic — that lives in
 * the reviewed workout engine and is called through `engineBridge.ts`. This layer only adds
 * the CONVERSATIONAL safety the engine never had (crisis, disordered eating, meal plans,
 * medical emergencies, PEDs, pregnancy, concussion, harm-to-others, etc.).
 *
 * The coach ships DISABLED (coachGate.COACH_ENABLED === false). Nothing here enables it.
 */

/* ------------------------------------------------------------------ */
/*  Categories, tiers, actions                                         */
/* ------------------------------------------------------------------ */

/** Every guardrail the router can assign. `none` = no safety signal → normal coaching. */
export type SafetyCategory =
  | 'immediate_danger'        // self-harm intent/plan now (spec §3 tier 1)
  | 'crisis_concern'          // hopelessness / self-harm ideation (spec §3 tier 2)
  | 'third_party_crisis'      // someone else at risk (spec §3)
  | 'harm_to_others'          // credible imminent threat to another (spec §10)
  | 'medical_emergency'       // 000 red-flags: chest pain, collapse, neuro, heatstroke, severe asthma, unconscious hypo (spec §6/§7)
  | 'overdose_poisoning'      // took far too much of a substance (spec §10)
  | 'medical_urgent'          // injury/pain/swelling, concussion, rhabdo, conscious hypo, non-severe asthma (spec §6/§9)
  | 'injury_override'         // known injury + wants to load/train the area (spec §6)
  | 'pregnancy'               // pregnancy / postpartum (spec §8)
  | 'medical_condition'       // known condition / medication affecting exercise safety (spec §7)
  | 'disordered_eating'       // meal-skipping, purging, severe restriction, distress (spec §4)
  | 'rapid_weight_loss'       // rapid/large loss or intense/clinical diet question (spec §4)
  | 'meal_plan'               // any personalised meal plan / macro targets (spec §5)
  | 'steroids_ped'            // anabolic steroids / PEDs / SARMs / PCT (spec §11)
  | 'supplement_dosing'       // personalised supplement dose / stimulant stacking (spec §11)
  | 'under_18'                // user states/indicates <18 in-conversation (spec §14)
  | 'unsafe_training'         // overtraining, bypass limits, training while unwell/impaired (spec §15)
  | 'prescribed_medication'   // "should I stop my prescribed meds" (spec §11 boundary)
  | 'ai_relationship'         // claim-to-be-human / dependence / romance (spec §17)
  | 'off_topic'               // out of the fitness lane (spec §12)
  | 'catch_all'               // uncovered health/symptom/condition → default caution (spec §13)
  | 'none'

/**
 * Severity rank. Higher wins when two detectors/categories disagree
 * ("highest applicable safety tier always wins", spec §2/§13).
 */
export const CATEGORY_TIER: Record<SafetyCategory, number> = {
  immediate_danger: 100,
  medical_emergency: 95,
  harm_to_others: 92,
  overdose_poisoning: 90,
  crisis_concern: 88,
  third_party_crisis: 80,
  medical_urgent: 70,
  injury_override: 66,
  pregnancy: 64,
  medical_condition: 62,
  under_18: 60,
  disordered_eating: 58,
  steroids_ped: 50,
  rapid_weight_loss: 46,
  meal_plan: 44,
  prescribed_medication: 42,
  supplement_dosing: 40,
  unsafe_training: 36,
  ai_relationship: 30,
  catch_all: 20,
  off_topic: 10,
  none: 0,
}

/** What the coach layer does with a message once a category is assigned. */
export type SafetyAction =
  | 'block_emergency'      // fixed 000 response, no AI, tap-to-call 000
  | 'block_crisis'         // fixed Lifeline/SCBS response, no AI
  | 'block_third_party'    // fixed third-party response, no AI
  | 'block_poisons'        // fixed Poisons Information Centre response, no AI
  | 'refer'                // decline + warm referral (no coaching on the topic)
  | 'suspend'              // coach unavailable (under-18)
  | 'service_unavailable'  // fail-safe: classification unavailable → neutral screen + crisis options
  | 'allow'               // proceed to coaching (still post-validated)

/** A persistent operational safety state (spec §2 table). Some span sessions. */
export type PersistentState =
  | 'crisis'
  | 'injury'
  | 'pregnancy'
  | 'concussion'
  | 'medical_condition'
  | 'under_18'
  | 'disordered_eating'
  | 'overdose'
  | 'emergency'

/** Which categories set a persistent state, and whether that state crosses sessions. */
export const PERSISTENT_FOR: Partial<Record<SafetyCategory, PersistentState>> = {
  immediate_danger: 'crisis',
  crisis_concern: 'crisis',
  injury_override: 'injury',
  medical_urgent: 'injury', // concussion/rhabdo refine below
  pregnancy: 'pregnancy',
  medical_condition: 'medical_condition',
  under_18: 'under_18',
  disordered_eating: 'disordered_eating',
  // Acute safety states persist for the conversation and are NOT cleared by a bare minimisation —
  // only the router's genuine-correction logic can clear them (spec §2/§14; Jack §2).
  overdose_poisoning: 'overdose',
  medical_emergency: 'emergency',
  harm_to_others: 'emergency',
}

/** States that persist ACROSS sessions until an appropriate resolution (spec §2). */
export const CROSS_SESSION_STATES: PersistentState[] = [
  'injury', 'pregnancy', 'concussion', 'medical_condition', 'under_18',
]

/* ------------------------------------------------------------------ */
/*  Router decision + context                                          */
/* ------------------------------------------------------------------ */

export interface DetectorHit {
  category: SafetyCategory
  /** Which detector fired — used to log agreement/disagreement. */
  source: 'rules' | 'classifier' | 'state' | 'engine'
  /** Machine-readable reason (never the user's raw text — keep logs content-free). */
  reason: string
}

/**
 * A record that a rules-detected category was SUPPRESSED (not flagged) by a scoping rule
 * (third-party / historical / negation / topical). Content-free (category + rule name only). Jack
 * round-3 requirement: every no-flag decision is auditable — you can see WHY something wasn't flagged.
 */
export interface Suppression {
  category: SafetyCategory
  /** The scoping rule that suppressed it, e.g. 'third_party_subject', 'historical_resolved'. */
  rule: string
}

export interface SafetyDecision {
  category: SafetyCategory
  tier: number
  action: SafetyAction
  /** Key into the fixed-response table; null when action === 'allow'. */
  responseKey: string | null
  /** True only for `none` (or a per-state re-engagement allowance). */
  allowCoaching: boolean
  /** All detectors that contributed, for the audit trail (content-free). */
  hits: DetectorHit[]
  /** Highest-tier detector's reason, for logging by tier. */
  reason: string
  /** Scoping suppressions applied this turn (audit trail for no-flag decisions). Jack §3-log. */
  suppressions?: Suppression[]
}

/**
 * The minimal, read-only context the safety layer needs. Populated by the wiring from
 * AppState (the stored UserDoc / profile). The safety layer NEVER writes it back and
 * NEVER re-derives injury/age/screening from raw inputs — it asks `engineBridge`.
 */
export interface CoachContext {
  /** Stored DOB (ISO) from onboarding — the engine derives age/eligibility from it. */
  dateOfBirth: string | null
  /** Affected injury regions as stored by onboarding (engine owns the meaning). */
  affectedRegions: string[]
  /** Stored screening outcome, if any (engine owns it). */
  screeningOutcome: string | null
  /** Exercise ids the engine excluded for this user (injury/safety) — coach must not re-add. */
  engineExcludedExerciseIds: string[]
  /** Locale of the user; the coach only serves AU support numbers to AU users (spec §20). */
  isAustralia: boolean
}

/* ------------------------------------------------------------------ */
/*  Safety session (state machine)                                     */
/* ------------------------------------------------------------------ */

export interface SafetySession {
  /** States active for THIS conversation (crisis, disordered_eating, etc.). */
  active: Set<PersistentState>
  /** Cross-session states carried in from operational storage (injury, under_18, …). */
  carriedOver: Set<PersistentState>
  /** The last enforced decision, for re-engagement / retraction logic. */
  lastDecision: SafetyDecision | null
}

export function newSafetySession(carriedOver: PersistentState[] = []): SafetySession {
  return { active: new Set(), carriedOver: new Set(carriedOver), lastDecision: null }
}

/* ------------------------------------------------------------------ */
/*  Fixed response shape                                               */
/* ------------------------------------------------------------------ */

export type ContactAction = 'call' | 'text'

export interface ContactButton {
  label: string
  action: ContactAction
  /** Phone number, digits only where possible (tap-to-call), e.g. '000', '131114'. */
  value: string
}

export interface FixedResponse {
  /** The exact, warm, fixed text (spec §3/§4/… illustrative wording). */
  text: string
  /** Actionable tap-to-call / tap-to-text buttons (spec §20). Never text-only for crisis. */
  buttons: ContactButton[]
  /** True → the coaching model / fallback rules MUST NOT run for this message. */
  noAI: boolean
}

/** The public outcome the wiring acts on. */
export type GuardOutcome =
  | { outcome: 'block'; decision: SafetyDecision; response: FixedResponse }
  | { outcome: 'allow'; decision: SafetyDecision }
