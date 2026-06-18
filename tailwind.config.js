/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
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
        // Brand palette derived from the StrengthHub Online mockups
        brand: {
          DEFAULT: '#7ED957',
          50: '#f1fbe9',
          100: '#dff6c8',
          200: '#c2ee98',
          300: '#9fe264',
          400: '#7ED957',
          500: '#5cba36',
          600: '#469628',
          700: '#377322',
          800: '#2e5b20',
          900: '#284d1f',
        },
        accent: {
          blue: '#3B82F6',
          purple: '#8B5CF6',
          orange: '#F5A524',
          yellow: '#F5C518',
        },
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
