import { test, expect, type Page } from '@playwright/test'

/**
 * Boot + navigation smoke. In demo mode the seeded user is onboarded and
 * auto-entitled, so the app lands on the dashboard tabs. Verifies the shell
 * renders, the bottom-nav tabs are real semantic tabs, tab switching works,
 * and no unexpected console errors surface (audit F-036 web console cleanliness).
 */

/** RN-Web/Expo web needs a beat to hydrate the bundle before assertions. */
async function waitForApp(page: Page) {
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible({ timeout: 30_000 })
}

// Framework-level noise we don't own (RN-Web deprecations, Expo web caveats).
const IGNORED_CONSOLE = [
  /shadow\*/i,
  /pointerEvents is deprecated/i,
  /expo-notifications/i,
  /Download the React DevTools/i,
  /Running application/i,
  /useNativeDriver/i,
  /findDOMNode/i,
]

test('app boots to the dashboard tabs in demo mode', async ({ page }) => {
  await page.goto('/')
  await waitForApp(page)
  for (const name of ['Dashboard', 'Workout', 'Nutrition', 'Progress', 'Community']) {
    await expect(page.getByRole('tab', { name })).toBeVisible()
  }
})

test('bottom-nav tabs switch the active screen', async ({ page }) => {
  await page.goto('/')
  await waitForApp(page)

  // The app keeps tabs mounted (React <Activity>), so hidden siblings' text is
  // still in the DOM. Assert a control UNIQUE to each tab is VISIBLE after the
  // switch (toBeVisible respects display:none on the hidden siblings).
  await page.getByRole('tab', { name: 'Nutrition' }).click()
  await expect(page.getByText('Snap your meal')).toBeVisible()

  await page.getByRole('tab', { name: 'Workout' }).click()
  await expect(page.getByRole('tab', { name: 'History' })).toBeVisible() // Workout's inner segmented tab

  await page.getByRole('tab', { name: 'Community' }).click()
  await expect(page.getByText(/social features aren.t live/i)).toBeVisible() // Preview banner

  await page.getByRole('tab', { name: 'Nutrition' }).click()
  await expect(page.getByText('Snap your meal')).toBeVisible()
})

test('no unexpected console errors on boot + navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return
    errors.push(text)
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await waitForApp(page)
  await page.getByRole('tab', { name: 'Nutrition' }).click()
  await page.getByRole('tab', { name: 'Progress' }).click()
  await page.waitForTimeout(500)

  expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([])
})
