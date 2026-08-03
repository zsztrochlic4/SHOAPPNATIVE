/**
 * Remote crash reporter (audit SA-014). Wires the `reportError` seam
 * (src/lib/reportError.ts) to the trusted backend so production crashes are
 * VISIBLE to the team, not just held in the on-device ring buffer.
 *
 * Only a REDACTED record leaves the device (error name + truncated message +
 * tag + time — never user content or health data; the server re-redacts too).
 * Sending is throttled and strictly best-effort: a diagnostics failure must
 * never cause a second failure. When Firebase isn't configured it's a no-op, so
 * the demo/preview is unaffected.
 *
 * The throttle is a pure, unit-tested policy (src/lib/reportThrottle.ts) so the
 * "never flood the backend" guarantee is provable — this module just wires it to
 * the callable.
 */
import { httpsCallable } from 'firebase/functions'
import { functions, firebaseEnabled } from './firebase'
import { setErrorReporter, toErrorRecord, type ErrorReporter } from './reportError'
import { shouldSendReport } from './reportThrottle'

let sendHistory: number[] = []

/**
 * Register the remote reporter. Safe no-op when Firebase is unconfigured. Call
 * once at startup, after installGlobalErrorHooks().
 */
export function installRemoteErrorReporter(): void {
  if (!firebaseEnabled || !functions) return
  const reporter: ErrorReporter = (error, context) => {
    try {
      const now = Date.now()
      const decision = shouldSendReport(sendHistory, now)
      sendHistory = decision.history
      if (!decision.send) return
      const record = toErrorRecord(error, context)
      const call = httpsCallable(functions!, 'reportClientError', { timeout: 10_000 })
      // Fire-and-forget; swallow everything — diagnostics must never re-throw.
      void call({ ...record, fatal: context?.tag === 'fatal' }).catch(() => {})
    } catch {
      /* never let reporting cause a second failure */
    }
  }
  setErrorReporter(reporter)
}

/** Test hook: reset the throttle window. */
export function __resetRemoteReporterForTests(): void {
  sendHistory = []
}
