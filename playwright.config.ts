import { defineConfig, devices } from '@playwright/test'

/**
 * E2E smoke harness (audit "next 30 days": web smoke for the critical journeys).
 *
 * Runs the real Expo web build in DEMO mode — no Firebase, auto-entitled, the
 * seeded user is already onboarded — so the specs land straight on the app and
 * exercise the journeys the audit reproduced (auth/onboarding semantics via a
 * separate reset, nutrition logging, settings surfaces, accessibility roles).
 *
 * `PAYWALL_PREVIEW=0` (Playwright's env wins over the gitignored .env.local
 * because dotenv never overrides an already-set process var), so demo users
 * flow past the paywall to the tabs. The server boot is slow on first run, so
 * the timeouts are generous and CI is single-worker.
 */
const PORT = 8099
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // RN-Web needs a real viewport; the app frames itself to a phone on web.
    viewport: { width: 420, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx expo start --web --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: {
      EXPO_PUBLIC_DEMO_MODE: '1',
      EXPO_PUBLIC_PAYWALL_PREVIEW: '0',
      EXPO_PUBLIC_COACH_PREVIEW: '0',
    },
  },
})
