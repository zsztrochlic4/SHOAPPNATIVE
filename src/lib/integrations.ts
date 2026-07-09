import { Platform } from 'react-native'
import type { AppState, IntegrationState, LoggedActivity } from '../store/types'
import type { Action } from '../store/store'
import { toKey } from './date'

/**
 * External health platforms (Strava, Whoop, Apple Health, ...).
 *
 * How it works
 * - OAuth providers (Strava, Whoop): the app opens the provider's consent page;
 *   the code→token exchange happens in a Cloud Function so the client secrets
 *   NEVER ship in the app (see functions/index.js: oauthToken / providerFetch,
 *   which also proxies API reads to dodge CORS). Tokens live in the user's own
 *   state (owner-only in Firestore).
 * - Native providers (Apple Health, Health Connect): read on-device via
 *   HealthKit/Health Connect, which requires the real iOS/Android app build —
 *   they are visible but marked accordingly until those builds exist.
 * - Synced activities land in the same activity feed as hand-logged ones
 *   (de-duped by the platform's own id), steps/sleep merge into habit days,
 *   and everything feeds the 14-day on-track gauge automatically.
 */
export type ProviderId = 'strava' | 'whoop' | 'appleHealth' | 'healthConnect' | 'garmin' | 'fitbit'

export type Provider = {
  id: ProviderId
  name: string
  sub: string
  /** oauth = works via web OAuth now; native = needs the iOS/Android build; soon = planned */
  kind: 'oauth' | 'native' | 'soon'
}

export const PROVIDERS: Provider[] = [
  { id: 'strava', name: 'Strava', sub: 'Runs, rides & swims into your history', kind: 'oauth' },
  { id: 'whoop', name: 'Whoop', sub: 'Workouts, sleep & recovery', kind: 'oauth' },
  { id: 'appleHealth', name: 'Apple Health', sub: 'Steps, sleep & workouts (iOS app)', kind: 'native' },
  { id: 'healthConnect', name: 'Health Connect', sub: 'Steps, sleep & workouts (Android app)', kind: 'native' },
  { id: 'garmin', name: 'Garmin', sub: 'Coming soon', kind: 'soon' },
  { id: 'fitbit', name: 'Fitbit', sub: 'Coming soon', kind: 'soon' },
]

/** Cloud Function base for the OAuth exchange + API proxy. */
const FN_BASE =
  process.env.EXPO_PUBLIC_OAUTH_FN_BASE || 'https://us-central1-strengthhub-2ab33.cloudfunctions.net'

/** Public OAuth client ids — set these once the apps are registered. */
export const OAUTH_CLIENT_IDS: Partial<Record<ProviderId, string | undefined>> = {
  strava: process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID,
  whoop: process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID,
}

export const OAUTH_ENDPOINTS: Partial<Record<ProviderId, { auth: string; scopes: string[] }>> = {
  strava: {
    auth: 'https://www.strava.com/oauth/authorize',
    scopes: ['activity:read_all'],
  },
  whoop: {
    auth: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    scopes: ['read:workout', 'read:sleep', 'offline'],
  },
}

/** True when this provider can actually be connected in the current build. */
export function providerAvailable(p: Provider): { ok: boolean; why?: string } {
  if (p.kind === 'soon') return { ok: false, why: `${p.name} support is coming soon.` }
  if (p.kind === 'native') {
    const platform = p.id === 'appleHealth' ? 'ios' : 'android'
    if (Platform.OS !== platform) {
      return { ok: false, why: `${p.name} connects on the ${platform === 'ios' ? 'iPhone' : 'Android'} app (coming with the store release).` }
    }
    return { ok: false, why: `${p.name} needs the native app build — coming with the store release.` }
  }
  if (!OAUTH_CLIENT_IDS[p.id]) {
    return { ok: false, why: `${p.name} isn't configured yet (missing API keys — see docs/INTEGRATIONS.md).` }
  }
  return { ok: true }
}

/** Exchange an OAuth code (or refresh token) via the Cloud Function. */
export async function exchangeToken(
  provider: ProviderId,
  params: { code?: string; redirectUri?: string; refreshToken?: string },
): Promise<Pick<IntegrationState, 'accessToken' | 'refreshToken' | 'expiresAt'>> {
  const res = await fetch(`${FN_BASE}/oauthToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, ...params }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  const data = (await res.json()) as { accessToken: string; refreshToken?: string; expiresAt?: number }
  return data
}

/** Proxied GET against the provider's API (avoids CORS + hides nothing secret). */
async function providerGet<T>(provider: ProviderId, accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${FN_BASE}/providerFetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, accessToken, path }),
  })
  if (!res.ok) throw new Error(`${provider} fetch failed (${res.status})`)
  return (await res.json()) as T
}

export type SyncResult = {
  activities: (Omit<LoggedActivity, 'id'> & { externalId: string })[]
  stepsByDay: Record<string, number>
  sleepByDay: Record<string, number>
}

/* --------- per-provider mapping into the app's own shapes ---------- */

const STRAVA_ICON: Record<string, { icon: string; type: string }> = {
  Run: { icon: 'run', type: 'run' },
  TrailRun: { icon: 'run', type: 'run' },
  Walk: { icon: 'walk', type: 'walk' },
  Hike: { icon: 'hike', type: 'hike' },
  Ride: { icon: 'cycle', type: 'cycle' },
  VirtualRide: { icon: 'cycle', type: 'cycle' },
  Swim: { icon: 'swim', type: 'swim' },
  Rowing: { icon: 'row', type: 'row' },
  WeightTraining: { icon: 'gym', type: 'gym' },
  Workout: { icon: 'hiit', type: 'hiit' },
  Yoga: { icon: 'yoga', type: 'yoga' },
}

type StravaActivity = {
  id: number
  name: string
  sport_type?: string
  type?: string
  moving_time: number
  start_date_local: string
  calories?: number
  kilojoules?: number
}

async function syncStrava(accessToken: string): Promise<SyncResult> {
  const acts = await providerGet<StravaActivity[]>('strava', accessToken, '/api/v3/athlete/activities?per_page=60')
  const activities = (Array.isArray(acts) ? acts : []).map((a) => {
    const kind = STRAVA_ICON[a.sport_type ?? a.type ?? ''] ?? { icon: 'other', type: 'custom' }
    const minutes = Math.max(1, Math.round((a.moving_time ?? 0) / 60))
    return {
      externalId: String(a.id),
      dateKey: toKey(new Date(a.start_date_local)),
      type: kind.type,
      name: a.name || kind.type,
      icon: kind.icon,
      minutes,
      intensity: 'moderate' as const,
      calories: Math.round(a.calories ?? (a.kilojoules ? a.kilojoules * 1.05 : minutes * 8)),
      time: new Date(a.start_date_local).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      source: 'strava',
    }
  })
  return { activities, stepsByDay: {}, sleepByDay: {} }
}

type WhoopWorkout = { id: string; start: string; end: string; sport_name?: string; score?: { kilojoule?: number } }
type WhoopSleep = { id: string; start: string; end: string; score?: { stage_summary?: { total_in_bed_time_milli?: number } } }

async function syncWhoop(accessToken: string): Promise<SyncResult> {
  const [workouts, sleeps] = await Promise.all([
    providerGet<{ records?: WhoopWorkout[] }>('whoop', accessToken, '/developer/v1/activity/workout?limit=25'),
    providerGet<{ records?: WhoopSleep[] }>('whoop', accessToken, '/developer/v1/activity/sleep?limit=25'),
  ])
  const activities = (workouts.records ?? []).map((w) => {
    const start = new Date(w.start)
    const minutes = Math.max(1, Math.round((new Date(w.end).getTime() - start.getTime()) / 60000))
    const sport = (w.sport_name ?? 'workout').toLowerCase()
    const icon = STRAVA_ICON[sport.charAt(0).toUpperCase() + sport.slice(1)]?.icon ?? 'hiit'
    return {
      externalId: `whoop-${w.id}`,
      dateKey: toKey(start),
      type: 'custom',
      name: w.sport_name ?? 'Whoop workout',
      icon,
      minutes,
      intensity: 'moderate' as const,
      calories: Math.round((w.score?.kilojoule ?? minutes * 30) / 4.184),
      time: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      source: 'whoop',
    }
  })
  const sleepByDay: Record<string, number> = {}
  for (const s of sleeps.records ?? []) {
    const end = new Date(s.end)
    const ms = s.score?.stage_summary?.total_in_bed_time_milli ?? end.getTime() - new Date(s.start).getTime()
    const key = toKey(end)
    sleepByDay[key] = Math.max(sleepByDay[key] ?? 0, Math.round((ms / 3600000) * 10) / 10)
  }
  return { activities, stepsByDay: {}, sleepByDay }
}

/* ------------------------------ orchestrator ------------------------------ */

/**
 * Sync every connected provider: refresh expiring tokens, pull new data, and
 * dispatch it into the store. Returns a human summary for a toast. Runs
 * automatically when the app opens and on demand via the Refresh buttons.
 */
export async function syncAll(state: AppState, dispatch: (a: Action) => void): Promise<string> {
  const integ = state.integrations ?? {}
  const connected = (Object.keys(integ) as ProviderId[]).filter((id) => integ[id]?.connected)
  if (connected.length === 0) return 'No connected apps yet'

  let pulled = 0
  let failures = 0
  for (const id of connected) {
    try {
      let { accessToken, refreshToken, expiresAt } = integ[id]!
      if (!accessToken) continue
      // Refresh ahead of expiry so a sync never fails mid-flight.
      if (refreshToken && expiresAt && expiresAt * 1000 < Date.now() + 5 * 60 * 1000) {
        const fresh = await exchangeToken(id, { refreshToken })
        accessToken = fresh.accessToken
        dispatch({ type: 'SET_INTEGRATION', id, patch: fresh })
      }
      if (!accessToken) continue
      const token: string = accessToken
      const result = id === 'strava' ? await syncStrava(token) : id === 'whoop' ? await syncWhoop(token) : null
      if (!result) continue
      dispatch({ type: 'APPLY_SYNC', provider: id, at: new Date().toISOString(), ...result })
      pulled += result.activities.length
    } catch {
      failures++
    }
  }
  if (failures && !pulled) return 'Sync failed — try again in a moment'
  return pulled > 0 ? `Synced ${pulled} new activit${pulled === 1 ? 'y' : 'ies'}` : 'Up to date'
}

/** Short "synced 5m ago" label. */
export function lastSyncLabel(s?: IntegrationState): string | null {
  if (!s?.lastSyncAt) return null
  const mins = Math.max(0, Math.round((Date.now() - new Date(s.lastSyncAt).getTime()) / 60000))
  if (mins < 1) return 'synced just now'
  if (mins < 60) return `synced ${mins}m ago`
  const hrs = Math.round(mins / 60)
  return hrs < 24 ? `synced ${hrs}h ago` : `synced ${Math.round(hrs / 24)}d ago`
}
