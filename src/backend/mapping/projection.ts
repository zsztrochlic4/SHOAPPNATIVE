/**
 * Canonical UserDoc → local app Profile projection.
 *
 * ONE-DIRECTIONAL and deterministic: the Firestore `users` document (built only by
 * onboardingContract.buildUserDoc) is the source of truth; the app's local `Profile`
 * is a read-only view derived from it for the screens that already consume that shape.
 * Nothing here ever writes back to the canonical doc, so the local view can never drift.
 *
 * Source of truth for field meaning: workbook "Data Schemas" + the app's store/types.
 */

import type { Equipment, Experience, Goal, Profile } from '../../store/types'
import type { BackendExperience, BackendGoal, EquipmentTier, InjuryRegion, Sex, UserDoc } from '../schema'

/** Reverse of onboardingContract GOAL_MAP. */
const GOAL_TO_STORE: Record<BackendGoal, Goal> = {
  Hypertrophy: 'build-muscle',
  'Fat Loss': 'lose-fat',
  Strength: 'gain-strength',
  'General Fitness': 'stay-healthy',
}

const EXPERIENCE_TO_STORE: Record<BackendExperience, Experience> = {
  Beginner: 'beginner',
  Intermediate: 'intermediate',
  Advanced: 'advanced',
}

const TIER_TO_STORE: Record<EquipmentTier, Equipment> = {
  'Full Gym': 'full-gym',
  'Basic Gym': 'home-basic',
  Bodyweight: 'dorm-bodyweight',
}

const REGION_LABEL: Record<InjuryRegion, string> = {
  lower_back: 'lower back',
  knee: 'knees',
  shoulder: 'shoulders',
  wrist: 'wrists',
  hip: 'hips',
  ankle: 'ankles',
}

/**
 * APP-WIDE RULE — no calorie or nutritional goals.
 *
 * StrengthHub deliberately does NOT set calorie or macro targets for users (no
 * "hit 2600 kcal", no protein/carb/fat goals). Numeric intake targets can be
 * harmful for our audience, so we never prescribe them. Nutrition is handled
 * qualitatively (the balanced-plate guide + "how did your eating go?" check-in),
 * and the food log shows what was eaten as a descriptive estimate only — never
 * measured against a goal.
 *
 * This function is kept for shape/compatibility but returns zeros for every
 * target. Do not reintroduce non-zero numbers here (or anywhere) without an
 * explicit product decision to reverse this rule.
 */
export function nutritionTargets(_goal: Goal): Pick<Profile, 'calorieTarget' | 'proteinTarget' | 'carbTarget' | 'fatTarget'> {
  return { calorieTarget: 0, proteinTarget: 0, carbTarget: 0, fatTarget: 0 }
}

/**
 * Default daily sleep + water goals, pulled through from onboarding.
 *
 * Sleep: 8 hours for everyone. Water: 2.6 L for women, 3 L for men or other
 * (a null/unknown sex falls back to the higher 3 L default). These are just the
 * starting defaults — the user can override both later in Edit Goals.
 */
export function defaultHealthGoals(sex: Sex | null): Pick<Profile, 'sleepTargetH' | 'waterTargetL'> {
  return { sleepTargetH: 8, waterTargetL: sex === 'female' ? 2.6 : 3 }
}

function injuriesString(user: UserDoc): string {
  const regions = user.affected_regions.map((r) => REGION_LABEL[r]).filter(Boolean)
  const parts = [regions.length ? regions.join(', ') : '', user.notes?.trim() ?? '']
  return parts.filter(Boolean).join('. ')
}

/**
 * Derive the local Profile fields from the canonical user document. Returns the same
 * subset onboarding previously produced, so `COMPLETE_ONBOARDING` behaves identically —
 * only the source has changed (canonical doc, not ad-hoc answer reads).
 */
export function deriveLocalProfile(user: UserDoc): Partial<Profile> {
  const goal = GOAL_TO_STORE[user.goal]
  const age = ageFromIso(user.date_of_birth)
  const profile: Partial<Profile> = {
    name: user.display_name,
    goal,
    experience: EXPERIENCE_TO_STORE[user.experience],
    daysPerWeek: user.days_available.length || 3,
    sessionMinutes: user.session_length_min,
    equipment: TIER_TO_STORE[user.equipment_tier],
    newToGym: user.experience === 'Beginner',
    heightCm: user.height_cm,
    startWeightKg: user.weight_kg,
    goalWeightKg: user.goal_weight_kg,
    injuries: injuriesString(user),
    motivation: user.motivation ?? '',
    budgetMode: user.tight_budget,
    dietaryPrefs: user.diet,
    createdAtKey: (user.created_at || '').slice(0, 10),
    ...nutritionTargets(goal),
    ...defaultHealthGoals(user.sex),
  }
  if (age !== null) profile.age = age
  if (user.sex) profile.sex = user.sex
  return profile
}

function ageFromIso(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 && age <= 120 ? age : null
}
