import { useSyncExternalStore } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

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

export const prefersReducedMotion = (): boolean => {
  if (typeof window !== 'undefined' && (window as any).matchMedia) {
    return !!(window as any).matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return nativeReduceMotion
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
