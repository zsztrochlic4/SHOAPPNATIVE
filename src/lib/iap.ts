/**
 * SCAFFOLD — native in-app purchases (Apple / Google) via RevenueCat.  NOT YET WIRED.
 *
 * Packet item L1. This module deliberately does NOT import `react-native-purchases`, so the
 * current Expo Go / web build keeps working. The real SDK calls are shown inline as comments;
 * drop them in AFTER you have completed docs/IAP_SETUP.md (accounts, products, RevenueCat keys,
 * config plugin, and a native dev build — the SDK cannot run in Expo Go).
 *
 * While `IAP_ENABLED` is false, the app continues to use the Stripe paywall (src/lib/billing.ts).
 * Nothing here runs.
 */

/** Master switch. Stays false until native IAP is built, tested on-device and store-approved. */
export const IAP_ENABLED = false as boolean

/** RevenueCat "entitlement" the app checks for premium access. Configure this id in RevenueCat. */
export const RC_ENTITLEMENT = 'premium'

/** Store product identifiers for the weekly plan — must match App Store Connect / Play Console. */
export const IAP_PRODUCTS = {
  weekly: 'sho_weekly_299', // create this subscription (AUD $2.99/wk, 4-week trial) in BOTH stores
} as const

/** Public API the paywall will call once IAP is enabled. */
export interface IapModule {
  init(firebaseUid: string): Promise<void>
  isEntitled(): Promise<boolean>
  purchaseWeekly(): Promise<{ ok: boolean; entitled: boolean }>
  restore(): Promise<{ entitled: boolean }>
}

function notEnabled(): never {
  throw new Error('IAP not enabled — complete docs/IAP_SETUP.md and set IAP_ENABLED = true')
}

/**
 * Scaffold implementation. Replace the bodies with the RevenueCat calls below once the SDK is
 * installed (`npx expo install react-native-purchases` + config plugin + dev build):
 *
 *   import Purchases from 'react-native-purchases'
 *
 *   async init(uid) {
 *     Purchases.configure({ apiKey: Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY, appUserID: uid })
 *   }
 *   async isEntitled() {
 *     const info = await Purchases.getCustomerInfo()
 *     return !!info.entitlements.active[RC_ENTITLEMENT]
 *   }
 *   async purchaseWeekly() {
 *     const offerings = await Purchases.getOfferings()
 *     const pkg = offerings.current?.availablePackages.find(p => p.product.identifier === IAP_PRODUCTS.weekly)
 *     if (!pkg) return { ok: false, entitled: false }
 *     const { customerInfo } = await Purchases.purchasePackage(pkg)
 *     return { ok: true, entitled: !!customerInfo.entitlements.active[RC_ENTITLEMENT] }
 *   }
 *   async restore() {
 *     const info = await Purchases.restorePurchases()
 *     return { entitled: !!info.entitlements.active[RC_ENTITLEMENT] }
 *   }
 *
 * The server half (RevenueCat webhook → entitlements/{uid}) is functions/src/iap.ts, so the
 * client can keep reading the same server-authoritative entitlement it already uses for Stripe.
 */
export const iap: IapModule = {
  async init() { if (!IAP_ENABLED) return; notEnabled() },
  async isEntitled() { if (!IAP_ENABLED) return false; notEnabled() },
  async purchaseWeekly() { notEnabled() },
  async restore() { notEnabled() },
}
