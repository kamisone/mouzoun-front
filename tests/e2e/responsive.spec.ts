import { tr } from '../i18n'
import { expect, test } from './fixtures'

// Runs in the "mobile" (360 px) and "tablet" (768 px) projects; desktop (1280 px) runs the smoke tests.
for (const path of ['/', '/ar', '/_styleguide']) {
  test(`no horizontal scrolling at 360 px: ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('the mobile menu is full screen, with large links, and closes with Escape back to its button', async ({ page }) => {
  await page.goto('/')
  const button = page.getByRole('button', { name: tr('fr', 'nav.menu') })
  await button.click()
  const dialog = page.getByRole('dialog', { name: tr('fr', 'nav.menu'), exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  const viewport = page.viewportSize()!
  await expect.poll(async () => Math.round((await dialog.boundingBox())!.width)).toBe(viewport.width)
  const link = dialog.getByRole('link', { name: 'Séjourner' })
  await expect(link).toBeVisible()
  expect(Number.parseFloat(await link.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(32)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(button).toBeFocused()
})

test('touch targets of the header are at least 44 px', async ({ page }) => {
  await page.goto('/')
  for (const button of await page.locator('header button, header a').all()) {
    if (!(await button.isVisible())) continue
    const box = await button.boundingBox()
    expect(Math.round(box!.height), await button.innerText()).toBeGreaterThanOrEqual(44)
  }
})
