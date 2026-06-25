import { vars } from 'nativewind'
import { useStore } from './store/store'

/**
 * Theme is driven by CSS variables applied via `vars()` on the root view —
 * the same `--fg` / `--ink-*` / `--brand-*` / `--accent-*` scale the web app
 * used, so every `bg-ink-800` / `text-white` / `bg-brand-400` /
 * `text-accent-purple` class flips between the dark and the cream/sage light
 * theme automatically. See tailwind.config.js for the colour mapping.
 */
export const themeVars = {
  dark: vars({
    '--fg': '255 255 255',
    '--ink-900': '10 10 11',
    '--ink-800': '18 18 20',
    '--ink-700': '26 27 30',
    '--ink-600': '34 35 38',
    '--ink-500': '43 45 49',
    '--needle': '255 255 255',
    '--brand-50': '241 251 233',
    '--brand-100': '223 246 200',
    '--brand-200': '194 238 152',
    '--brand-300': '159 226 100',
    '--brand-400': '126 217 87',
    '--brand-500': '92 186 54',
    '--brand-600': '70 150 40',
    '--brand-700': '55 115 34',
    '--brand-800': '46 91 32',
    '--brand-900': '40 77 31',
    '--accent-blue': '59 130 246',
    '--accent-purple': '139 92 246',
    '--accent-orange': '245 165 36',
    '--accent-yellow': '245 197 24',
    '--danger': '248 113 113',
  }),
  light: vars({
    '--fg': '31 38 28',
    '--ink-900': '244 240 229',
    '--ink-800': '252 250 242',
    '--ink-700': '235 230 215',
    '--ink-600': '224 217 198',
    '--ink-500': '211 203 181',
    '--needle': '42 51 38',
    // Softer, more natural greens so fills aren't neon on cream.
    '--brand-50': '239 245 231',
    '--brand-100': '224 237 207',
    '--brand-200': '196 223 167',
    '--brand-300': '124 186 92',
    '--brand-400': '99 165 71',
    '--brand-500': '82 146 56',
    '--brand-600': '67 124 44',
    '--brand-700': '55 102 36',
    '--brand-800': '45 84 32',
    '--brand-900': '38 70 28',
    '--accent-blue': '52 116 214',
    '--accent-purple': '116 102 196',
    '--accent-orange': '181 112 30',
    '--accent-yellow': '184 150 24',
    '--danger': '199 86 74',
  }),
}

/**
 * Raw colour strings for things that can't use Tailwind classes — SVG
 * strokes/fills (ProgressRing, charts, gauge), status-bar style, icon tints.
 */
export type ThemeName = 'light' | 'dark'

export const palette = {
  dark: {
    fg: '#ffffff',
    ink900: '#0a0a0b',
    ink800: '#121214',
    ink700: '#1a1b1e',
    ink600: '#222326',
    ink500: '#2b2d31',
    track: 'rgba(255,255,255,0.09)',
    grid: 'rgba(148,163,184,0.16)',
    tick: 'rgba(148,163,184,0.85)',
    frame: '#0a0a0b',
    ringTrack: 'rgba(255,255,255,0.12)',
    needle: '#ffffff',
    brand400: '#7ED957',
    brand300: '#9fe264',
    brand500: '#5cba36',
    accentBlue: '#3B82F6',
    accentPurple: '#8B5CF6',
    accentOrange: '#F5A524',
    accentYellow: '#F5C518',
    danger: '#f87171',
  },
  light: {
    fg: '#1f261c',
    ink900: '#f4f0e5',
    ink800: '#fcfaf2',
    ink700: '#ebe6d7',
    ink600: '#e0d9c6',
    ink500: '#d3cbb5',
    track: 'rgba(31,38,28,0.1)',
    grid: 'rgba(60,90,50,0.16)',
    tick: 'rgba(60,80,50,0.85)',
    frame: '#e4e8d8',
    ringTrack: 'rgba(31,38,28,0.12)',
    needle: '#2a3326',
    brand400: '#63a547',
    brand300: '#7cba5c',
    brand500: '#377322',
    accentBlue: '#3474d6',
    accentPurple: '#7466c4',
    accentOrange: '#b5701e',
    accentYellow: '#b89618',
    danger: '#c7564a',
  },
} as const

// Default (dark) brand/accent literals for places that don't read the theme.
// Prefer `useColors()` for theme-aware tints.
export const brand = {
  DEFAULT: '#7ED957',
  300: '#9fe264',
  400: '#7ED957',
  500: '#5cba36',
}

export const accent = {
  blue: '#3B82F6',
  purple: '#8B5CF6',
  orange: '#F5A524',
  yellow: '#F5C518',
}

/** Current theme name from the store. */
export function useThemeName(): ThemeName {
  const { state } = useStore()
  return state.settings.theme === 'light' ? 'light' : 'dark'
}

/** Raw colour palette for the current theme. */
export function useColors() {
  return palette[useThemeName()]
}
