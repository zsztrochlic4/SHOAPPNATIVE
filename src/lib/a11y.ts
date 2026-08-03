import { useSyncExternalStore, useEffect, type RefObject } from 'react'
import { AccessibilityInfo, Platform, findNodeHandle } from 'react-native'

type FocusTarget = Parameters<typeof findNodeHandle>[0]

/**
 * Reduce-motion support, on every platform (audit F-018).
 *
 * `prefersReducedMotion()` stays synchronous (dozens of call sites gate loops,
 * vibration and celebratory motion on it):
 *  - web: reads the media query live,
 *  - native: reads a cached value that `AccessibilityInfo` seeds at module
 *    load and keeps current via the `reduceMotionChanged` event — previously
 *    the native path always returned false, so iOS/Android users who enabled
 *    Reduce Motion still got looping/celebratory motion and vibration.
 *
 * `useReducedMotion()` is the reactive form for components that should
 * re-render when the OS setting changes mid-session.
 */

let nativeReduceMotion = false
const listeners = new Set<() => void>()

// User-facing reduced-motion override (audit SA-013/SA-017). 'system' follows the
// OS setting; 'reduce'/'full' let the user force it either way from Settings —
// the audit asked for an in-app override, not just OS mirroring. Set on hydrate
// and on toggle; persisted in state.settings.reducedMotion.
export type ReducedMotionPreference = 'system' | 'reduce' | 'full'
let reducedMotionPref: ReducedMotionPreference = 'system'

export function setReducedMotionPreference(pref: ReducedMotionPreference): void {
  if (reducedMotionPref === pref) return
  reducedMotionPref = pref
  listeners.forEach((l) => l())
}

if (Platform.OS !== 'web') {
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      nativeReduceMotion = !!enabled
      listeners.forEach((l) => l())
    })
    .catch(() => {})
  AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
    nativeReduceMotion = !!enabled
    listeners.forEach((l) => l())
  })
}

/** The OS-level reduce-motion signal, before the user override is applied. */
function osReducedMotion(): boolean {
  if (typeof window !== 'undefined' && (window as any).matchMedia) {
    return !!(window as any).matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return nativeReduceMotion
}

export const prefersReducedMotion = (): boolean => {
  if (reducedMotionPref === 'reduce') return true
  if (reducedMotionPref === 'full') return false
  return osReducedMotion()
}

/**
 * Motion duration honouring the reduced-motion preference (audit SA-013): returns
 * 0 when motion should be reduced, so a single call site can globally collapse an
 * animation to an instant state change. `reduced` optionally sets a shortened
 * (non-zero) duration instead of a hard cut.
 */
export function motionDuration(ms: number, reduced = 0): number {
  return prefersReducedMotion() ? reduced : ms
}

/**
 * Move screen-reader focus onto a ref (audit SA-012). Used when a sheet/modal
 * opens so VoiceOver/TalkBack lands on the new content instead of staying on the
 * now-hidden trigger. No-op on web / when the node can't be resolved.
 */
export function focusRef<T extends FocusTarget>(ref: RefObject<T | null>): void {
  try {
    const node = ref.current ? findNodeHandle(ref.current) : null
    if (node != null) AccessibilityInfo.setAccessibilityFocus(node)
  } catch {
    /* best-effort — focus assistance must never throw */
  }
}

/**
 * Move accessibility focus to `ref` whenever `active` becomes true (sheet/modal
 * open). Keeps focus management declarative at the call site.
 */
export function useFocusOnOpen<T extends FocusTarget>(ref: RefObject<T | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return
    // A tick after mount so the target is laid out and focusable.
    const t = setTimeout(() => focusRef(ref), 60)
    return () => clearTimeout(t)
  }, [active, ref])
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).matchMedia) {
    const mq = (window as any).matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => listener()
    mq.addEventListener?.('change', onChange)
    return () => {
      listeners.delete(listener)
      mq.removeEventListener?.('change', onChange)
    }
  }
  return () => {
    listeners.delete(listener)
  }
}

/** Reactive reduce-motion preference — re-renders when the OS setting changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}
