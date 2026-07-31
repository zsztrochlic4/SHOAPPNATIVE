import { useEffect, useState } from 'react'
import { AccessibilityInfo, Easing } from 'react-native'
import { prefersReducedMotion } from './a11y'

/**
 * Canonical motion constants for the app's surfaces, so every sheet, panel and
 * transition of the same KIND animates with the same duration + easing. Import
 * these instead of re-deriving `Easing.bezier(...)` / magic millisecond values
 * per component (that drift is what made sheets feel subtly different).
 */

/** Bottom sheets (the shared `Sheet`, Customize, Progress sheets, dashboard
 *  loggers): rise on the way in, leave a touch faster. Out-cubic both ways. */
export const SHEET = {
  inMs: 300,
  outMs: 240,
  ease: Easing.out(Easing.cubic),
  /** How far below its resting place the panel starts / ends (px). Actual panel
   *  height is used when known; this is the fallback before onLayout measures. */
  fallbackTravel: 560,
}

/** Full-screen right-sliding panels (coach chat, menu detail). */
export const PANEL = {
  inMs: 300,
  outMs: 240,
  ease: Easing.out(Easing.cubic),
  /** Fraction of the width the panel slides in from. */
  slideRatio: 0.22,
}

/** Screen/tab cross-fade + small rise. */
export const SCREEN = {
  ms: 450,
  ease: Easing.bezier(0.22, 1, 0.36, 1),
}

/** Small in-place toggles (segmented pills, switches). */
export const TOGGLE = {
  ms: 200,
  ease: Easing.out(Easing.cubic),
}

/**
 * Live "reduce motion" preference, reactive on native AND web. On native it
 * reads AccessibilityInfo (async) and subscribes to changes; on web it seeds
 * from the media query. Cosmetic slides should collapse to an instant/opacity
 * change when this is true (see `BottomSheet`), so the UI never moves for people
 * who asked it not to.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => prefersReducedMotion())
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (active && v) setReduced(true) })
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
      if (active) setReduced(!!v)
    })
    return () => {
      active = false
      sub?.remove?.()
    }
  }, [])
  return reduced
}
