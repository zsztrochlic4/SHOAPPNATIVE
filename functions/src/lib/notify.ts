/**
 * Pure notification-sender helpers (Phase D). No firebase-admin / firebase-functions
 * imports, so this unit-tests in plain Node. The orchestration that touches
 * Firestore and the Expo Push API lives in ./send.ts.
 *
 * Quiet-hours logic mirrors the client's src/lib/quietHours.ts (the source of
 * truth for behaviour); it is duplicated here because the two run in separate
 * TypeScript projects that can't share a module.
 */

export type PushCategory = 'general' | 'workout' | 'streak'

/** The subset of the user's notification prefs the server needs. */
export interface NotifPrefs {
  workoutReminder?: boolean
  streakReminder?: boolean
  quiet?: boolean
  quietStartHour?: number
  quietEndHour?: number
}

/** One registered device, joined with its owner's notification settings. */
export interface RecipientToken {
  token: string
  uid: string
  /** Device UTC offset in minutes (e.g. AEST = +600), for local-time quiet hours. */
  utcOffsetMinutes?: number
  /** The user's master notifications toggle; only an explicit `false` blocks. */
  notificationsEnabled?: boolean
  prefs?: NotifPrefs
}

/** Split `items` into batches of at most `size` (Expo accepts ≤100 per request). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** The device's local hour (0–23) given minutes-since-UTC-midnight + its offset. */
export function localHour(nowUtcMinutes: number, utcOffsetMinutes = 0): number {
  const local = (((nowUtcMinutes + utcOffsetMinutes) % 1440) + 1440) % 1440
  return Math.floor(local / 60)
}

/** Is `hour` inside the quiet window [startH, endH)? Handles windows that wrap midnight. */
export function inQuietHours(hour: number, startH: number, endH: number): boolean {
  if (startH === endH) return false
  return startH < endH ? hour >= startH && hour < endH : hour >= startH || hour < endH
}

export interface FilterOpts {
  /** Minutes since UTC midnight "now", for per-device local-time quiet hours. */
  nowUtcMinutes: number
  /** Which category this send is; category opt-outs only apply to workout/streak. */
  category?: PushCategory
  /** Send even to devices currently inside their quiet window (e.g. an urgent notice). */
  override?: boolean
}

/**
 * Drop tokens that shouldn't receive this send — master toggle off, the relevant
 * category opted out, or (unless overridden) the device is inside quiet hours —
 * and de-duplicate tokens. Returns the deliverable set and how many were filtered.
 */
export function filterRecipients(
  tokens: readonly RecipientToken[],
  opts: FilterOpts,
): { send: RecipientToken[]; skipped: number } {
  const seen = new Set<string>()
  const send: RecipientToken[] = []
  let skipped = 0
  for (const t of tokens) {
    if (!t.token || seen.has(t.token)) continue // dedupe; duplicates aren't "skipped"
    seen.add(t.token)
    if (allow(t, opts)) send.push(t)
    else skipped++
  }
  return { send, skipped }
}

function allow(t: RecipientToken, opts: FilterOpts): boolean {
  if (t.notificationsEnabled === false) return false // master toggle off
  const prefs = t.prefs ?? {}
  const category = opts.category ?? 'general'
  if (category === 'workout' && prefs.workoutReminder === false) return false
  if (category === 'streak' && prefs.streakReminder === false) return false
  if (!opts.override && prefs.quiet && prefs.quietStartHour != null && prefs.quietEndHour != null) {
    const h = localHour(opts.nowUtcMinutes, t.utcOffsetMinutes ?? 0)
    if (inQuietHours(h, prefs.quietStartHour, prefs.quietEndHour)) return false
  }
  return true
}

/** One entry from the Expo Push API's per-message response array. */
export interface ExpoTicket {
  status: string // 'ok' | 'error'
  details?: { error?: string }
}

/**
 * Map Expo's per-message tickets (positional, 1:1 with the tokens sent) back to
 * tokens: count ok vs error, and collect the tokens to PRUNE — those Expo reports
 * as `DeviceNotRegistered` (the app was uninstalled / token rotated).
 */
export function classifyTickets(
  tokens: readonly string[],
  tickets: readonly ExpoTicket[],
): { prune: string[]; ok: number; errors: number } {
  const prune: string[] = []
  let ok = 0
  let errors = 0
  tokens.forEach((tok, i) => {
    const t = tickets[i]
    if (!t || t.status === 'ok') {
      ok++
      return
    }
    errors++
    if (t.details?.error === 'DeviceNotRegistered') prune.push(tok)
  })
  return { prune, ok, errors }
}
