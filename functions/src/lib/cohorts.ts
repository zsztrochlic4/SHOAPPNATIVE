/**
 * Weekly league cohorts — pure allocator helpers (audit F-005).
 *
 * WHY: today a whole tier is one bucket, so promotion odds vanish at scale and
 * read cost grows ~quadratically, while the UI promises a league of "~25". These
 * helpers let the community backend place each user into a small, immutable weekly
 * cohort (target 25, hard cap 30) segmented — adaptively — by tier, then timezone,
 * then activity band, so the ~25 promise holds at every population.
 *
 * This module is intentionally PURE (no firebase-admin, no Date.now inside the
 * ranking math): every function is deterministic in its inputs so it can be unit-
 * tested without the emulator (see functions/test/cohorts.test.mjs), matching the
 * repo's lib/rateLimit.ts convention. The transactional Firestore allocation that
 * consumes these lives in functions/src/community.ts.
 */

/** Target cohort size (what we aim to fill to) and the hard ceiling a cohort may
 *  ever reach — late joiners past the target land here until it hits the cap. */
export const COHORT_TARGET = 25
export const COHORT_CAP = 30

/** Once a segment has accumulated this many cohorts (~SPLIT_AT × TARGET active
 *  users), it has enough population to afford homogeneous sub-cohorts, so the
 *  allocator splits it one level finer (tier → +timezone → +activity band). At
 *  launch scale a tier is a single segment and cohorts still fill to ~25. */
export const SPLIT_AT = 4

/** Version of the tie-break encoding baked into `rankKey`. Bump when the encoding
 *  changes; stored alongside every member/cohort so historical weeks stay legible.
 *  Reads never branch on it — the key is self-contained and rollover resets weekly,
 *  so a cohort is never mixed-version. */
export const TIE_RULES_VERSION = 1

/** The app's home timezone — the default bucket when a client doesn't send its tz
 *  (mirrors community.ts APP_TZ; kept local so this module stays dependency-free). */
export const DEFAULT_TZ = 'Australia/Sydney'

/** Session-count thresholds for the activity band: <3 → 0, 3–4 → 1, ≥5 → 2. Bands
 *  are frequency, never load/nutrition — they match the "showing up" ethos and are
 *  hard to game. */
export const BAND_THRESHOLDS = [3, 5] as const

const clampInt = (v: unknown, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : min
  return Math.max(min, Math.min(max, n))
}

/** Coarse activity band (0|1|2) from this week's session count. */
export function bandOf(sessionsThisWeek: number): number {
  const s = clampInt(sessionsThisWeek, 0, 1000)
  let band = 0
  for (const t of BAND_THRESHOLDS) if (s >= t) band++
  return band
}

/** Coarse timezone bucket — the UTC offset (as `±HHMM`) of the given IANA zone at
 *  `atMs`. Users on the same offset share a bucket so a cohort's week resets feel
 *  aligned. Absent tz → the app's home zone; an unparseable zone → the neutral
 *  `+0000` bucket (safe: tz only gates cohorts once a tier is already large). */
export function tzBucketOf(tz: string | undefined | null, atMs: number): string {
  const zone = tz && tz.length ? tz : DEFAULT_TZ
  try {
    const label = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date(atMs))
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
    // label is like "GMT+10", "GMT+10:30", "GMT-5", or plain "GMT" (== UTC).
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(label)
    if (!m) return '+0000'
    return `${m[1]}${m[2].padStart(2, '0')}${m[3] ?? '00'}`
  } catch {
    return '+0000'
  }
}

/** The segment key a user maps to at a given segmentation `level`. The allocator
 *  fills one open cohort per segment key; coarser levels merge more users so
 *  cohorts stay full at low population.
 *    L0: `t{tier}`            — tier only (launch default)
 *    L1: `t{tier}|z{tz}`      — + timezone
 *    L2: `t{tier}|z{tz}|b{band}` — + activity band */
export function segmentKeyForLevel(tier: number, tzBucket: string, band: number, level: number): string {
  const base = `t${tier}`
  if (level <= 0) return base
  if (level === 1) return `${base}|z${tzBucket}`
  return `${base}|z${tzBucket}|b${band}`
}

/** The next segmentation level for a segment that now holds `cohortCount` cohorts.
 *  Levels only ever increase and cap at 2, and a level change affects only FUTURE
 *  joiners — members already placed keep their immutable cohort for the week. */
export function nextLevel(cohortCount: number, level: number): number {
  if (level >= 2) return 2
  return cohortCount >= SPLIT_AT ? level + 1 : level
}

export interface RankInput {
  points: number
  sessionsThisWeek: number
  joinedAtMillis: number
  uid: string
}

/** A single ascending sort key encoding the full tie-break order so ranking needs
 *  no composite index (one `orderBy('rankKey')` gives rank 1..N):
 *    points desc → sessionsThisWeek desc → joinedAt asc (earlier wins) → uid asc.
 *  Fixed-width numeric segments keep lexical order == numeric order. `version` is
 *  accepted for forward-compat; only v1 exists today. */
export function rankKeyFor(m: RankInput, version: number = TIE_RULES_VERSION): string {
  void version // only the v1 encoding exists; kept for explicit call-site intent
  const points = clampInt(m.points, 0, 100)
  const sessions = clampInt(m.sessionsThisWeek, 0, 50)
  const joined = clampInt(m.joinedAtMillis, 0, 9_999_999_999_999) // 13 digits (ms since epoch)
  const pointsPart = String(100 - points).padStart(3, '0') // higher points → smaller → ranks first
  const sessPart = String(50 - sessions).padStart(2, '0') // more sessions → smaller
  const joinPart = String(joined).padStart(13, '0') // earlier join → smaller
  return `${pointsPart}${sessPart}${joinPart}${String(m.uid ?? '')}`
}
