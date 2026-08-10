import { Platform } from 'react-native'
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases'

/**
 * Native in-app purchases (Apple StoreKit / Google Play Billing) via RevenueCat.
 *
 * IMPLEMENTED but GATED: `IAP_ENABLED` stays false until this is tested on a real
 * device (see docs/IAP_SETUP.md). Store billing CANNOT run in Expo Go — it needs an
 * EAS dev/preview build. To keep the Expo Go / web build working today, the
 * `react-native-purchases` native module is imported LAZILY (only when an IAP method
 * actually runs, which never happens while `IAP_ENABLED` is false or on web), so
 * merely loading the app never touches the native module.
 *
 * Web keeps using the Stripe paywall (src/lib/billing.ts). Native uses this once enabled.
 *
 * The server half — RevenueCat webhook → `entitlements/{uid}` — is functions/src/iap.ts,
 * so the client keeps reading the same server-authoritative entitlement it already uses
 * for Stripe (BillingSync). Purchases here are a belt; the webhook is the source of truth.
 */

/** Master switch. Stays false until native IAP is built, tested on-device and store-approved. */
export const IAP_ENABLED = false as boolean

/** RevenueCat "entitlement" identifier that grants premium (configure this in RevenueCat). */
export const RC_ENTITLEMENT = 'premium'

/** Store product id for the weekly plan — must match App Store Connect / Play Console. */
export const IAP_WEEKLY_PRODUCT = 'sho_weekly_299'

/** RevenueCat public SDK keys, per platform. Set via EAS env (never commit real keys). */
const RC_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
}) as string | undefined

/** True when native store billing should be used instead of Stripe (native + enabled). */
export function iapActive(): boolean {
  return IAP_ENABLED && (Platform.OS === 'ios' || Platform.OS === 'android')
}

let configuredFor: string | null = null

/** Lazy-load the native module so Expo Go / web never touch it at import time. */
async function getPurchases() {
  const mod = await import('react-native-purchases')
  return mod.default
}

function isEntitled(info: CustomerInfo): boolean {
  return !!info.entitlements.active[RC_ENTITLEMENT]
}

/** Configure RevenueCat once for the signed-in user. Safe to call repeatedly. */
export async function initIap(firebaseUid: string): Promise<void> {
  if (!iapActive() || !firebaseUid) return
  if (configuredFor === firebaseUid) return
  if (!RC_API_KEY) throw new Error('RevenueCat API key missing (EXPO_PUBLIC_RC_* env)')
  const Purchases = await getPurchases()
  Purchases.configure({ apiKey: RC_API_KEY, appUserID: firebaseUid })
  configuredFor = firebaseUid
}

/** Current entitlement per RevenueCat (the webhook remains the server-authoritative record). */
export async function iapIsEntitled(): Promise<boolean> {
  if (!iapActive()) return false
  const Purchases = await getPurchases()
  return isEntitled(await Purchases.getCustomerInfo())
}

/** Buy the weekly subscription. Returns { ok, entitled, cancelled }. Never throws on user-cancel. */
export async function purchaseWeekly(): Promise<{ ok: boolean; entitled: boolean; cancelled?: boolean }> {
  if (!iapActive()) throw new Error('IAP not active')
  const Purchases = await getPurchases()
  const offerings = await Purchases.getOfferings()
  const packages: PurchasesPackage[] = offerings.current?.availablePackages ?? []
  const pkg =
    packages.find((p) => p.product.identifier === IAP_WEEKLY_PRODUCT) ?? packages[0]
  if (!pkg) return { ok: false, entitled: false }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg)
    return { ok: true, entitled: isEntitled(customerInfo) }
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return { ok: false, entitled: false, cancelled: true }
    throw e
  }
}

/** Restore prior purchases (Apple/Google account). Returns whether the user is entitled. */
export async function restorePurchases(): Promise<{ entitled: boolean }> {
  if (!iapActive()) return { entitled: false }
  const Purchases = await getPurchases()
  return { entitled: isEntitled(await Purchases.restorePurchases()) }
}
