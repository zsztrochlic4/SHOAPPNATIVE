import { test, expect, type Page } from '@playwright/test'

/**
 * Accessibility smoke (audit F-016). The audit's runtime check found ZERO
 * semantic buttons on the first screen and unlabeled controls throughout.
 * These assert the baseline is really there in the rendered DOM: each tab
 * exposes semantic buttons AND accessible names, and the tabs themselves are
 * proper tab roles.
 */

async function waitForApp(page: Page) {
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible({ timeout: 30_000 })
}

const counts = (page: Page) =>
  page.evaluate(() => ({
    buttons: document.querySelectorAll('[role="button"]').length,
    labelled: document.querySelectorAll('[aria-label]').length,
    tabs: document.querySelectorAll('[role="tab"]').length,
  }))

test('the shell exposes semantic tabs and labelled buttons', async ({ page }) => {
  await page.goto('/')
  await waitForApp(page)
  const c = await counts(page)
  expect(c.tabs).toBeGreaterThanOrEqual(5) // the five bottom-nav tabs
  expect(c.buttons).toBeGreaterThan(0)
  expect(c.labelled).toBeGreaterThan(0)
})

for (const tab of ['Workout', 'Nutrition', 'Progress', 'Community'] as const) {
  test(`the ${tab} tab exposes semantic buttons with names`, async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await page.getByRole('tab', { name: tab }).click()
    await page.waitForTimeout(400)
    const c = await counts(page)
    expect(c.buttons, `${tab} should render semantic buttons`).toBeGreaterThan(0)
    expect(c.labelled, `${tab} should render accessible names`).toBeGreaterThan(0)
  })
}
