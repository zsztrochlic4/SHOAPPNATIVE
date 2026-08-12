/**
 * Web stub for `react-native-purchases`.
 *
 * RevenueCat's native module has no web build, yet Metro statically resolves the
 * lazy `import('react-native-purchases')` in src/lib/iap.ts even on web — where it
 * would otherwise fail the whole web bundle. On web `iapActive()` is always false
 * (web uses the Stripe paywall), so none of these methods are ever called; this
 * stub only has to satisfy Metro's resolver. metro.config.js aliases the package
 * to this file for platform === 'web'.
 */
const notOnWeb = () => {
  throw new Error('react-native-purchases is unavailable on web (use the Stripe paywall)')
}

const Purchases = {
  configure: () => {},
  getCustomerInfo: notOnWeb,
  getOfferings: notOnWeb,
  purchasePackage: notOnWeb,
  restorePurchases: notOnWeb,
}

module.exports = { __esModule: true, default: Purchases }
