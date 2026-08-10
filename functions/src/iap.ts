import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * SCAFFOLD — Apple App Store / Google Play billing via RevenueCat.  NOT YET LIVE.
 *
 * This is the server half of native in-app purchases (packet item L1). It is written to
 * the SAME `entitlements/{uid}` shape the Stripe path uses (functions/src/billing.ts), so
 * the client's paywall/entitlement logic does not care which billing rail granted access.
 *
 * It is deliberately NOT exported from functions/src/index.ts yet, so it does NOT deploy and
 * does NOT consume a Cloud Run slot. To go live you must complete docs/IAP_SETUP.md:
 *   1. paid Apple ($99) + Google Play ($25) developer accounts,
 *   2. subscription products created in App Store Connect + Play Console,
 *   3. a RevenueCat project wired to both stores, with `app_user_id` set to the Firebase UID,
 *   4. set the secret below, add `export { revenueCatWebhook } from './iap'` to index.ts,
 *   5. point RevenueCat's webhook at the deployed URL,
 *   6. build a native dev/preview build (NOT Expo Go) and test each purchase state.
 *
 * Until then this file only needs to TYPE-CHECK; it never runs.
 */

const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH')

type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'

/** The subset of the RevenueCat v1 webhook event we use. */
interface RCEvent {
  type: string
  app_user_id?: string
  original_app_user_id?: string
  product_id?: string
  period_type?: 'TRIAL' | 'INTRO' | 'NORMAL' | 'PROMOTIONAL'
  expiration_at_ms?: number
  store?: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | string
}

/** Map a RevenueCat event type + trial flag to the app's narrow status enum. */
function statusFromEvent(ev: RCEvent): SubscriptionStatus {
  const trial = ev.period_type === 'TRIAL' || ev.period_type === 'INTRO'
  switch (ev.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
      return trial ? 'trialing' : 'active'
    case 'CANCELLATION':
      // Still entitled until expiry; the app shows "access until <date>".
      return 'active'
    case 'BILLING_ISSUE':
      return 'past_due'
    case 'EXPIRATION':
    case 'SUBSCRIPTION_PAUSED':
      return 'canceled'
    default:
      return 'none'
  }
}

/** Write the authoritative entitlement + mirror the display flag — mirrors billing.ts. */
async function writeEntitlement(uid: string, ev: RCEvent, status: SubscriptionStatus): Promise<void> {
  const db = getFirestore()
  const entitled = status === 'trialing' || status === 'active'
  await db.collection('entitlements').doc(uid).set(
    {
      status,
      plan: ev.product_id ?? null,
      currentPeriodEnd: typeof ev.expiration_at_ms === 'number' ? Math.floor(ev.expiration_at_ms / 1000) : null,
      source: 'revenuecat',
      store: ev.store ?? null,
      updatedAt: Date.now(),
    },
    { merge: true },
  )
  await db.collection('users').doc(uid).set({ profile: { premium: entitled } }, { merge: true })
}

/**
 * RevenueCat → Firestore entitlement webhook. RevenueCat signs requests with a static
 * Authorization header you configure; we verify it against the secret before trusting the body.
 */
export const revenueCatWebhook = onRequest({ secrets: [REVENUECAT_WEBHOOK_AUTH] }, async (req, res): Promise<void> => {
  if (req.get('authorization') !== REVENUECAT_WEBHOOK_AUTH.value()) {
    res.status(401).send('unauthorized')
    return
  }
  try {
    const ev = (req.body?.event ?? {}) as RCEvent
    const uid = ev.app_user_id || ev.original_app_user_id
    if (!uid) {
      logger.warn('iap.webhook.noUid', { type: ev.type })
      res.status(200).send('ok (no uid)')
      return
    }
    await writeEntitlement(uid, ev, statusFromEvent(ev))
    res.status(200).send('ok')
  } catch (err) {
    logger.error('iap.webhook.error', { message: (err as Error).message })
    res.status(500).send('handler error')
  }
})
