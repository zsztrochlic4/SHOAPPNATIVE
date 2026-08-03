/**
 * Coach request controls (audit SA-011) — idempotency, burst and global cost
 * caps, expressed as PURE, unit-tested policy so the activation-blocker
 * guarantees are provable. The server (functions/src/coach.ts + lib/rateLimit.ts)
 * wires these to Firestore; the coach stays gated OFF (COACH_ENABLED) regardless.
 *
 * Why each exists:
 *  • Idempotency — a client retry (or a double-tap) must not produce a second
 *    Gemini call, usage increment and stored turn. The client sends a stable
 *    `requestKey` per user message and REUSES it on retry; the server claims it
 *    once and returns the cached result on a repeat.
 *  • Burst cap — the daily cap alone allows 25 calls in one second. A short
 *    rolling window bounds the per-user spike.
 *  • Global daily cap — protects the overall model budget from a coordinated
 *    spike across many users (a "safe scale" control the audit called out as
 *    missing), independent of any single user's daily cap.
 */

/** Per-user short-burst window: at most BURST_MAX turns per BURST_WINDOW_SEC. */
export const COACH_BURST_MAX = 5
export const COACH_BURST_WINDOW_SEC = 60

/** Aggregate ceiling across ALL users per UTC day — the global budget guard. */
export const COACH_GLOBAL_DAILY_MAX = 20_000

/** Bounds on a client-supplied idempotency key (defends the claim-doc id). */
export const REQUEST_KEY_MAX_LEN = 100
const REQUEST_KEY_RE = /^[A-Za-z0-9._-]{8,100}$/

/** Whether a client-provided request key is well-formed (else the server ignores it). */
export function isValidRequestKey(key: unknown): key is string {
  return typeof key === 'string' && REQUEST_KEY_RE.test(key)
}

/** The Firestore claim-doc id for an idempotent coach request. */
export function coachClaimDocId(uid: string, requestKey: string): string {
  return `${uid}_${requestKey}`
}

/** Whether one more unit fits under a cap (shared by burst + global + daily checks). */
export function withinLimit(currentCount: number, max: number): boolean {
  return currentCount < max
}

/** A rolling-window bucket id (uid + window index) for the burst limiter. */
export function burstBucketId(uid: string, nowMs: number, windowSec: number = COACH_BURST_WINDOW_SEC): string {
  const windowIndex = Math.floor(nowMs / (windowSec * 1000))
  return `coachburst_${uid}_${windowIndex}`
}
