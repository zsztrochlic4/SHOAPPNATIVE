import { buildSeed, emptyState, SCHEMA_VERSION } from './seed'
import type { AppState, NotificationConsent, Settings } from './types'

type UnknownRecord = Record<string, unknown>

export type MigrationFailureReason = 'invalid-state' | 'future-version'

export type MigrationResult =
  | { ok: true; state: AppState; fromVersion: number; migrated: boolean }
  | { ok: false; reason: MigrationFailureReason; version?: number }

const ARRAY_KEYS: (keyof AppState)[] = [
  'weights', 'habits', 'meals', 'foodReviews', 'chat', 'activities',
  'mealPlan', 'postComments', 'foods', 'sessions', 'workoutSummaries',
  'program', 'posts', 'leaderboard', 'challenges', 'badges',
  'notifications', 'events', 'groups', 'partners', 'coachThread', 'myMeals',
  'templates', 'workoutStartedKeys', 'nutritionAskedKeys', 'beginnerProgress',
  'plannedPeriods', 'workoutInstances',
]

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validConsent(value: unknown): value is NotificationConsent {
  return value === 'unknown' || value === 'granted' || value === 'denied'
}

/**
 * Version 11 replaces the legacy seeded notification boolean with explicit
 * permission provenance. A legacy `true` cannot prove that the person opted in,
 * so migration deliberately leaves notifications off until they choose Settings
 * -> Notifications themselves.
 */
function migrateSettings(value: unknown, defaults: Settings): Settings {
  const raw = isRecord(value) ? value : {}
  const consent = validConsent(raw.notificationConsent) ? raw.notificationConsent : 'unknown'
  const notificationsEnabled = consent === 'granted' && raw.notificationsEnabled === true
  const prefs = isRecord(raw.notificationPrefs)
    ? { ...(defaults.notificationPrefs ?? {}), ...raw.notificationPrefs }
    : defaults.notificationPrefs

  return {
    ...defaults,
    ...raw,
    notificationsEnabled,
    notificationConsent: consent,
    notificationPrefs: prefs,
  } as Settings
}

/**
 * Upgrade a persisted local/cloud state without discarding user-owned arrays.
 * Older schemas did not ship explicit migration functions, so the recovery path
 * overlays every known value on a fresh shape, validates collection containers,
 * and applies the explicit v10 -> v11 consent migration. Future versions are
 * never opened or overwritten by an older build.
 */
export function migrateAppState(value: unknown): MigrationResult {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-state' }
  const version = value.v
  if (!Number.isInteger(version) || (version as number) < 1) {
    return { ok: false, reason: 'invalid-state' }
  }
  if ((version as number) > SCHEMA_VERSION) {
    return { ok: false, reason: 'future-version', version: version as number }
  }

  const profile = isRecord(value.profile) ? value.profile : {}
  const realUser = value.demo === false || profile.onboarded === false
  const base = realUser ? emptyState() : buildSeed()
  const next = {
    ...base,
    ...value,
    profile: { ...base.profile, ...profile },
    settings: migrateSettings(value.settings, base.settings),
    v: SCHEMA_VERSION,
  } as AppState

  for (const key of ARRAY_KEYS) {
    const candidate = value[key as string]
    if (candidate !== undefined && !Array.isArray(candidate)) {
      ;(next as unknown as UnknownRecord)[key as string] = (base as unknown as UnknownRecord)[key as string]
    }
  }

  if (!isRecord(value.nutritionTags) && value.nutritionTags !== undefined) {
    next.nutritionTags = base.nutritionTags
  }
  if (!isRecord(value.integrations) && value.integrations !== undefined) {
    next.integrations = base.integrations
  }

  return {
    ok: true,
    state: next,
    fromVersion: version as number,
    migrated: version !== SCHEMA_VERSION,
  }
}
