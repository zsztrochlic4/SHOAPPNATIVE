/**
 * Pure serialisation for "Download my data" (the GDPR/privacy companion to in-app
 * account deletion). Kept free of React Native / Firebase so it compiles under
 * tsconfig.sweep.json and is unit-tested in Node; the delivery (web download /
 * native share) and the cloud gather live elsewhere.
 *
 * The output is a single portable JSON document: a manifest, the profile scalars,
 * and every log collection — deterministic (keys sorted), with all timestamps as
 * ISO-8601 strings and `undefined` stripped, so two exports of the same data are
 * byte-identical and diffable.
 */

export const EXPORT_VERSION = 2

/**
 * Explicit export scope (audit F-040): what "Download my data" does and does
 * not contain, embedded in every export so the user can tell without asking.
 * Keep in step with functions/src/account.ts (the deletion registry) and
 * docs/PRIVACY.md.
 */
export const EXPORT_SCOPE = {
  included: [
    'Profile, settings and goals (users/{uid} root document)',
    'Workout sessions, set logs, programs, workout instances, progression state',
    'Weights, habits, meals, activities, food reviews, workout summaries',
    'Chat and coach-thread transcripts, notifications, push token records',
    'Coach workspace: consent/preferences, memories, conversation summaries, insights, proposals, actions, turns',
    'Community competition profile (handle, tier, points, streak) and the per-day scoring log used for leaderboards',
    'Subscription entitlement record (status, period end — no payment details)',
  ],
  excluded: [
    'Operational coach safety state (restricted; not client-readable by design)',
    'Server rate-limit counters (auto-expire within days; no content)',
    'Anonymised deletion audit records (retained for legal accountability)',
    'Card/payment details (held by Stripe, never by StrengthHub)',
  ],
} as const

export interface UserExport {
  /** Profile / settings scalars (the root user document, minus the log arrays). */
  profile: Record<string, unknown>
  /** Each log collection as an array (sessions, meals, weights, …). */
  collections: Record<string, unknown[]>
  /** Where the data was gathered from. */
  source?: 'cloud' | 'local'
}

/** Looks like a Firestore Timestamp (client `{seconds,nanoseconds}` or admin `{_seconds,…}`). */
function timestampToISO(v: any): string | null {
  if (v && typeof v.toDate === 'function') {
    try {
      return v.toDate().toISOString()
    } catch {
      return null
    }
  }
  const s = typeof v?.seconds === 'number' ? v.seconds : typeof v?._seconds === 'number' ? v._seconds : null
  if (s == null) return null
  const ns = typeof v?.nanoseconds === 'number' ? v.nanoseconds : typeof v?._nanoseconds === 'number' ? v._nanoseconds : 0
  const d = new Date(s * 1000 + Math.round(ns / 1e6))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Normalise a value tree for export: Dates and Firestore Timestamps → ISO strings,
 * object keys sorted for a deterministic result, `undefined` dropped. Arrays keep
 * their order (log order is meaningful); only object *keys* are sorted.
 */
export function normalizeForExport(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalizeForExport)
  if (typeof value === 'object') {
    const iso = timestampToISO(value)
    if (iso != null) return iso
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key]
      if (v === undefined) continue
      out[key] = normalizeForExport(v)
    }
    return out
  }
  return value
}

/**
 * Split a flat local state object into the export shape: array-valued slices (the
 * user's logs — sessions, weights, badges, …) become `collections`, everything
 * else (scalars/objects — profile, settings) becomes `profile`. Used for the
 * offline / demo export path, where the whole AppState is the source.
 */
export function splitLocalState(state: Record<string, unknown>): UserExport {
  const profile: Record<string, unknown> = {}
  const collections: Record<string, unknown[]> = {}
  for (const [key, value] of Object.entries(state ?? {})) {
    if (Array.isArray(value)) collections[key] = value
    else profile[key] = value
  }
  return { profile, collections, source: 'local' }
}

/** A stable, dated filename for the export, e.g. `strengthhub-data-2026-07-31.json`. */
export function buildExportFilename(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10)
  return `strengthhub-data-${day}.json`
}

/**
 * Build the export JSON string: a manifest (version, timestamp, per-collection
 * counts), the normalised profile, and the normalised collections. Deterministic
 * for identical input + `now`.
 */
export function serializeUserExport(input: UserExport, now: Date = new Date()): string {
  const collections = input.collections ?? {}
  const counts: Record<string, number> = {}
  for (const key of Object.keys(collections).sort()) {
    counts[key] = Array.isArray(collections[key]) ? collections[key].length : 0
  }
  const doc = {
    _manifest: {
      app: 'StrengthHub Online',
      exportVersion: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      source: input.source ?? 'local',
      counts,
      scope: EXPORT_SCOPE,
    },
    profile: normalizeForExport(input.profile ?? {}),
    collections: normalizeForExport(collections),
  }
  return JSON.stringify(doc, null, 2)
}
