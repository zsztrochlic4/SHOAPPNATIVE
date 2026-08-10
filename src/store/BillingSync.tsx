import { useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, firebaseEnabled } from '../lib/firebase'
import { useAuth } from '../auth/AuthProvider'
import { useStore } from './store'
import { initIap } from '../lib/iap'
import type { Subscription, SubscriptionStatus } from './types'

/**
 * Bridges the server-authoritative paid-entitlement record and the local store.
 * Renders nothing.
 *
 * The Stripe webhook (functions/src/billing.ts) is the ONLY writer of
 * `entitlements/{uid}`; the client may only READ its own document (see
 * firestore.rules Zone B). This component subscribes to that doc and mirrors it
 * into `state.subscription`, which drives the paywall gate via `isEntitled`
 * (src/store/selectors.ts). An absent document means non-premium.
 *
 * Inert when signed out or when Firebase isn't configured (demo mode), where the
 * gate is open anyway.
 */
const VALID_STATUS: readonly SubscriptionStatus[] = [
  'none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete',
]

function toNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Map an `entitlements/{uid}` document to the local Subscription shape. */
function mapEntitlement(data: Record<string, unknown> | undefined): Subscription {
  const raw = (data?.status as string) ?? 'none'
  const status = (VALID_STATUS as string[]).includes(raw) ? (raw as SubscriptionStatus) : 'none'
  return {
    status,
    plan: typeof data?.plan === 'string' ? (data.plan as string) : undefined,
    currentPeriodEnd: toNumber(data?.currentPeriodEnd),
    trialEnd: toNumber(data?.trialEnd),
    stripeCustomerId:
      typeof data?.stripeCustomerId === 'string' ? (data.stripeCustomerId as string) : undefined,
    updatedAt: toNumber(data?.updatedAt),
  }
}

export function BillingSync() {
  const { user } = useAuth()
  const { dispatch } = useStore()

  useEffect(() => {
    if (!firebaseEnabled || !db || !user) return
    // Configure RevenueCat for this user (no-op unless native store billing is enabled).
    void initIap(user.uid).catch(() => { /* IAP unavailable / not configured — Stripe path stays */ })
    const ref = doc(db, 'entitlements', user.uid)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        dispatch({
          type: 'SET_SUBSCRIPTION',
          subscription: mapEntitlement(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined),
        })
      },
      () => {
        // Permission/transient error — leave whatever the store already has; the
        // gate falls back to profile.premium and the local cache.
      },
    )
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  return null
}
