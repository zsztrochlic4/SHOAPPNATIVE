import { test, expect, type Page } from '@playwright/test'

async function openCoach(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('tab', { name: 'Coach' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: 'Coach' }).click()
}

test('Coach welcome CTA clears the bottom nav and opens the conversation once', async ({ page }) => {
  await openCoach(page)
  const cta = page.getByRole('button', { name: 'Continue with coach' })
  await expect(cta).toBeVisible()

  const ctaBox = await cta.boundingBox()
  const navBox = await page.getByRole('tab', { name: 'Coach' }).boundingBox()
  expect(ctaBox).not.toBeNull()
  expect(navBox).not.toBeNull()
  expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(navBox!.y + 1)

  await cta.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByPlaceholder(/Message your coach/i)).toBeVisible()
  await expect(cta).toHaveCount(0)
})

test('Coach welcome is usable at a compact viewport without a hidden CTA', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await openCoach(page)
  const cta = page.getByRole('button', { name: 'Continue with coach' })
  await expect(cta).toBeVisible()
  await cta.click()
  await expect(page.getByPlaceholder(/Message your coach/i)).toBeVisible()
})
