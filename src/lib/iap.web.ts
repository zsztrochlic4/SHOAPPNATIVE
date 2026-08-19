/**
 * Web shim for native in-app purchases.
 *
 * Web never uses store billing — it uses the Stripe paywall (src/lib/billing.ts) — so this
 * file provides the same public API as iap.ts with pure no-ops and NO `react-native-purchases`
 * import. Metro resolves `iap.web.ts` ahead of `iap.ts` on web, so the native module is never
 * pulled into the web bundle (it isn't resolvable there). Native platforms keep using iap.ts.
 */

/** Store billing is never active on web. */
export const IAP_ENABLED = false as boolean

export const RC_ENTITLEMENT = 'premium'

export { IAP_PRODUCTS } from './plans'
import type { PlanId } from './plans'

/** Always false on web — the Stripe paywall handles billing here. */
export function iapActive(): boolean {
  return false
}

/** No-op on web. */
export async function initIap(_firebaseUid: string): Promise<void> {
  return
}

/** No entitlement is granted via store billing on web. */
export async function iapIsEntitled(): Promise<boolean> {
  return false
}

/** Store purchases are unavailable on web. */
export async function purchasePlan(_plan: PlanId): Promise<{ ok: boolean; entitled: boolean; cancelled?: boolean }> {
  return { ok: false, entitled: false }
}

/** Nothing to restore via store billing on web. */
export async function restorePurchases(): Promise<{ entitled: boolean }> {
  return { entitled: false }
}
