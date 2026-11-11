import { expect, test } from '@playwright/test'
import { mockApi, seriousViolations } from './fixtures'

for (const [path, lang, dir] of [['/', 'fr-FR', 'ltr'], ['/en', 'en-GB', 'ltr'], ['/ar', 'ar-MA', 'rtl']] as const) {
  test(`home ${path} renders with lang=${lang} dir=${dir}`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    const html = page.locator('html')
    await expect(html).toHaveAttribute('lang', lang)
    await expect(html).toHaveAttribute('dir', dir)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    // hreflang alternates for every language
    for (const hreflang of ['fr-FR', 'en-GB', 'ar-MA']) {
      await expect(page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`)).toHaveCount(1)
    }
  })
}

test('the skip link is the first focusable element and targets main', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Aller au contenu' })
  await expect(skip).toBeFocused()
  await expect(skip).toHaveAttribute('href', '#main')
})

test('the theme choice persists across reloads, without flash', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.getByTestId('theme-toggle').click()
  await page.getByRole('menuitemcheckbox', { name: 'Sombre' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  // The class is on <html> in the first painted document (inline script), before hydration.
  await page.reload({ waitUntil: 'commit' })
  await page.waitForSelector('html.dark', { state: 'attached' })
  await page.waitForLoadState('networkidle')
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('the admin layout renders for a signed-in staff member', async ({ page }) => {
  await mockApi(page, true)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  await expect(page.getByText('Bienvenue, Hassan Ait Ouarab.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tableau de bord' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu utilisateur' })).toBeVisible()
})

test('the admin redirects to sign-in without a session', async ({ page }) => {
  await mockApi(page, false)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login\?redirect=/)
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible()
  await expect(page.getByLabel('E-mail')).toBeVisible()
})

test('sign-in validates fields with linked, translated errors', async ({ page }) => {
  await mockApi(page, false)
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  const email = page.getByLabel('E-mail')
  await expect(page.getByText('Ce champ est obligatoire.').first()).toBeVisible()
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  const describedBy = await email.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  await expect(page.locator(`[id="${describedBy!.split(' ').at(-1)}"]`)).toContainText('obligatoire')
})

for (const [path, name] of [['/_styleguide', 'style guide (fr, light)'], ['/ar/_styleguide', 'style guide (ar, rtl)'], ['/', 'home (fr)'], ['/ar', 'home (ar)']] as const) {
  test(`no serious accessibility violations: ${name}`, async ({ page }) => {
    await mockApi(page, true)
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(await seriousViolations(page)).toEqual([])
  })
}

test('no serious accessibility violations: style guide in dark mode', async ({ page }) => {
  await mockApi(page, true)
  await page.addInitScript(() => localStorage.setItem('mz-color-mode', 'dark'))
  await page.addInitScript(() => localStorage.setItem('mz-color-mode-explicit', '1'))
  await page.goto('/_styleguide')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.waitForLoadState('networkidle')
  expect(await seriousViolations(page)).toEqual([])
})
