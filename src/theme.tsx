import { vars } from 'nativewind'
import { useStore } from './store/store'

/**
 * Theme is driven by CSS variables applied via `vars()` on the root view —
 * the exact same `--fg` / `--ink-*` surface scale the original web app used,
 * so every `bg-ink-800` / `text-white` / `border-white/5` class flips between
 * light and dark automatically. See tailwind.config.js for the colour mapping.
 */
export const themeVars = {
  dark: vars({
    '--fg': '255 255 255',
    '--ink-900': '10 10 11',
    '--ink-800': '18 18 20',
    '--ink-700': '26 27 30',
    '--ink-600': '34 35 38',
    '--ink-500': '43 45 49',
  }),
  light: vars({
    '--fg': '17 18 22',
    '--ink-900': '244 245 248',
    '--ink-800': '255 255 255',
    '--ink-700': '238 240 244',
    '--ink-600': '226 229 234',
    '--ink-500': '214 218 224',
  }),
}

/**
 * Raw colour strings for things that can't use Tailwind classes — SVG
 * strokes/fills (ProgressRing, charts), status-bar style, etc.
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
  },
  light: {
    fg: '#111216',
    ink900: '#f4f5f8',
    ink800: '#ffffff',
    ink700: '#eef0f4',
    ink600: '#e2e5ea',
    ink500: '#d6dae0',
    track: 'rgba(15,23,42,0.08)',
    grid: 'rgba(100,116,139,0.18)',
    tick: 'rgba(71,85,105,0.9)',
    frame: '#e9ebef',
    ringTrack: 'rgba(15,23,42,0.12)',
  },
} as const

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
