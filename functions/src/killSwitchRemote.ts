/**
 * Operational REMOTE kill switch for the coach (spec §20; Jack R8 activation condition 4).
 *
 * This is the runtime SOURCE for the reviewed safety layer's `coachKillSwitchEngaged()` — it does NOT
 * change any safety detection logic, classifier, prompt, rules or parameters. It lets an operator disable
 * the coach in production WITHOUT a redeploy by setting `config/coach.killSwitch = true` in Firestore.
 *
 * Design (matches src/backend/coach/safety/killSwitch.ts): the switch can only ever ADD a reason to be
 * OFF; it never turns the coach on. `engaged()` is synchronous (returns a cached value) so the per-turn
 * gate check stays cheap; the value is refreshed in the background on a short TTL, and warmed on cold
 * start. FAIL-SAFE: a read error keeps the last known value and never engages on its own (a Firestore
 * blip must not take the coach down). An operator who prefers fail-CLOSED can seed the cache true.
 */

import { getFirestore } from 'firebase-admin/firestore'

export interface KillSwitchReader {
  /** Cached engaged state (synchronous). */
  engaged(): boolean
  /** Force a refresh now (awaited) — used to warm on cold start and in tests. */
  refresh(): Promise<void>
}

type Fetcher = () => Promise<boolean>

/** Wrap a boolean fetcher in a background-refreshing, fail-safe cache. Injectable for tests. */
export function makeRemoteKillSwitch(fetchEngaged: Fetcher, ttlMs = 30_000): KillSwitchReader {
  let engaged = false
  let lastOk = 0
  let inflight: Promise<void> | null = null
  const refresh = (): Promise<void> => {
    if (inflight) return inflight
    inflight = (async () => {
      try {
        engaged = await fetchEngaged()
        lastOk = Date.now()
      } catch {
        // fail-safe: keep the last known value; a read error never engages the switch on its own.
      } finally {
        inflight = null
      }
    })()
    return inflight
  }
  return {
    engaged() {
      if (Date.now() - lastOk > ttlMs) void refresh() // non-blocking; serves the cached value now
      return engaged
    },
    refresh,
  }
}

/** Production fetcher: the coach is remotely disabled when config/coach.killSwitch === true. */
export async function fetchCoachKillSwitch(): Promise<boolean> {
  const snap = await getFirestore().doc('config/coach').get()
  return snap.exists && snap.get('killSwitch') === true
}

/** The process-wide production instance, warmed on cold start. */
export const coachKillSwitch: KillSwitchReader = makeRemoteKillSwitch(fetchCoachKillSwitch)
