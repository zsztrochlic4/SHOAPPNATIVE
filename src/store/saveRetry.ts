/**
 * Capped exponential backoff for retrying a failed cloud save (CloudSync).
 * Pure + node-safe so the schedule is unit-tested. A failed save must be retried
 * even if no further edit follows, or the user's last change could be silently
 * lost on a flaky connection.
 */
export const MAX_SAVE_RETRIES = 4

/** Delay (ms) before retry attempt `attempt` (0-based): 4s, 8s, 16s, then capped 30s. */
export function saveBackoffMs(attempt: number, base = 4000, cap = 30000): number {
  if (attempt <= 0) return base
  return Math.min(cap, base * 2 ** attempt)
}
