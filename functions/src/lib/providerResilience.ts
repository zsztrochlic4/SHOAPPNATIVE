/**
 * Provider-call resilience for the coach's Gemini calls (audit R5-015).
 *
 * The coach is the one expensive, model-calling callable. Previously each `generateContent`
 * relied solely on the 60 s Cloud Function timeout: a hung or overloaded provider wasted the
 * whole budget (and tokens), and a spike produced retry storms with no backpressure. This wraps
 * every provider call with:
 *   • an explicit per-attempt DEADLINE (well under the function timeout), enforced with an
 *     AbortController so the request is abandoned instead of hanging;
 *   • BOUNDED retry with full-jitter exponential backoff, but only for transient failures
 *     (timeouts, 429/5xx, network resets) — never for a deterministic bad request;
 *   • a per-instance CIRCUIT BREAKER that, after repeated transient failures, short-circuits
 *     further calls for a cooldown so a struggling provider isn't hammered;
 *   • a typed OVERLOAD result (resource-exhausted + retryAfterSec) the caller can surface to the
 *     client instead of a silent hang.
 *
 * The breaker state is in-process (per warm instance) — a lightweight, dependency-free layer of
 * backpressure; a cross-instance breaker would need shared state and is deliberately out of scope.
 */
import { HttpsError } from 'firebase-functions/v2/https'

export interface ResilienceOptions {
  /** Stable key for breaker state + telemetry, e.g. 'coach_reply' / 'coach_classify'. */
  label: string
  /** Per-attempt provider deadline in ms (must be < the function timeout). */
  deadlineMs: number
  /** Total attempts including the first (default 2). */
  maxAttempts?: number
  /** Base backoff in ms for the first retry (default 400). */
  baseBackoffMs?: number
  /** Backoff ceiling in ms (default 4000). */
  maxBackoffMs?: number
  // Injectable seams for deterministic tests.
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

interface Breaker {
  consecutiveFailures: number
  openUntil: number
}

const BREAKER_THRESHOLD = 5
const BREAKER_COOLDOWN_MS = 15_000
const breakers = new Map<string, Breaker>()

/** Test-only: clear breaker state between cases. */
export function __resetBreakers(): void {
  breakers.clear()
}

/** Retry-After hint (seconds) advertised on an overload, aligned to the breaker cooldown. */
export const OVERLOAD_RETRY_AFTER_SEC = Math.ceil(BREAKER_COOLDOWN_MS / 1000)

/**
 * Whether an error looks like a transient/overload provider failure worth retrying, as opposed to
 * a deterministic client error (bad request, safety refusal) that a retry would only repeat.
 */
export function isTransientProviderError(e: unknown): boolean {
  const err = e as { status?: number; code?: number | string; name?: string; message?: string } | null
  const status = typeof err?.status === 'number' ? err.status : typeof err?.code === 'number' ? err.code : undefined
  if (status != null && (status === 429 || (status >= 500 && status <= 599))) return true
  if (err?.name === 'AbortError' || err?.name === 'GoogleGenerativeAIAbortError') return true
  const msg = (err?.message ?? '').toLowerCase()
  return /\b(429|500|502|503|504)\b|abort|timed? ?out|deadline|unavailable|overload|rate.?limit|econnreset|etimedout|socket hang|network/.test(msg)
}

/** The typed overload the caller surfaces to the client (never a silent hang). */
export function overloadError(label: string): HttpsError {
  return new HttpsError('resource-exhausted', 'coach_overloaded', {
    label,
    retryAfterSec: OVERLOAD_RETRY_AFTER_SEC,
  })
}

/**
 * Run a provider call with a deadline, bounded jittered retry and a per-instance circuit breaker.
 * `fn` receives an AbortSignal it MUST forward to the provider so the deadline actually cancels the
 * in-flight request. Transient exhaustion (or an open breaker) throws {@link overloadError}; a
 * non-transient error propagates unchanged so existing structured-fallback handling still applies.
 */
export async function callWithResilience<T>(
  fn: (signal: AbortSignal, attempt: number) => Promise<T>,
  opts: ResilienceOptions,
): Promise<T> {
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const random = opts.random ?? Math.random
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2)
  const base = opts.baseBackoffMs ?? 400
  const maxBackoff = opts.maxBackoffMs ?? 4000

  const br = breakers.get(opts.label) ?? { consecutiveFailures: 0, openUntil: 0 }
  breakers.set(opts.label, br)
  if (now() < br.openUntil) throw overloadError(opts.label)

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.deadlineMs)
    try {
      const out = await fn(controller.signal, attempt)
      br.consecutiveFailures = 0
      br.openUntil = 0
      return out
    } catch (e) {
      lastErr = e
      const transient = isTransientProviderError(e)
      if (!transient) throw e // deterministic failure — don't retry, don't trip the breaker
      if (attempt >= maxAttempts) {
        br.consecutiveFailures += 1
        if (br.consecutiveFailures >= BREAKER_THRESHOLD) br.openUntil = now() + BREAKER_COOLDOWN_MS
        throw overloadError(opts.label)
      }
      // Full-jitter exponential backoff.
      const capped = Math.min(maxBackoff, base * 2 ** (attempt - 1))
      await sleep(Math.floor(capped * (0.5 + random() * 0.5)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}
