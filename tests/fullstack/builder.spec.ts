import { expect, test } from './fixtures'
import { noSeriousA11yIssues, ready } from './helpers'

/**
 * Page builder, end to end against the real API: add a section to the home page, write its
 * title in two languages, move it up, see it in the live preview, publish, then find it on the
 * public home page in French and in English. The section is removed (and republished) at the end.
 */
test('add, translate, reorder, preview and publish a section of the home page', async ({ page }) => {
  const tag = Date.now().toString(36)
  const fr = `Notre engagement ${tag}`
  const en = `Our commitment ${tag}`

  await page.goto('/admin/pages')
  await ready(page)
  await page.getByTestId('open-builder-home').click()
  await expect(page.getByTestId('section-list')).toBeVisible()
  const rows = page.getByTestId('section-list').locator('> li')
  const before = await rows.count()

  // Add a rich text section at the end.
  await page.getByTestId('add-section').click()
  await page.getByTestId('add-type-rich_text').click()
  await expect(rows).toHaveCount(before + 1)
  const form = page.getByTestId('section-form-rich_text')
  await expect(form).toBeVisible()

  // Title in French (default tab), then English.
  await form.locator('[data-field="title"] input').fill(fr)
  await form.getByTestId('locale-tab-title-en').click()
  await form.locator('[data-field="title"] input').fill(en)
  await form.getByTestId('locale-tab-title-fr').click()
  await expect(form.locator('[data-field="title"] input')).toHaveValue(fr)

  // Move it up one place with the keyboard.
  const last = rows.nth(before)
  await last.focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(rows.nth(before - 1)).toContainText(fr)

  // Autosave, then the preview (the draft) shows it.
  await expect(page.getByTestId('save-status')).toHaveText(/Brouillon enregistré/, { timeout: 15_000 })
  const preview = page.frameLocator('[data-testid="preview-frame"]')
  await expect(preview.getByRole('heading', { name: fr })).toBeVisible({ timeout: 15_000 })

  // Not on the public site before publishing.
  const publicPage = await page.context().newPage()
  await publicPage.goto('/')
  await expect(publicPage.getByRole('heading', { name: fr })).toHaveCount(0)

  // Publish now: the diff lists the new section.
  await page.getByTestId('publish-open').click()
  await expect(page.getByTestId('publish-diff')).toContainText(fr)
  await page.getByTestId('publish-confirm').click()
  const published = page.getByText(/Révision \d+ publiée/).first()
  await expect(published).toBeVisible()
  const revision = Number((await published.textContent())!.match(/\d+/)![0])

  // Public home, French and English.
  await publicPage.goto('/')
  await expect(publicPage.getByRole('heading', { name: fr })).toBeVisible()
  await publicPage.goto('/en')
  await expect(publicPage.getByRole('heading', { name: en })).toBeVisible()
  await publicPage.close()

  // Clean up: delete the section and publish again.
  await rows.nth(before - 1).getByRole('button', { name: 'Actions de la section' }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(rows).toHaveCount(before)
  await expect(page.getByTestId('save-status')).toHaveText(/Brouillon enregistré/, { timeout: 15_000 })
  await page.getByTestId('publish-open').click()
  await page.getByTestId('publish-confirm').click()
  await expect(page.getByText(`Révision ${revision + 1} publiée`).first()).toBeVisible()
})

test('the home page built from sections is accessible, in French and in Arabic (RTL)', async ({ page }) => {
  for (const path of ['/', '/ar']) {
    await page.goto(path)
    await ready(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    if (path === '/ar') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    // Scroll through so lazy sections and images are in place, then audit.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y)
        await new Promise(r => setTimeout(r, 30))
      }
    })
    await noSeriousA11yIssues(page)
  }
})
