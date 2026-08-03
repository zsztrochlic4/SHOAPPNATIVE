/**
 * Pure throttle policy for the remote crash reporter (audit SA-014).
 *
 * Kept firebase-free so the "never flood the backend" guarantee is unit-tested
 * (remoteErrorReporter.ts wires it to the callable). Enforces both a minimum
 * interval between sends (debounce a crash loop) and a per-window ceiling.
 */

/** Minimum gap between remote sends, the rolling window, and the per-window cap. */
export const REMOTE_MIN_INTERVAL_MS = 5_000
export const REMOTE_WINDOW_MS = 60_000
export const REMOTE_MAX_PER_WINDOW = 10

/**
 * Decide whether a report may be sent now given the recent send timestamps.
 * Returns the decision and the pruned history to carry forward — no hidden
 * state, so it is fully testable.
 */
export function shouldSendReport(
  history: number[],
  now: number,
): { send: boolean; history: number[] } {
  const recent = history.filter((t) => now - t < REMOTE_WINDOW_MS)
  const last = recent[recent.length - 1]
  if (last != null && now - last < REMOTE_MIN_INTERVAL_MS) return { send: false, history: recent }
  if (recent.length >= REMOTE_MAX_PER_WINDOW) return { send: false, history: recent }
  return { send: true, history: [...recent, now] }
}
