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
  /**
   * Freshness-bound read (audit U-003). Awaits a refresh when the cache was never populated (cold
   * start) or has gone stale, so the FIRST request after a cold start can't serve a stale `false`.
   * `failClosed` (for plan-mutating actions): if freshness still can't be confirmed after the
   * awaited refresh, return `true` (engaged / disabled) rather than fail open.
   */
  engagedFresh(failClosed?: boolean): Promise<boolean>
  /** Force a refresh now (awaited) — used to warm on cold start and in tests. */
  refresh(): Promise<void>
}

type Fetcher = () => Promise<boolean>

/** Wrap a boolean fetcher in a background-refreshing, fail-safe cache. Injectable for tests
 *  (`now` lets a test drive the clock deterministically to reproduce a stale-cache outage). */
export function makeRemoteKillSwitch(fetchEngaged: Fetcher, ttlMs = 30_000, now: () => number = () => Date.now()): KillSwitchReader {
  let engaged = false
  let lastOk = 0
  let inflight: Promise<void> | null = null
  const refresh = (): Promise<void> => {
    if (inflight) return inflight
    inflight = (async () => {
      try {
        engaged = await fetchEngaged()
        lastOk = now()
      } catch {
        // fail-safe: keep the last known value; a read error never engages the switch on its own.
      } finally {
        inflight = null
      }
    })()
    return inflight
  }
  const isFresh = (): boolean => lastOk !== 0 && now() - lastOk <= ttlMs
  return {
    engaged() {
      if (now() - lastOk > ttlMs) void refresh() // non-blocking; serves the cached value now
      return engaged
    },
    async engagedFresh(failClosed = false) {
      if (!isFresh()) await refresh()
      // audit R4-001: the cache is trustworthy ONLY if it is fresh AFTER the awaited refresh. A
      // never-populated cache OR a stale value whose refresh failed (a Firestore outage) both leave
      // us unable to confirm the switch state — so for plan-mutating actions we fail CLOSED
      // (return true / disabled) rather than serve a stale `false`. Advisory reads fail safe.
      if (!isFresh()) return failClosed ? true : engaged
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

/**
 * SERVER-OWNED action capability switch (audit C-006 / CA-004). The action-only off switch must
 * NOT be a client build flag: a modified or stale client can set allowActions=true, so the server
 * is the authority on whether plan-mutating actions are permitted. Actions are disabled server-side
 * when config/coach.actionsDisabled === true (an owner can flip it live, no redeploy). Advisory
 * chat is unaffected. FAIL-SAFE to the last known value like the kill switch.
 */
export async function fetchCoachActionsDisabled(): Promise<boolean> {
  const snap = await getFirestore().doc('config/coach').get()
  return snap.exists && snap.get('actionsDisabled') === true
}

/** Process-wide action capability switch (`disabled` == engaged), warmed on cold start. */
export const coachActionsSwitch: KillSwitchReader = makeRemoteKillSwitch(fetchCoachActionsDisabled)

/* ------------------------------------------------------------------ */
/*  Server-authoritative, default-CLOSED release gate (defence-in-depth) */
/* ------------------------------------------------------------------ */

export interface EnableGateReader {
  /** Cached enabled state (synchronous); false until a fresh read confirms `true`. */
  enabled(): boolean
  /**
   * Freshness-bound read: awaits a refresh when the cache was never populated (cold start) or has
   * gone stale, and returns `false` (CLOSED) whenever freshness cannot be confirmed — so a cold
   * start or a Firestore error can never leave the coach ON.
   */
  enabledFresh(): Promise<boolean>
  /** Force a refresh now (awaited) — used to warm on cold start and in tests. */
  refresh(): Promise<void>
}

/**
 * A default-CLOSED remote ENABLE gate — the inverse safety polarity of `makeRemoteKillSwitch`. The
 * coach is ON only while an explicit flag reads `true`; every other state (never read, stale cache,
 * or a read error) resolves to OFF. This is the server-authoritative backstop that stops an
 * accidental `COACH_RELEASE_CHANNEL=internal` build from opening production on its own: production
 * stays closed until `config/coach.releaseEnabled === true` is deliberately set, and it can be
 * revoked live with no redeploy, exactly like the kill switch.
 *
 * FAIL-CLOSED throughout: unlike the kill switch (which fails SAFE by keeping its last value so a
 * Firestore blip can't take the coach down), an enable gate's safe state is OFF, so a read error or
 * an unconfirmable cache drops it to disabled rather than serving a stale `true`.
 */
export function makeRemoteEnableGate(fetchEnabled: Fetcher, ttlMs = 30_000, now: () => number = () => Date.now()): EnableGateReader {
  let enabled = false
  let lastOk = 0
  let inflight: Promise<void> | null = null
  const refresh = (): Promise<void> => {
    if (inflight) return inflight
    inflight = (async () => {
      try {
        enabled = await fetchEnabled()
        lastOk = now()
      } catch {
        // fail-CLOSED: a read error must never leave the gate open. Drop to disabled; the next
        // successful refresh re-opens it if the flag is still set.
        enabled = false
      } finally {
        inflight = null
      }
    })()
    return inflight
  }
  const isFresh = (): boolean => lastOk !== 0 && now() - lastOk <= ttlMs
  return {
    enabled() {
      if (!isFresh()) void refresh() // non-blocking; a stale cache reports CLOSED below
      return isFresh() ? enabled : false
    },
    async enabledFresh() {
      if (!isFresh()) await refresh()
      if (!isFresh()) return false // cold start or a failed refresh ⇒ freshness unconfirmed ⇒ CLOSED
      return enabled
    },
    refresh,
  }
}

/** Production fetcher: the coach is remotely ENABLED only when config/coach.releaseEnabled === true. */
export async function fetchCoachReleaseEnabled(): Promise<boolean> {
  const snap = await getFirestore().doc('config/coach').get()
  return snap.exists && snap.get('releaseEnabled') === true
}

/** The process-wide, default-closed release gate, warmed on cold start. */
export const coachReleaseGate: EnableGateReader = makeRemoteEnableGate(fetchCoachReleaseEnabled)
