/**
 * P0 data-loss guards for demo-reset and cloud sync (audit SA-001).
 *
 * "Reset demo data" restores a fabricated seed history (buildSeed() → demo:true).
 * For a signed-in account that fabricated state would diff against the real cloud
 * baseline and delete/overwrite genuine documents on the next sync. These pure
 * predicates are the single source of truth for the three layered guards that
 * make that impossible, and are unit-tested directly (store.tsx / CloudSync.tsx
 * only wire them into React):
 *
 *   1. dispatch:  a real account can never dispatch RESET_DEMO
 *   2. cloud:     a demo snapshot can never be pushed to the cloud
 *   3. UI:        the control is hidden outside the anonymous demo identity
 *
 * Keeping them here (framework-free) means the invariant "authenticated cloud
 * state cannot be replaced by seed data" is provable in a node test rather than
 * only reasoned about across a React component.
 */
import { ANON_IDENTITY, type Identity } from './identity'

/** Whether a RESET_DEMO dispatch is permitted for the active identity. */
export function canDispatchDemoReset(identity: Identity): boolean {
  return identity === ANON_IDENTITY
}

/**
 * Whether a state snapshot may be written to an authenticated account's cloud
 * copy. A `demo` snapshot is fabricated seed data and must never sync. Real user
 * state (COMPLETE_ONBOARDING / emptyState / RESET_EMPTY) always has demo:false.
 */
export function canSyncSnapshot(snapshot: { demo?: boolean }): boolean {
  return snapshot.demo !== true
}

/** Whether the "Reset demo data" control should be offered in the UI. */
export function canOfferDemoReset(opts: { authEnabled: boolean; signedIn: boolean }): boolean {
  return !opts.authEnabled || !opts.signedIn
}
