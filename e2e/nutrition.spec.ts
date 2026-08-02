import { test, expect, type Page } from '@playwright/test'

/**
 * Nutrition daily-log journey (audit F-008 / F-009 / J-06). The regression the
 * audit found: "Add to today's log" wrote to the meal PLAN, so daily totals
 * never moved and manual logging was unreachable. This proves the fix end to
 * end — manual "Add food" creates a real LoggedMeal and the Today's-log surface
 * updates immediately.
 */

async function gotoNutrition(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('tab', { name: 'Nutrition' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: 'Nutrition' }).click()
  await expect(page.getByText('Snap your meal')).toBeVisible()
}

test('the Today’s food log surface exists on the nutrition overview', async ({ page }) => {
  await gotoNutrition(page)
  await expect(page.getByText(/Today.s food log/i)).toBeVisible()
  // Manual logging is reachable (F-009) — the audit's copy promised a control
  // that did not render.
  await expect(page.getByRole('button', { name: /Add food to today.s log/i })).toBeVisible()
})

test('logging a food manually updates the daily log', async ({ page }) => {
  await gotoNutrition(page)

  // Open the Add-food sheet from the Today's-log card.
  await page.getByRole('button', { name: /Add food to today.s log/i }).click()
  await expect(page.getByPlaceholder('Search foods…')).toBeVisible()

  // Add the first food row (labelled "Add <name>"); tapping logs it + closes.
  // force: the RN-Web Pressable's own child View sits at the hit point but the
  // click still bubbles to the button's handler.
  await page.getByRole('button', { name: /^Add / }).first().click({ force: true })

  // Back on the overview, the log is no longer empty — a remove control appears
  // for the logged entry (proves a real LoggedMeal was created, not a plan row).
  await expect(page.getByRole('button', { name: /Remove .* from today.s log/i }).first()).toBeVisible({ timeout: 15_000 })
})
