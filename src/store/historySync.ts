/**
 * Bridge that lets any screen ask for the lazy full-history load (Phase C)
 * without prop-drilling. `CloudSync` owns the load and registers its
 * implementation on mount; screens that need the complete history (e.g.
 * Progress, which renders all-time charts) call `ensureFullHistory()` from a
 * mount effect. This mirrors the existing module-singleton pattern used for the
 * coach-session reset.
 *
 * `ensureFullHistory` is idempotent and self-guarding: a no-op when signed out,
 * in demo mode, still loading, or already fully loaded.
 */
let ensureImpl: (() => void) | null = null

/** Called by CloudSync to (de)register the active implementation. */
export function registerEnsureFullHistory(fn: (() => void) | null): void {
  ensureImpl = fn
}

/** Request the remaining (older) history be loaded, if it hasn't been already. */
export function ensureFullHistory(): void {
  ensureImpl?.()
}
