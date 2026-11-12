import { expect, test } from '@playwright/test'

// Runs in the "mobile" (360 px) and "tablet" (768 px) projects; desktop (1280 px) runs the smoke tests.
for (const path of ['/', '/ar', '/_styleguide']) {
  test(`no horizontal scrolling at 360 px: ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('the mobile menu is full screen, with large links, and closes with Escape', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const viewport = page.viewportSize()!
  await expect.poll(async () => Math.round((await dialog.boundingBox())!.width)).toBe(viewport.width)
  const link = dialog.getByRole('link', { name: 'Séjourner' })
  await expect(link).toBeVisible()
  expect(Number.parseFloat(await link.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(32)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('touch targets of the header are at least 44 px', async ({ page }) => {
  await page.goto('/')
  for (const button of await page.locator('header button, header a').all()) {
    if (!(await button.isVisible())) continue
    const box = await button.boundingBox()
    expect(Math.round(box!.height), await button.innerText()).toBeGreaterThanOrEqual(44)
  }
})
