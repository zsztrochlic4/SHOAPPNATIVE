/**
 * Admin analytics — owner-only aggregates for the StrengthHub · Analytics
 * dashboard (strengthhub-admin.web.app). Runs with Admin SDK privileges and is
 * gated by the `owner` custom claim (scripts/set-owner-claim.mjs) — the SAME gate
 * as the notification sender and moderation tools.
 *
 * Why this exists: firestore.rules deny cross-user `list`, so a client cannot
 * count users / read every entitlement. These callables do it server-side, with
 * no third-party analytics SDK — every number is derived from data the backend
 * already holds (Firebase Auth + Firestore entitlements + community scores).
 *
 *   adminAnalytics({ rangeDays }) → KPI cards + daily trend series (Overview tab)
 *   adminUsers({ limit })         → per-account rows (Users tab)
 *
 * ── Tuning ────────────────────────────────────────────────────────────────
 * Everything schema-dependent is in the MAP block below — adjust there if your
 * entitlement/adherence field names differ. Every read is defensive: a missing
 * field degrades to a sensible default rather than throwing.
 */
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth, type UserRecord } from 'firebase-admin/auth'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { requireOwner } from './lib/guards'

// ─── SCHEMA / PRICING MAP — edit here if your data differs ──────────────────
// Paywall is $2.99/week AUD (see .env.example): a weekly sub ≈ this per month.
const WEEKLY_PRICE_AUD = 2.99
const MONTHLY_FROM_WEEKLY = (WEEKLY_PRICE_AUD * 52) / 12 // ≈ 12.96
// entitlements/{uid} statuses that count as *paying* (contribute to MRR)…
const PAYING_STATUSES = new Set(['active', 'paid', 'grace', 'past_due'])
// …and as *trialing* (a subscriber, but $0 MRR).
const TRIAL_STATUSES = new Set(['trialing', 'trial', 'in_trial'])
// Hard caps so a single call can never fan out unbounded.
const MAX_USERS = 20000
const MAX_ADHERENCE_SCANS = 500
const DAY_MS = 24 * 60 * 60 * 1000

type Kpi = { value: number; prev: number | null }
type DayPoint = { date: string; value: number }

const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const parseTime = (s?: string | null): number | null => {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

/** Pull every Auth user (paginated). Auth is the source of truth for accounts,
 *  sign-ups and recency — no Firestore field-guessing required. */
async function listAllUsers(): Promise<UserRecord[]> {
  const out: UserRecord[] = []
  let pageToken: string | undefined
  do {
    const res = await getAuth().listUsers(1000, pageToken)
    out.push(...res.users)
    pageToken = res.pageToken
  } while (pageToken && out.length < MAX_USERS)
  return out
}

/** Last time an account did anything we can see (token refresh beats sign-in). */
const lastActiveMs = (u: UserRecord): number | null =>
  parseTime(u.metadata.lastRefreshTime) ?? parseTime(u.metadata.lastSignInTime)

/** Read every entitlement doc once; classify + price it defensively. */
async function readEntitlements(): Promise<
  Map<string, { paying: boolean; trialing: boolean; monthly: number; startMs: number | null; label: string }>
> {
  const map = new Map<string, { paying: boolean; trialing: boolean; monthly: number; startMs: number | null; label: string }>()
  try {
    const snap = await getFirestore().collection('entitlements').get()
    snap.forEach((doc) => {
      const d = doc.data() as Record<string, unknown>
      const status = String(d.status ?? d.state ?? '').toLowerCase()
      const activeFlag = d.active === true || d.entitled === true || d.premium === true
      const paying = activeFlag || PAYING_STATUSES.has(status)
      const trialing = TRIAL_STATUSES.has(status)
      if (!paying && !trialing) return
      const explicitMonthly =
        typeof d.priceMonthly === 'number' ? d.priceMonthly
        : typeof d.mrr === 'number' ? d.mrr
        : null
      const interval = String(d.interval ?? d.period ?? '').toLowerCase()
      const monthly = paying
        ? explicitMonthly ??
          (interval.startsWith('month') ? WEEKLY_PRICE_AUD * 4.345 : MONTHLY_FROM_WEEKLY)
        : 0
      const startMs =
        parseTime(typeof d.startedAt === 'string' ? d.startedAt : null) ??
        parseTime(typeof d.createdAt === 'string' ? d.createdAt : null) ??
        (d.startedAt && typeof (d.startedAt as { toMillis?: () => number }).toMillis === 'function'
          ? (d.startedAt as { toMillis: () => number }).toMillis()
          : null)
      map.set(doc.id, {
        paying,
        trialing,
        monthly: Math.round(monthly * 100) / 100,
        startMs,
        label: trialing ? 'Trial' : status ? status : 'Active',
      })
    })
  } catch (e) {
    logger.warn('adminAnalytics.entitlements_failed', { error: String(e) })
  }
  return map
}

/** Best-effort average nutrition-adherence (0..10 → %) over active users.
 *  Reads each active user's latest communityProfiles/{uid}/scoreDays doc, capped
 *  so it never fans out unbounded. Any failure degrades to 0. */
async function averageAdherence(activeUids: string[]): Promise<number> {
  const db = getFirestore()
  const sample = activeUids.slice(0, MAX_ADHERENCE_SCANS)
  let sum = 0
  let n = 0
  await Promise.all(
    sample.map(async (uid) => {
      try {
        const snap = await db
          .collection('communityProfiles')
          .doc(uid)
          .collection('scoreDays')
          .orderBy('__name__', 'desc')
          .limit(1)
          .get()
        if (snap.empty) return
        const d = snap.docs[0].data() as Record<string, unknown>
        const raw =
          typeof d.nutritionAdherence === 'number' ? d.nutritionAdherence
          : typeof d.adherence === 'number' ? d.adherence
          : null
        if (raw == null) return
        sum += raw <= 10 ? raw * 10 : raw // 0..10 → %, pass through if already %
        n += 1
      } catch {
        /* ignore per-user read failures */
      }
    }),
  )
  return n === 0 ? 0 : Math.round((sum / n) * 10) / 10
}

const emptyDays = (rangeDays: number, endMs: number): Map<string, number> => {
  const m = new Map<string, number>()
  for (let i = rangeDays - 1; i >= 0; i--) m.set(dayKey(endMs - i * DAY_MS), 0)
  return m
}
const toSeries = (m: Map<string, number>): DayPoint[] =>
  [...m.entries()].map(([date, value]) => ({ date, value }))

export const adminAnalytics = onCall({ enforceAppCheck: false }, async (req) => {
  requireOwner(req)
  const rangeDays = [7, 28, 90].includes(Number(req.data?.rangeDays)) ? Number(req.data.rangeDays) : 28

  const now = Date.now()
  const windowStart = now - rangeDays * DAY_MS
  const prevStart = now - 2 * rangeDays * DAY_MS

  const users = await listAllUsers()
  const entitlements = await readEntitlements()

  // ── Account KPIs (Firebase Auth) ──
  const totalUsers = users.length
  let newUsers = 0
  let newUsersPrev = 0
  const activeUids: string[] = []
  let activeUsers = 0
  let dau = 0
  let wau = 0
  let mau = 0

  const signupDays = emptyDays(rangeDays, now)
  const activeDays = emptyDays(rangeDays, now)

  for (const u of users) {
    const created = parseTime(u.metadata.creationTime)
    if (created != null) {
      if (created >= windowStart) {
        newUsers++
        const k = dayKey(created)
        if (signupDays.has(k)) signupDays.set(k, (signupDays.get(k) ?? 0) + 1)
      } else if (created >= prevStart) {
        newUsersPrev++
      }
    }
    const active = lastActiveMs(u)
    if (active != null) {
      if (active >= windowStart) {
        activeUsers++
        activeUids.push(u.uid)
        const k = dayKey(active)
        if (activeDays.has(k)) activeDays.set(k, (activeDays.get(k) ?? 0) + 1)
      }
      if (active >= now - 1 * DAY_MS) dau++
      if (active >= now - 7 * DAY_MS) wau++
      if (active >= now - 28 * DAY_MS) mau++
    }
  }

  // ── Revenue (entitlements) ──
  let mrr = 0
  let subscribers = 0
  for (const e of entitlements.values()) {
    if (e.paying || e.trialing) subscribers++
    mrr += e.monthly
  }
  mrr = Math.round(mrr * 100) / 100

  const avgAdherence = await averageAdherence(activeUids)

  // Subscribers & MRR daily: cumulative count/revenue of entitlements started on
  // or before each day (entitlements with no start date count from day one).
  const subDays = emptyDays(rangeDays, now)
  const mrrDays = emptyDays(rangeDays, now)
  for (const day of subDays.keys()) {
    const dayEnd = Date.parse(day) + DAY_MS - 1
    let s = 0
    let r = 0
    for (const e of entitlements.values()) {
      if (e.startMs == null || e.startMs <= dayEnd) {
        s++
        r += e.monthly
      }
    }
    subDays.set(day, s)
    mrrDays.set(day, Math.round(r * 100) / 100)
  }

  // totalUsers vs the prior period = total minus this window's sign-ups.
  const totalPrev = totalUsers - newUsers
  const kpis: Record<string, Kpi> = {
    totalUsers: { value: totalUsers, prev: totalPrev > 0 ? totalPrev : null },
    newUsers: { value: newUsers, prev: newUsersPrev > 0 ? newUsersPrev : null },
    activeUsers: { value: activeUsers, prev: null },
    avgAdherence: { value: avgAdherence, prev: null },
    dau: { value: dau, prev: null },
    wau: { value: wau, prev: null },
    mau: { value: mau, prev: null },
    mrr: { value: mrr, prev: null },
  }

  return {
    rangeDays,
    generatedAt: new Date(now).toISOString(),
    kpis,
    series: {
      activeUsersDaily: toSeries(activeDays),
      newSignupsDaily: toSeries(signupDays),
      subscribersMrr: [...subDays.keys()].map((date) => ({
        date,
        subscribers: subDays.get(date) ?? 0,
        mrr: mrrDays.get(date) ?? 0,
      })),
      // App opens: proxied from per-day last-active buckets (Auth exposes only a
      // last-active time per user, not every open). Swap for an events collection
      // later for exact opens.
      appOpensDaily: toSeries(activeDays),
    },
    notes: {
      adherenceSampled: activeUids.length > MAX_ADHERENCE_SCANS,
      appOpensAreProxy: true,
    },
  }
})

export const adminUsers = onCall({ enforceAppCheck: false }, async (req) => {
  requireOwner(req)
  const limit = Math.min(Math.max(Number(req.data?.limit) || 200, 1), 2000)

  const users = await listAllUsers()
  const entitlements = await readEntitlements()
  if (users.length > MAX_USERS) throw new HttpsError('resource-exhausted', 'Too many users to list.')

  const rows = users
    .map((u) => {
      const ent = entitlements.get(u.uid)
      return {
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        createdAt: parseTime(u.metadata.creationTime),
        lastActive: lastActiveMs(u),
        disabled: u.disabled,
        subscription: ent ? ent.label : 'Free',
        mrr: ent?.monthly ?? 0,
      }
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit)

  return { count: users.length, returned: rows.length, rows }
})
