/**
 * Sign-out safe hand-off: lets AuthProvider ask CloudSync to flush any pending
 * debounced save BEFORE the session ends and the local slot is cleared, so the
 * user's last edit isn't lost to the 800ms save debounce. Same registration
 * pattern as historySync. Resolves quickly (bounded) and never throws.
 */

let flushImpl: (() => Promise<void>) | null = null

export function registerCloudFlush(impl: (() => Promise<void>) | null): void {
  flushImpl = impl
}

/** Flush pending cloud writes, bounded to `timeoutMs`. Best-effort. */
export async function requestCloudFlush(timeoutMs = 4000): Promise<void> {
  if (!flushImpl) return
  try {
    await Promise.race([
      flushImpl(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ])
  } catch {
    /* best-effort */
  }
}
