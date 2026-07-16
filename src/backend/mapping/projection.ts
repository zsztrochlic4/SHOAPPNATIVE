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
import type { BackendExperience, BackendGoal, EquipmentTier, InjuryRegion, UserDoc } from '../schema'

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

/** Deterministic nutrition macro defaults by goal (mirrors the old onboarding). */
export function nutritionTargets(goal: Goal): Pick<Profile, 'calorieTarget' | 'proteinTarget' | 'carbTarget' | 'fatTarget'> {
  switch (goal) {
    case 'build-muscle': return { calorieTarget: 2600, proteinTarget: 170, carbTarget: 300, fatTarget: 75 }
    case 'lose-fat': return { calorieTarget: 1900, proteinTarget: 165, carbTarget: 180, fatTarget: 60 }
    case 'gain-strength': return { calorieTarget: 2500, proteinTarget: 160, carbTarget: 280, fatTarget: 80 }
    default: return { calorieTarget: 2200, proteinTarget: 140, carbTarget: 240, fatTarget: 70 }
  }
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
