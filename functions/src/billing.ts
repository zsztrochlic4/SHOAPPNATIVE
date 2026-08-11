import { onCall, onRequest, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'
import { getFirestore } from 'firebase-admin/firestore'
import Stripe from 'stripe'
import { requireAuth, auditAppCheck, APP_CHECK_ENFORCED } from './lib/guards'

/** Mirrors the client's `SubscriptionStatus` (src/store/types.ts). */
type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'

/**
 * Stripe billing — the paywall backend (Checkout redirect model).
 *
 * Three entry points:
 *   - `createCheckoutSession`  (callable) → a hosted Checkout URL for the 4-week
 *     free trial, then $2.99/week AUD.
 *   - `createBillingPortalSession` (callable) → a Billing Portal URL (Restore /
 *     manage / cancel).
 *   - `stripeWebhook` (HTTPS) → the ONLY writer of `entitlements/{uid}`, the
 *     server-authoritative paid record read by the client (firestore.rules
 *     Zone B). It also mirrors `users/{uid}.profile.premium` for display.
 *
 * Secrets are never committed — set them with `firebase functions:secrets:set`.
 * See docs/STRIPE_SETUP.md.
 */

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET')
const STRIPE_PRICE_ID = defineSecret('STRIPE_PRICE_ID')

/** 4-week free trial (design: "Your first 4 weeks are on us"). */
const TRIAL_PERIOD_DAYS = 28

/** Build a Stripe client at request time (secrets are only available then). */
function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value())
}

/**
 * Only allow returning to the app's own web origin or its custom scheme, so a
 * caller can't turn Checkout into an open redirect. Falls back to the scheme.
 */
function safeReturnUrl(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') {
    if (raw.startsWith('https://') || raw.startsWith('strengthhub://')) return raw
    // Dev / preview: the web app is served over http from a loopback origin
    // (e.g. http://localhost:8081). Allow loopback http too — otherwise the web
    // return URL is rejected and checkout falls back to the native strengthhub://
    // scheme, which a browser can't follow, so the Stripe page hangs after payment.
    // Restricted to localhost / 127.0.0.1 so this is not an open redirect.
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$|\?)/.test(raw)) return raw
  }
  return fallback
}

/**
 * Find (or lazily create) the Stripe customer for a user. The customer id is
 * cached on `entitlements/{uid}` (written only here / by the webhook), and the
 * Firebase uid is stamped on the customer's metadata for reverse lookup in the
 * webhook.
 */
async function ensureCustomer(stripe: Stripe, uid: string, email?: string): Promise<string> {
  const db = getFirestore()
  const ref = db.collection('entitlements').doc(uid)
  const snap = await ref.get()
  const existing = snap.exists ? (snap.get('stripeCustomerId') as string | undefined) : undefined
  if (existing) return existing

  const customer = await stripe.customers.create({
    email,
    metadata: { firebaseUID: uid },
  })
  // Seed the record so the id survives even if the user abandons Checkout.
  await ref.set({ stripeCustomerId: customer.id, updatedAt: Date.now() }, { merge: true })
  return customer.id
}

export const createCheckoutSession = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, secrets: [STRIPE_SECRET_KEY, STRIPE_PRICE_ID] },
  async (req: CallableRequest): Promise<{ url: string }> => {
    auditAppCheck(req, 'createCheckoutSession')
    const uid = requireAuth(req)
    const stripe = stripeClient()

    const email = typeof req.data?.email === 'string' ? (req.data.email as string) : req.auth?.token?.email
    const successUrl = safeReturnUrl(req.data?.successUrl, 'strengthhub://checkout?status=success')
    const cancelUrl = safeReturnUrl(req.data?.cancelUrl, 'strengthhub://checkout?status=cancel')

    const customerId = await ensureCustomer(stripe, uid, typeof email === 'string' ? email : undefined)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: uid,
      line_items: [{ price: STRIPE_PRICE_ID.value(), quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { firebaseUID: uid },
      },
      // Stamp the uid on the session too, for a belt-and-suspenders webhook lookup.
      metadata: { firebaseUID: uid },
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    if (!session.url) {
      throw new HttpsError('internal', 'Could not start checkout. Please try again.')
    }
    return { url: session.url }
  },
)

export const createBillingPortalSession = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED, secrets: [STRIPE_SECRET_KEY] },
  async (req: CallableRequest): Promise<{ url: string }> => {
    auditAppCheck(req, 'createBillingPortalSession')
    const uid = requireAuth(req)
    const stripe = stripeClient()

    const db = getFirestore()
    const snap = await db.collection('entitlements').doc(uid).get()
    const customerId = snap.exists ? (snap.get('stripeCustomerId') as string | undefined) : undefined
    if (!customerId) {
      throw new HttpsError('failed-precondition', 'No billing account found for this user yet.')
    }

    const returnUrl = safeReturnUrl(req.data?.returnUrl, 'strengthhub://account')
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return { url: portal.url }
  },
)

/** Map Stripe's subscription status to the app's narrower enum. */
function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case 'trialing': return 'trialing'
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'incomplete': return 'incomplete'
    case 'unpaid': return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
    case 'paused':
    default: return 'canceled'
  }
}

/** Resolve the Firebase uid a Stripe subscription belongs to. */
async function resolveUid(stripe: Stripe, sub: Stripe.Subscription): Promise<string | null> {
  const fromSub = sub.metadata?.firebaseUID
  if (fromSub) return fromSub
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted && customer.metadata?.firebaseUID) return customer.metadata.firebaseUID
  } catch (err) {
    logger.warn('billing.resolveUid.customerLookupFailed', { customerId })
  }
  return null
}

/**
 * Current-period-end lives on the Subscription in older API versions and on the
 * subscription item in newer ones (2025-03-31+). Read both, loosely, so this
 * doesn't break when Stripe's default API version changes.
 */
function periodEnd(sub: Stripe.Subscription): number | null {
  const loose = sub as unknown as { current_period_end?: number }
  if (typeof loose.current_period_end === 'number') return loose.current_period_end
  const item = sub.items.data[0] as unknown as { current_period_end?: number } | undefined
  return typeof item?.current_period_end === 'number' ? item.current_period_end : null
}

/** Write the authoritative entitlement record + mirror the display cache. */
async function writeEntitlement(uid: string, sub: Stripe.Subscription): Promise<void> {
  const db = getFirestore()
  const status = mapStatus(sub.status)
  const priceId = sub.items.data[0]?.price?.id
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const entitled = status === 'trialing' || status === 'active'

  await db.collection('entitlements').doc(uid).set(
    {
      status,
      plan: priceId ?? null,
      currentPeriodEnd: periodEnd(sub),
      trialEnd: sub.trial_end ?? null,
      stripeCustomerId: customerId,
      updatedAt: Date.now(),
    },
    { merge: true },
  )

  // Mirror to the client-readable display cache (server bypasses rules). A deep
  // merge so other profile fields are untouched.
  await db.collection('users').doc(uid).set({ profile: { premium: entitled } }, { merge: true })
}

export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res): Promise<void> => {
    const stripe = stripeClient()
    const sig = req.headers['stripe-signature']
    if (!sig) {
      res.status(400).send('Missing Stripe-Signature header')
      return
    }

    let event: Stripe.Event
    try {
      // `req.rawBody` (Buffer) is required — the parsed body would fail signature
      // verification. Cloud Functions provides it on every request.
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value())
    } catch (err) {
      logger.warn('billing.webhook.badSignature', { message: (err as Error).message })
      res.status(400).send('Webhook signature verification failed')
      return
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session
          if (session.subscription) {
            const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
            const sub = await stripe.subscriptions.retrieve(subId)
            const uid = session.client_reference_id || (await resolveUid(stripe, sub))
            if (uid) await writeEntitlement(uid, sub)
            else logger.warn('billing.webhook.noUid', { type: event.type })
          }
          break
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription
          const uid = await resolveUid(stripe, sub)
          if (uid) await writeEntitlement(uid, sub)
          else logger.warn('billing.webhook.noUid', { type: event.type })
          break
        }
        default:
          // Unhandled event types are acknowledged so Stripe stops retrying.
          break
      }
      res.status(200).send('ok')
    } catch (err) {
      logger.error('billing.webhook.handlerError', { type: event.type, message: (err as Error).message })
      // 500 → Stripe retries with backoff.
      res.status(500).send('Webhook handler error')
    }
  },
)
