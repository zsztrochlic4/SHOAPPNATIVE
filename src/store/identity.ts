/**
 * Local-data identity scoping (audit F-001 / F-027).
 *
 * Every piece of on-device state is stored under a key derived from the account
 * it belongs to, so two people signing in on the same device can never see (or
 * save over) each other's health data. `AuthProvider` publishes the active
 * identity here the moment Firebase auth resolves; `StoreProvider` subscribes
 * and swaps the in-memory state atomically:
 *
 *   anon                 → the signed-out / demo / mid-onboarding slot
 *   <firebase uid>       → that account's private local cache
 *
 * The pre-scoping build stored everything under one global key
 * (`sho.state.v1`). That key is adopted ONCE into the anon slot (it can't be
 * attributed to an account with certainty, so it is never adopted into a uid
 * slot) and then deleted.
 */

export type Identity = string

export const ANON_IDENTITY = 'anon'
export const LEGACY_STORAGE_KEY = 'sho.state.v1'

let active: Identity = ANON_IDENTITY
const listeners = new Set<(id: Identity) => void>()

export function getActiveIdentity(): Identity {
  return active
}

/** Publish the identity whose data the app should hold. Called by AuthProvider. */
export function setActiveIdentity(next: Identity): void {
  if (active === next) return
  active = next
  listeners.forEach((l) => l(next))
}

export function subscribeIdentity(fn: (id: Identity) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** The AsyncStorage key holding this identity's app state. */
export function storageKeyFor(identity: Identity): string {
  return identity === ANON_IDENTITY
    ? `${LEGACY_STORAGE_KEY}.anon`
    : `${LEGACY_STORAGE_KEY}.u.${identity}`
}

/**
 * Whether the in-memory state should follow the user across an identity switch.
 * Exactly one hand-off is legitimate: anon → a signed-in account immediately
 * after onboarding, where the freshly-gathered answers belong to the account
 * that was just created and must be pushed to the cloud rather than wiped.
 * Every other switch (sign-out, a different account signing in, demo data)
 * must NOT carry — that is the cross-account exposure the audit flagged.
 */
export function shouldCarryLocalState(
  from: Identity,
  to: Identity,
  state: { profile?: { onboarded?: boolean }; demo?: boolean },
): boolean {
  if (from !== ANON_IDENTITY || to === ANON_IDENTITY) return false
  return state.profile?.onboarded === true && state.demo !== true
}

/** Remove an identity's locally cached app state (sign-out / account deletion).
 *  AsyncStorage is imported lazily so this module stays pure for unit tests. */
export async function clearStoredStateFor(identity: Identity): Promise<void> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
    await AsyncStorage.removeItem(storageKeyFor(identity))
  } catch {
    /* best-effort — worst case the cache dies with the next overwrite */
  }
}
