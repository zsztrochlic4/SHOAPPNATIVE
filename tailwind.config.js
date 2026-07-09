/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  // The app drives light/dark entirely through CSS variables applied with
  // `vars()` (see src/theme.tsx) and never uses Tailwind `dark:` variants.
  // Force NativeWind's darkMode flag to `class` so react-native-css-interop's
  // color-scheme sync (a MutationObserver that calls `colorScheme.set()`)
  // doesn't throw "Cannot manually set color scheme … type 'media'" on web /
  // during prerender. `class` mode is inert here but keeps the flag valid.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // `white` and the `ink` surface scale are CSS-variable driven so the
        // light/dark theme toggle (set via `vars()` on the root view) flips
        // every screen automatically — mirrors the original web app.
        white: 'rgb(var(--fg) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink-900) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
        },
        // Brand + accent are CSS-variable driven so they flip with the
        // dark / cream-sage light themes (values set in src/theme.tsx).
        brand: {
          DEFAULT: 'rgb(var(--brand-400) / <alpha-value>)',
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        accent: {
          blue: 'rgb(var(--accent-blue) / <alpha-value>)',
          purple: 'rgb(var(--accent-purple) / <alpha-value>)',
          orange: 'rgb(var(--accent-orange) / <alpha-value>)',
          yellow: 'rgb(var(--accent-yellow) / <alpha-value>)',
        },
        danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      borderRadius: {
        xl: 16,
        '2xl': 20,
        '3xl': 24,
      },
    },
  },
  plugins: [],
}
