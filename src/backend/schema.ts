/**
 * Firestore document schemas — the dynamic side of the workout backend.
 *
 * Source of truth: workbook sheet "Data Schemas" (docs/spec/sheets/28_Data_Schemas.tsv).
 * The static workbook (exercises, rules) plus these collections is the complete backend.
 * Field names here are the contract between the app, the generator and the AI layer —
 * do not rename without updating the sheet.
 *
 * Canonical rule: a `users` document is written ONLY through the onboarding mapping
 * module (src/backend/mapping/onboardingContract.ts). The app's local `Profile` is a
 * one-directional, read-only projection of it and never writes back.
 */

/* ------------------------------------------------------------------ */
/*  Canonical value vocabularies (the stored, backend-facing values)   */
/* ------------------------------------------------------------------ */

export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
export const WEEKDAYS: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Onboarding "Build muscle / Lose fat / Get stronger / Stay healthy" → these. */
export type BackendGoal = 'Hypertrophy' | 'Fat Loss' | 'Strength' | 'General Fitness'

export type BackendExperience = 'Beginner' | 'Intermediate' | 'Advanced'

/** Coarse equipment tier (Exercise Database filter). Bodyweight ⊂ Basic Gym ⊂ Full Gym. */
export type EquipmentTier = 'Full Gym' | 'Basic Gym' | 'Bodyweight'

export type Sex = 'male' | 'female' | 'other'

/** "Do you usually train alone?" — Always/Usually fire Safety Rule S09. */
export type TrainsAlone = 'always' | 'usually' | 'sometimes' | 'never'

/** The six regions that have an Injury Modifications row (affected_regions[]). */
export type InjuryRegion = 'lower_back' | 'knee' | 'shoulder' | 'wrist' | 'hip' | 'ankle'
export const INJURY_REGIONS: InjuryRegion[] = ['lower_back', 'knee', 'shoulder', 'wrist', 'hip', 'ankle']

/** Focal points as the Session Templates FOCAL_1/FOCAL_2 tokens (max 2). */
export type FocalPoint =
  | 'Chest' | 'Back' | 'Shoulders' | 'Quads' | 'Hamstrings & Glutes'
  | 'Biceps' | 'Triceps' | 'Core' | 'Calves'

export type Intensity = 'easy' | 'moderate' | 'hard'

/** External Commitments commitment_type (fixed weekly activities). */
export type CommitmentType =
  | 'basketball' | 'football' | 'running' | 'tennis' | 'swimming' | 'cycling'
  | 'dance' | 'martial_arts' | 'rock_climbing' | 'gym_classes' | 'walking_hiking'
  | 'rowing' | 'yoga_pilates' | 'golf' | 'skating' | 'surfing' | 'active_job' | 'other'

export type DietToken =
  | 'no_restrictions' | 'vegetarian' | 'vegan' | 'halal' | 'dairy_free' | 'gluten_free' | 'high_protein'

/* ------------------------------------------------------------------ */
/*  Screening (Screening Outcomes + Age Routing sheets)                */
/* ------------------------------------------------------------------ */

export type ScreeningOutcome =
  | 'CLEAR'
  | 'MODIFY_AND_CONTINUE'
  | 'REQUIRE_PROFESSIONAL_CLEARANCE'
  | 'DO_NOT_GENERATE'

export type ScreeningVersion = 'adult_v1' | 'none'

/** The 7 pre-exercise screening answers (q1..q7), true = "Yes". */
export interface ScreeningAnswers {
  q1: boolean // heart condition / supervised-exercise advice
  q2: boolean // chest pain during activity
  q3: boolean // chest pain at rest (past month)  → DO_NOT_GENERATE
  q4: boolean // dizziness / loss of consciousness
  q5: boolean // bone/joint/soft-tissue problem → joint follow-ups
  q6: boolean // pregnant / birth within 6 months
  q7: boolean // any other reason not to exercise
}

/** Joint follow-ups (asked when q5 = Yes OR an injury chip is flagged — B1). */
export interface ScreeningFollowups {
  painful_now?: boolean          // f1
  under_treatment?: boolean      // f2
  exercise_restricted?: boolean  // f3
  status?: 'resolved' | 'active' | 'unsure' // f4
  aggravating_movements?: string[] // "which movements make it worse"
}

export interface ScreeningRecord {
  version: ScreeningVersion
  outcome: ScreeningOutcome
  answers: Partial<ScreeningAnswers>
  followups: ScreeningFollowups
  guardian_consent: boolean
  clearance_confirmed: boolean
  date: string // ISO date the screen was completed
  conditions: string[] // any conditions a professional set on clearance
  waiver_accepted: boolean
}

/* ------------------------------------------------------------------ */
/*  Sub-objects                                                        */
/* ------------------------------------------------------------------ */

export interface Commitment {
  day: Weekday
  commitment_type: CommitmentType
  intensity: Intensity
  /** free text when commitment_type = 'other', for AI classification */
  raw?: string
}

export type AbsenceMode =
  | 'full_pause' | 'maintenance' | 'minimal_movement' | 'reduced_frequency' | 'active_rest' | 'no_change'

export type AbsenceStatus = 'scheduled' | 'active' | 'completed' | 'cancelled'

export interface PlannedAbsence {
  absence_id: string
  start_date: string // ISO
  end_date: string   // ISO
  mode_id: AbsenceMode
  note?: string
  status: AbsenceStatus
}

/* ------------------------------------------------------------------ */
/*  Collection: users                                                  */
/* ------------------------------------------------------------------ */

export interface UserDoc {
  uid: string
  display_name: string
  /** Raw date of birth, ISO 'YYYY-MM-DD'. NEVER defaulted (Age Routing). */
  date_of_birth: string | null
  /** True once a real DOB is present; false blocks generation (unverified). */
  age_verified: boolean
  sex: Sex | null
  height_cm: number
  weight_kg: number
  goal_weight_kg: number
  experience: BackendExperience
  goal: BackendGoal
  /** M1: stored so the generator applies Safety P01 consistently. */
  followed_structured_program: boolean | null
  focal_points: FocalPoint[] // max 2
  days_available: Weekday[]   // gym days only; editable post-onboarding
  session_length_min: number
  equipment_tier: EquipmentTier
  equipment_tags: string[]
  /** Always/Usually → Safety Rule S09 (spotter). */
  trains_alone: TrainsAlone | null
  excluded_exercise_ids: string[]
  preferred_exercise_ids: string[]
  affected_regions: InjuryRegion[]
  commitments: Commitment[]
  screening: ScreeningRecord
  /** Nutrition-only, infer_ok (M2): defaulted here, refined later in-app. */
  diet: DietToken[]
  tight_budget: boolean
  motivation: string | null
  /** Free-text "anything else"; scanned for red-flags (CC06) before trust. */
  notes: string | null
  planned_absences: PlannedAbsence[]
  created_at: string // ISO
  schema_version: number
}

/* ------------------------------------------------------------------ */
/*  Collection: programs                                               */
/* ------------------------------------------------------------------ */

export type DayType = string // e.g. 'Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Cond', 'Rest'

export interface ProgramDoc {
  program_id: string
  uid: string
  version: number
  split_id: string | null
  day_structure: string // pipe-separated day types
  custom: boolean
  schedule: Partial<Record<Weekday, DayType>>
  created_at: string
  active: boolean
  superseded_by: string | null
  generation_audit: { step: number; rule_ids_applied: string[]; choices: string[] }[]
}

/* ------------------------------------------------------------------ */
/*  Collection: workout_instances                                      */
/* ------------------------------------------------------------------ */

export type MeasurementType = 'weight_reps' | 'reps' | 'duration' | 'interval' | 'assisted'

export type InstanceStatus = 'planned' | 'done' | 'partial' | 'missed' | 'shifted'

export interface PrescribedExercise {
  slot_id: string
  exercise_id: string
  substituted_from: string | null
  measurement_type: MeasurementType
  sets: number
  reps_min?: number
  reps_max?: number
  duration_sec?: number
  work_sec?: number
  rest_sec?: number
  rounds?: number
  distance_m?: number
  load_kg_target?: number
  load_unit?: string
  assistance_kg?: number
  bodyweight_added_kg?: number
  band_level?: string
  tempo?: string
  side?: string
  rir_min: number
}

export interface WorkoutInstanceDoc {
  instance_id: string
  program_id: string
  uid: string
  scheduled_date: string // ISO
  day_type: DayType
  status: InstanceStatus
  exercises: PrescribedExercise[]
}

/* ------------------------------------------------------------------ */
/*  Collection: set_logs                                               */
/* ------------------------------------------------------------------ */

export interface SetLogDoc {
  log_id: string
  instance_id: string
  uid: string
  exercise_id: string
  set_number: number
  measurement_type: MeasurementType
  load_kg?: number
  load_unit?: string
  reps_done?: number
  duration_sec_done?: number
  work_sec_done?: number
  rounds_done?: number
  distance_m_done?: number
  assistance_kg?: number
  band_level?: string
  tempo?: string
  side?: string
  rir_reported?: number
  timestamp: string // ISO
  pain_flag: boolean
  stop_symptom: boolean
}

/* ------------------------------------------------------------------ */
/*  Collection: progression_state  (doc id: `${uid}_${exerciseId}`)    */
/* ------------------------------------------------------------------ */

export interface ProgressionStateDoc {
  uid: string
  exercise_id: string
  current_load_kg: number
  current_rep_target: number
  last_progressed_at: string | null
  sessions_at_current: number
  stall_count: number
  deload_count: number
}

/* ------------------------------------------------------------------ */
/*  Collection: swap_history                                           */
/* ------------------------------------------------------------------ */

export type SwapReason = 'dislike' | 'equipment' | 'pain' | 'skill'

export interface SwapHistoryDoc {
  uid: string
  events: { from_id: string; to_id: string; reason: SwapReason; date: string }[]
}

/* ------------------------------------------------------------------ */
/*  Collection: flags                                                  */
/* ------------------------------------------------------------------ */

export interface FlagsDoc {
  uid: string
  stop_symptom_events: { symptom: string; date: string; resolved: boolean; cleared_by_professional: boolean }[]
  deload_history: string[] // dates
  missed_streaks: Partial<Record<Weekday, number>>
}

/** Bump when UserDoc shape changes so reads can migrate. */
export const BACKEND_SCHEMA_VERSION = 1
