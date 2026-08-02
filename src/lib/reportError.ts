/**
 * Crash / error reporting seam (audit F-034).
 *
 * No third-party crash SDK ships yet — that needs an owner decision on the
 * service + privacy posture (docs/CRASH_REPORTING.md). Until then this module
 * makes failures OPERABLE rather than invisible:
 *
 *  1. every unexpected error flows through `reportError` (single choke-point;
 *     wiring Sentry later is one `setErrorReporter` call at startup),
 *  2. `installGlobalErrorHooks()` catches uncaught JS errors + unhandled
 *     promise rejections app-wide,
 *  3. a bounded, PRIVACY-SAFE local ring buffer keeps the last few redacted
 *     records (error name + truncated message + tag + time — never user
 *     content, never health data) so support can diagnose from a device.
 */
export type ErrorReporter = (error: unknown, context?: Record<string, unknown>) => void

let reporter: ErrorReporter | null = null

/** Register the crash reporter (e.g. Sentry). Pass null to clear. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next
}

/* ------------------- redacted local ring buffer ------------------- */

export interface ErrorRecord {
  at: string
  name: string
  message: string
  tag: string
}

const BUFFER_KEY = 'sho.errorlog.v1'
const BUFFER_MAX = 50

/** Redact an error to a support-safe record: no payloads, no user content. */
export function toErrorRecord(error: unknown, context?: Record<string, unknown>, now: Date = new Date()): ErrorRecord {
  const e = error as { name?: unknown; message?: unknown } | null
  return {
    at: now.toISOString(),
    name: String(e?.name ?? typeof error).slice(0, 60),
    message: String(e?.message ?? error ?? 'unknown').slice(0, 200),
    tag: String(context?.tag ?? context?.source ?? '').slice(0, 60),
  }
}

async function appendToBuffer(record: ErrorRecord): Promise<void> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
    const raw = await AsyncStorage.getItem(BUFFER_KEY)
    const list: ErrorRecord[] = raw ? JSON.parse(raw) : []
    list.push(record)
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(list.slice(-BUFFER_MAX)))
  } catch {
    /* diagnostics must never cause a second failure */
  }
}

/** The recent redacted error records (for a future support/diagnostics view). */
export async function readErrorLog(): Promise<ErrorRecord[]> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
    const raw = await AsyncStorage.getItem(BUFFER_KEY)
    return raw ? (JSON.parse(raw) as ErrorRecord[]) : []
  } catch {
    return []
  }
}

/** Report an unexpected error. Never throws — reporting must not cause a second failure. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  try {
    console.error('[reportError]', error, context ?? {})
    void appendToBuffer(toErrorRecord(error, context))
    reporter?.(error, context)
  } catch {
    /* a broken reporter must never take down the app */
  }
}

/* ---------------------- global hooks ---------------------- */

let hooksInstalled = false

/**
 * Catch uncaught errors app-wide (audit F-034): RN's ErrorUtils global handler
 * on native, window error/unhandledrejection on web. Chains to any existing
 * handler so default crash behaviour is preserved.
 */
export function installGlobalErrorHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true
  try {
    type GlobalWithErrorUtils = { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }
    const eu = (globalThis as GlobalWithErrorUtils).ErrorUtils
    if (eu?.setGlobalHandler) {
      const prev = eu.getGlobalHandler()
      eu.setGlobalHandler((e, fatal) => {
        reportError(e, { tag: fatal ? 'fatal' : 'uncaught' })
        prev?.(e, fatal)
      })
    }
    const g = globalThis as { addEventListener?: (type: string, handler: (ev: { reason?: unknown }) => void) => void }
    if (typeof g.addEventListener === 'function') {
      g.addEventListener('unhandledrejection', (ev) => {
        reportError(ev?.reason ?? 'unhandled rejection', { tag: 'unhandledrejection' })
      })
    }
  } catch {
    /* hooks are best-effort */
  }
}
