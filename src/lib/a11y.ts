/**
 * Small accessibility helpers shared across screens.
 *
 * `prefersReducedMotion` reads the user's OS/browser "reduce motion" preference so
 * cosmetic, continuously-looping animations (a flickering streak flame, skeleton
 * shimmer, a count-up) can hold still for people who find motion distracting or
 * nauseating. On web it reads the media query; on native RN's AccessibilityInfo is
 * async, so this synchronous best-effort helper returns false there — the native
 * loops it guards are subtle and cheap, and haptics/vibration already check this.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).matchMedia?.('(prefers-reduced-motion: reduce)').matches
