import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { httpsCallable } from 'firebase/functions'
import { functions, firebaseEnabled } from './firebase'

/**
 * Client side of the Stripe paywall. Asks the trusted backend
 * (functions/src/billing.ts) for a hosted Checkout / Billing Portal URL, then
 * opens it. On web this is a full-page redirect; on native it opens an auth
 * session that returns to the app via the `strengthhub://` scheme.
 *
 * Entitlement is NOT read back from these calls — the Stripe webhook writes
 * `entitlements/{uid}` and BillingSync flips the local gate. The caller just
 * shows a "confirming…" state until that snapshot lands.
 */

const NATIVE_RETURN = 'strengthhub://checkout'

/** Where Stripe should send the user back to. */
function returnUrls(): { successUrl: string; cancelUrl: string } {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location.origin
    return { successUrl: `${origin}/?checkout=success`, cancelUrl: `${origin}/?checkout=cancel` }
  }
  return {
    successUrl: `${NATIVE_RETURN}?status=success`,
    cancelUrl: `${NATIVE_RETURN}?status=cancel`,
  }
}

/** Result of a checkout attempt: whether the user came back via success. */
export type CheckoutOutcome = 'opened' | 'success' | 'cancel' | 'dismiss'

export async function startCheckout(email?: string): Promise<CheckoutOutcome> {
  if (!firebaseEnabled || !functions) throw new Error('Billing is not configured')
  const { successUrl, cancelUrl } = returnUrls()
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined'

  // On web, open the checkout tab SYNCHRONOUSLY inside the tap handler (before the
  // async round-trip) so it isn't popup-blocked, then point it at Stripe once the
  // session URL is ready. Crucially this keeps THIS app mounted — so auth + local
  // state survive and BillingSync flips the gate when the entitlement lands, instead
  // of a full-page redirect that destroys the app and can strand the user on the
  // Welcome screen when the reload doesn't cleanly restore the session.
  const win = isWeb ? window.open('about:blank', '_blank') : null

  try {
    const call = httpsCallable<
      { email?: string; successUrl: string; cancelUrl: string },
      { url: string }
    >(functions, 'createCheckoutSession', { timeout: 30_000 })
    const { data } = await call({ email, successUrl, cancelUrl })

    if (isWeb) {
      if (win && !win.closed) {
        win.location.href = data.url
        return 'opened' // app stays mounted; entitlement arrives via BillingSync
      }
      // Popup blocked → fall back to the previous full-page redirect.
      window.location.assign(data.url)
      return 'opened'
    }
    const res = await WebBrowser.openAuthSessionAsync(data.url, NATIVE_RETURN)
    if (res.type === 'success') {
      return res.url.includes('status=cancel') ? 'cancel' : 'success'
    }
    return 'dismiss'
  } catch (e) {
    if (win && !win.closed) win.close() // don't leave a blank tab on failure
    throw e
  }
}

export async function openBillingPortal(): Promise<void> {
  if (!firebaseEnabled || !functions) throw new Error('Billing is not configured')
  const returnUrl =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : `${NATIVE_RETURN}?status=portal`
  const call = httpsCallable<{ returnUrl: string }, { url: string }>(
    functions,
    'createBillingPortalSession',
    { timeout: 30_000 },
  )
  const { data } = await call({ returnUrl })

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(data.url)
    return
  }
  await WebBrowser.openAuthSessionAsync(data.url, NATIVE_RETURN)
}
