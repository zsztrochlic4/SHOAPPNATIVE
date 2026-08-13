/**
 * Hex → rgba so the theme's raw palette colours (from `useColors()`) can be
 * tinted at low opacity — React Native can't apply an alpha channel to a CSS
 * variable the way the web build does with `rgb(var(--fg) / 0.4)`.
 *
 * Single source for every surface that needs a translucent tint of a theme
 * colour, so the same helper (and its behaviour) is shared rather than copied.
 */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
