/**
 * Pure quiet-hours time logic — no React Native / Expo imports, so it can be
 * unit-tested under the node-only sweep config. `notifications.ts` re-exports
 * these and uses them when reconciling scheduled local reminders.
 */

/** Is `hour` inside the quiet window [startH, endH)? Handles windows that wrap midnight. */
export function inQuietHours(hour: number, startH: number, endH: number): boolean {
  if (startH === endH) return false
  return startH < endH ? hour >= startH && hour < endH : hour >= startH || hour < endH
}

/**
 * The hour a reminder should actually fire at, given the user's preferred `hour`.
 * If quiet hours are off, or the preferred hour is already outside the quiet
 * window, it is returned unchanged. If it falls inside the quiet window
 * [startH, endH), it is DEFERRED to endH — the first valid hour after the
 * window — rather than dropped entirely (the old behaviour silently cancelled
 * the reminder). Result is always normalised to 0–23.
 */
export function nextAllowedHour(
  hour: number,
  quietEnabled: boolean,
  startH: number,
  endH: number,
): number {
  const norm = (h: number) => ((Math.trunc(h) % 24) + 24) % 24
  if (!quietEnabled) return norm(hour)
  if (!inQuietHours(hour, startH, endH)) return norm(hour)
  return norm(endH)
}
