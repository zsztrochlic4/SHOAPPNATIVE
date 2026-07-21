import { Platform } from 'react-native'
import type { AppState, IntegrationState } from '../store/types'
import type { Action } from '../store/store'

/**
 * External health platforms.
 *
 * Apple Health (iOS) and Health Connect (Android) read on-device via HealthKit / Health
 * Connect, which needs the native app build — they are shown with their status until those
 * builds exist.
 *
 * (The former Strava/Whoop OAuth path — and its `oauthToken`/`providerFetch` Cloud Functions —
 * plus the Garmin/Fitbit placeholders, were removed in favour of the native Apple Health /
 * Health Connect direction.)
 */
export type ProviderId = 'appleHealth' | 'healthConnect'

export type Provider = {
  id: ProviderId
  name: string
  sub: string
  /** native = needs the iOS/Android build; soon = planned */
  kind: 'native' | 'soon'
}

export const PROVIDERS: Provider[] = [
  { id: 'appleHealth', name: 'Apple Health', sub: 'Steps, sleep & workouts (iOS app)', kind: 'native' },
  { id: 'healthConnect', name: 'Health Connect', sub: 'Steps, sleep & workouts (Android app)', kind: 'native' },
]

/** True when this provider can actually be connected in the current build. */
export function providerAvailable(p: Provider): { ok: boolean; why?: string } {
  if (p.kind === 'soon') return { ok: false, why: `${p.name} support is coming soon.` }
  // native (Apple Health / Health Connect)
  const platform = p.id === 'appleHealth' ? 'ios' : 'android'
  if (Platform.OS !== platform) {
    return { ok: false, why: `${p.name} connects on the ${platform === 'ios' ? 'iPhone' : 'Android'} app (coming with the store release).` }
  }
  return { ok: false, why: `${p.name} needs the native app build — coming with the store release.` }
}

/**
 * Sync connected providers. Apple Health / Health Connect sync on-device in the native
 * store-release build; there is no cloud sync to run here yet, so this returns a plain summary.
 * Kept for the auto-sync-on-launch and the Sync now button.
 */
export async function syncAll(state: AppState, _dispatch: (a: Action) => void): Promise<string> {
  const integ = state.integrations ?? {}
  const connected = (Object.keys(integ) as ProviderId[]).filter((id) => integ[id]?.connected)
  if (connected.length === 0) return 'No connected apps yet'
  return 'Up to date'
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
