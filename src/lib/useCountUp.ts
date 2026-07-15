import { useEffect, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && (window as any).matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Animate a number from 0 up to `target` on mount (and whenever `target`
 * changes), so gauges and stat tiles count up rather than snapping into place —
 * the small touch Whoop/Oura use to make a score feel earned.
 *
 * Returns the current value already rounded via `format` (default: nearest int
 * as a string), so callers can drop it straight into a <Text>. Honours reduced
 * motion by jumping to the final value.
 *
 * Driven by requestAnimationFrame (present on web and in React Native) rather
 * than an Animated.Value listener — on RN-Web a bare Animated.Value that isn't
 * bound to a rendered prop doesn't reliably tick its listeners.
 */
export function useCountUp(
  target: number,
  { duration = 900, format = (n: number) => String(Math.round(n)) }: { duration?: number; format?: (n: number) => string } = {},
): string {
  const [display, setDisplay] = useState(() => format(prefersReducedMotion() ? target : 0))

  useEffect(() => {
    if (prefersReducedMotion() || duration <= 0) {
      setDisplay(format(target))
      return
    }
    let raf = 0
    const start = Date.now()
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(format(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // Guarantee the final value even if rAF is paused (e.g. the tab is
    // backgrounded when the gauge mounts) — setTimeout still fires there.
    const settle = setTimeout(() => setDisplay(format(target)), duration + 60)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  return display
}
