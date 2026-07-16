/**
 * Onboarding → backend mapping — the ONE deterministic lookup.
 *
 * Source of truth: workbook sheets "Onboarding Contract" (29) and "Onboarding Questions"
 * (00). This module is the single place onboarding answers become stored `users` values,
 * shared by the wizard and the generator. No AI inference in this path: identical answers
 * always produce identical values.
 *
 * `buildUserDoc` is the ONLY constructor of a canonical `UserDoc`. The app's local
 * Profile is derived from the result (see projection.ts) and never writes back.
 */

import {
  BACKEND_SCHEMA_VERSION,
  type BackendExperience, type BackendGoal, type Commitment, type CommitmentType,
  type DietToken, type EquipmentTier, type FocalPoint, type InjuryRegion, type Intensity,
  type ScreeningAnswers, type ScreeningFollowups, type Sex, type TrainsAlone,
  type UserDoc, type Weekday, WEEKDAYS,
} from '../schema'
import { ageFromDob, routeByAge } from '../safety/ageRouting'
import { evaluateScreening } from '../safety/screening'

/* ------------------------------------------------------------------ */
/*  Raw onboarding answer shape (the wizard's vocabulary)              */
/* ------------------------------------------------------------------ */

export interface OnboardingInput {
  uid: string
  name: string
  dob: string // 'YYYY-MM-DD' ('' = not provided)
  guardianConsent: boolean
  sex: 'male' | 'female' | 'other' | ''
  height: number
  weight: number
  goalWeight: number
  noGoalWeight: boolean
  goal: 'build' | 'lose' | 'strong' | 'healthy' | ''
  focus: string[] // FOCUS_OPTIONS labels
  experience: 'beginner' | 'intermediate' | 'advanced' | ''
  structured: 'yes' | 'no' | '' // M1
  days: string[] // full weekday names
  session: number
  alone: 'always' | 'usually' | 'sometimes' | 'never' | ''
  environment: 'gym' | 'home' | 'bodyweight' | ''
  equipment: string[] // equipment chip labels
  trainAround: string[] // injury region chip labels
  moreInfo: string
  activities: string[]
  activityOther: string
  activityDetail: Record<string, { days: string[]; intensity?: Intensity }>
  loveExercises: string[] // names (resolved to ids via opts, see M3)
  avoidExercises: string[]
  motivation: string
  safety: Record<string, 'yes' | 'no'>
  followup: Record<string, string>
  movements: string[]
  movementsOther: string
  terms: boolean
}

export interface BuildOptions {
  /** CC06 free-text red-flag scan result on `moreInfo` (default false). */
  redFlag?: boolean
  now?: Date
  createdAt?: string
  /** infer_ok (M2): defaulted here, refined in-app later. */
  diet?: DietToken[]
  tightBudget?: boolean
  /** M3: resolved Exercise Database ids for love/avoid (pending the resolver). */
  preferredExerciseIds?: string[]
  excludedExerciseIds?: string[]
  /** Existing screening clearance state, if re-building after a professional cleared. */
  clearanceConfirmed?: boolean
  clearanceConditions?: string[]
}

/* ------------------------------------------------------------------ */
/*  Deterministic lookups                                              */
/* ------------------------------------------------------------------ */

export const GOAL_MAP: Record<Exclude<OnboardingInput['goal'], ''>, BackendGoal> = {
  build: 'Hypertrophy',
  lose: 'Fat Loss',
  strong: 'Strength',
  healthy: 'General Fitness',
}

export const EXPERIENCE_MAP: Record<Exclude<OnboardingInput['experience'], ''>, BackendExperience> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export const EQUIPMENT_TIER_MAP: Record<Exclude<OnboardingInput['environment'], ''>, EquipmentTier> = {
  gym: 'Full Gym',
  home: 'Basic Gym',
  bodyweight: 'Bodyweight',
}

/** Focal chip → Session Templates focal token(s). Arms expands to two. */
export const FOCAL_MAP: Record<string, FocalPoint[]> = {
  Chest: ['Chest'],
  Back: ['Back'],
  Shoulders: ['Shoulders'],
  Arms: ['Biceps', 'Triceps'],
  Legs: ['Quads'],
  Glutes: ['Hamstrings & Glutes'],
  Core: ['Core'],
  Abs: ['Core'],
}

/** Injury chip → the region token that has an Injury Modifications row. */
export const REGION_MAP: Record<string, InjuryRegion | null> = {
  'Lower back': 'lower_back',
  Knees: 'knee',
  Shoulders: 'shoulder',
  Wrists: 'wrist',
  Hips: 'hip',
  Ankles: 'ankle',
  // Contract's wider list, mapped for future-proofing (repo doesn't collect these yet):
  'Achilles or calf': 'ankle',
  Neck: null,
  Elbows: null,
  Feet: null,
}

/** Activity chip → External Commitments commitment_type. */
export const COMMITMENT_TYPE_MAP: Record<string, CommitmentType> = {
  Basketball: 'basketball',
  Football: 'football',
  Running: 'running',
  Tennis: 'tennis',
  Swimming: 'swimming',
  Cycling: 'cycling',
  Dance: 'dance',
  'Martial arts': 'martial_arts',
  Climbing: 'rock_climbing',
  'Rock climbing': 'rock_climbing',
  'Gym classes': 'gym_classes',
  'Walking or hiking': 'walking_hiking',
  'Walking/hiking': 'walking_hiking',
  Rowing: 'rowing',
  'Yoga or Pilates': 'yoga_pilates',
  'Yoga/Pilates': 'yoga_pilates',
  Golf: 'golf',
  Skating: 'skating',
  Surfing: 'surfing',
  'Active job': 'active_job',
  Other: 'other',
}

/** Equipment chip → canonical equipment tag id. */
export const EQUIPMENT_TAG_MAP: Record<string, string> = {
  'Squat rack': 'squat_rack',
  Barbell: 'barbell',
  'Barbell+plates': 'barbell',
  Dumbbells: 'dumbbell',
  'Bench or chair': 'bench',
  'Pull-up bar': 'pullup_bar',
  'Resistance bands': 'band',
  Kettlebell: 'kettlebell',
  'Sliders or a towel': 'sliders',
}

/** Tier-implied base tags before the user's ticked extras (Onboarding Contract). */
const TIER_BASE_TAGS: Record<EquipmentTier, string[]> = {
  'Full Gym': ['barbell', 'squat_rack', 'dumbbell', 'bench', 'pullup_bar', 'band', 'kettlebell', 'cable', 'machine'],
  'Basic Gym': ['dumbbell', 'band', 'bench'],
  Bodyweight: [],
}

/* ------------------------------------------------------------------ */
/*  Field mappers (each deterministic, exported for reuse/testing)     */
/* ------------------------------------------------------------------ */

export function mapGoal(goal: OnboardingInput['goal']): BackendGoal {
  return goal ? GOAL_MAP[goal] : 'General Fitness'
}

export function mapExperience(exp: OnboardingInput['experience']): BackendExperience {
  return exp ? EXPERIENCE_MAP[exp] : 'Beginner'
}

export function mapEquipmentTier(env: OnboardingInput['environment']): EquipmentTier {
  return env ? EQUIPMENT_TIER_MAP[env] : 'Full Gym'
}

export function mapSex(sex: OnboardingInput['sex']): Sex | null {
  return sex || null
}

export function mapTrainsAlone(alone: OnboardingInput['alone']): TrainsAlone | null {
  return alone || null
}

/** Expand focal chips to tokens, dedupe, cap at 2 (Session Templates FOCAL_1/2). */
export function mapFocalPoints(focus: string[]): FocalPoint[] {
  const out: FocalPoint[] = []
  for (const chip of focus) {
    for (const token of FOCAL_MAP[chip] ?? []) {
      if (!out.includes(token)) out.push(token)
    }
  }
  return out.slice(0, 2)
}

export function mapAffectedRegions(trainAround: string[]): InjuryRegion[] {
  const out: InjuryRegion[] = []
  for (const chip of trainAround) {
    if (chip === 'None') continue
    const region = REGION_MAP[chip]
    if (region && !out.includes(region)) out.push(region)
  }
  return out
}

export function mapDaysAvailable(days: string[]): Weekday[] {
  return WEEKDAYS.filter((d) => days.includes(d))
}

export function mapEquipmentTags(env: OnboardingInput['environment'], equipment: string[]): string[] {
  const tier = mapEquipmentTier(env)
  const tags = new Set<string>(TIER_BASE_TAGS[tier])
  for (const chip of equipment) {
    const tag = EQUIPMENT_TAG_MAP[chip]
    if (tag) tags.add(tag)
  }
  return [...tags]
}

/** Expand grouped activityDetail into one Commitment per day. */
export function mapCommitments(input: OnboardingInput): Commitment[] {
  const out: Commitment[] = []
  for (const activity of input.activities) {
    if (activity === 'None') continue
    const detail = input.activityDetail[activity]
    if (!detail || !detail.days?.length) continue // step skippable (CC04): no detail → no commitment
    const type = COMMITMENT_TYPE_MAP[activity] ?? 'other'
    const intensity: Intensity = detail.intensity ?? 'moderate'
    for (const day of WEEKDAYS) {
      if (!detail.days.includes(day)) continue
      out.push({
        day,
        commitment_type: type,
        intensity,
        ...(type === 'other' ? { raw: input.activityOther || activity } : {}),
      })
    }
  }
  return out
}

const YN = (v: string | undefined): boolean => v === 'yes'

export function mapScreeningAnswers(safety: Record<string, 'yes' | 'no'>): Partial<ScreeningAnswers> {
  return {
    q1: YN(safety.s1), q2: YN(safety.s2), q3: YN(safety.s3), q4: YN(safety.s4),
    q5: YN(safety.s5), q6: YN(safety.s6), q7: YN(safety.s7),
  }
}

export function mapFollowups(followup: Record<string, string>, movements: string[]): ScreeningFollowups {
  const status = followup.f4 === 'active' || followup.f4 === 'resolved' || followup.f4 === 'unsure'
    ? (followup.f4 as ScreeningFollowups['status'])
    : undefined
  return {
    painful_now: followup.f1 ? YN(followup.f1) : undefined,
    under_treatment: followup.f2 ? YN(followup.f2) : undefined,
    exercise_restricted: followup.f3 ? YN(followup.f3) : undefined,
    status,
    aggravating_movements: movements.length ? movements : undefined,
  }
}

export function mapStructured(structured: OnboardingInput['structured']): boolean | null {
  if (structured === 'yes') return true
  if (structured === 'no') return false
  return null
}

/* ------------------------------------------------------------------ */
/*  The single UserDoc constructor                                     */
/* ------------------------------------------------------------------ */

export function buildUserDoc(input: OnboardingInput, opts: BuildOptions = {}): UserDoc {
  const now = opts.now ?? new Date()
  const createdAt = opts.createdAt ?? now.toISOString()

  const dob = input.dob || null
  const age = ageFromDob(dob, now)
  const route = routeByAge(dob, input.guardianConsent, now)

  const affectedRegions = mapAffectedRegions(input.trainAround)
  const answers = mapScreeningAnswers(input.safety)
  const followups = mapFollowups(input.followup, input.movements)
  const screening = evaluateScreening({
    answers,
    followups,
    affectedRegions,
    redFlag: opts.redFlag ?? false,
  })

  return {
    uid: input.uid,
    display_name: normalizeName(input.name) || 'Athlete',
    date_of_birth: dob,
    age_verified: route.age_verified,
    sex: mapSex(input.sex),
    height_cm: Math.round(input.height),
    weight_kg: round1(input.weight),
    goal_weight_kg: input.noGoalWeight ? round1(input.weight) : round1(input.goalWeight),
    experience: mapExperience(input.experience),
    goal: mapGoal(input.goal),
    followed_structured_program: mapStructured(input.structured),
    focal_points: mapFocalPoints(input.focus),
    days_available: mapDaysAvailable(input.days),
    session_length_min: input.session,
    equipment_tier: mapEquipmentTier(input.environment),
    equipment_tags: mapEquipmentTags(input.environment, input.equipment),
    trains_alone: mapTrainsAlone(input.alone),
    excluded_exercise_ids: opts.excludedExerciseIds ?? [],
    preferred_exercise_ids: opts.preferredExerciseIds ?? [],
    affected_regions: affectedRegions,
    commitments: mapCommitments(input),
    screening: {
      version: route.screening_version,
      outcome: screening.outcome,
      answers,
      followups,
      guardian_consent: input.guardianConsent,
      clearance_confirmed: opts.clearanceConfirmed ?? false,
      date: createdAt,
      conditions: opts.clearanceConditions ?? [],
      waiver_accepted: input.terms === true,
    },
    diet: opts.diet ?? [],
    tight_budget: opts.tightBudget ?? false,
    motivation: input.motivation.trim() || null,
    notes: input.moreInfo.trim() || null,
    planned_absences: [],
    created_at: createdAt,
    schema_version: BACKEND_SCHEMA_VERSION,
  }
}

/**
 * The generation gate: is this user allowed a program right now? Combines Age Routing
 * (block/consent) with the screening outcome (S05). The generator must call this at
 * Generator Flow step 1 and refuse to build anything when it returns false.
 */
export function canGenerate(user: UserDoc): { ok: boolean; reason: string | null } {
  const route = routeByAge(user.date_of_birth, user.screening.guardian_consent)
  if (route.blocked) return { ok: false, reason: `age_${route.band}` }
  if (user.screening.outcome === 'DO_NOT_GENERATE') return { ok: false, reason: 'screening_do_not_generate' }
  if (user.screening.outcome === 'REQUIRE_PROFESSIONAL_CLEARANCE' && !user.screening.clearance_confirmed) {
    return { ok: false, reason: 'screening_require_clearance' }
  }
  if (!user.screening.waiver_accepted) return { ok: false, reason: 'waiver_not_accepted' }
  return { ok: true, reason: null }
}

/* ------------------------------------------------------------------ */
/*  Small shared helpers                                               */
/* ------------------------------------------------------------------ */

export function normalizeName(raw: string): string {
  if (!raw) return ''
  return raw.trim().replace(/\s+/g, ' ').split(' ').map((w) =>
    w.split('-').map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p)).join('-'),
  ).join(' ')
}

const round1 = (n: number) => Math.round(n * 10) / 10

export { ageFromDob }
