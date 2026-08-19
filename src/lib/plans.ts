/**
 * Subscription plans offered on the paywall.
 *
 * The paywall sells two plans:
 *   - `weekly` — a 4-week free trial, then $2.00/week AUD.
 *   - `annual` — $90 AUD upfront for 52 weeks (~$1.73/week), charged today (no
 *     free trial).
 *
 * This is the single source of truth for the plan ids used across the client
 * (Paywall, Stripe checkout, native IAP) and mirrored on the server
 * (functions/src/billing.ts maps each id to its Stripe price + trial policy).
 * Display copy (prices, labels) lives in the Paywall screen; only the machine
 * ids + store product ids live here.
 */

export type PlanId = 'weekly' | 'annual'

/** The plan pre-selected when the paywall opens. */
export const DEFAULT_PLAN: PlanId = 'weekly'

/** Whether a plan starts with the 4-week free trial (weekly) or bills today (annual). */
export const PLAN_HAS_TRIAL: Record<PlanId, boolean> = {
  weekly: true,
  annual: false,
}

/**
 * Store product ids for native in-app purchase (RevenueCat / App Store Connect /
 * Play Console). Must match the product ids configured in those consoles.
 */
export const IAP_PRODUCTS: Record<PlanId, string> = {
  weekly: 'sho_weekly_200',
  annual: 'sho_annual_9000',
}
