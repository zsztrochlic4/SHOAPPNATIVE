/**
 * Crash / error reporting seam.
 *
 * There is no crash service wired yet (no Sentry native module — that needs a dev
 * build + an owner DSN). This is the single choke-point every unexpected error
 * should flow through, so wiring one later is a one-liner: call `setErrorReporter`
 * once at startup with e.g. Sentry's `captureException`, and every existing call
 * site starts reporting. Until then it logs, which is at least visible in dev +
 * the device console. See docs/CRASH_REPORTING.md.
 */
export type ErrorReporter = (error: unknown, context?: Record<string, unknown>) => void

let reporter: ErrorReporter | null = null

/** Register the crash reporter (e.g. Sentry). Pass null to clear. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next
}

/** Report an unexpected error. Never throws — reporting must not cause a second failure. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  try {
    console.error('[reportError]', error, context ?? {})
    reporter?.(error, context)
  } catch {
    /* a broken reporter must never take down the app */
  }
}
