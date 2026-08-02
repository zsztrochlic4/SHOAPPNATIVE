import { test, expect, type Page } from '@playwright/test'

/**
 * Settings surfaces the audit required post-onboarding (F-033 version/legal/
 * support, F-039 sync status, F-030 partial-translation honesty). Opens the
 * menu (which renders the settings inline) and asserts the rows exist.
 */

async function openMenu(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Open menu' }).click()
}

test('the menu exposes legal, support and a real version/build row', async ({ page }) => {
  await openMenu(page)
  await expect(page.getByText('Legal & support')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Open Terms of Service' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Privacy Policy' })).toBeVisible()
  // Runtime version, not the hardcoded "v1.0" the audit flagged (F-033).
  await expect(page.getByText(/StrengthHub Online · v\d+\.\d+/)).toBeVisible()
})

test('the training profile editor is reachable from settings', async ({ page }) => {
  await openMenu(page)
  await expect(page.getByRole('button', { name: /Edit training profile/ })).toBeVisible({ timeout: 15_000 })
})
