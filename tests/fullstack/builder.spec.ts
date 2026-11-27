import { tr } from '../i18n'
import { API, ORIGIN, expect, test } from './fixtures'
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

test('text typed just before switching to the layout tab is kept and saved', async ({ page, request }) => {
  const tag = Date.now().toString(36)
  const body = `Délai de rétractation ${tag}`
  await page.goto('/admin/pages')
  await ready(page)
  await page.getByTestId('open-builder-home').click()
  await expect(page.getByTestId('section-list')).toBeVisible()
  const rows = page.getByTestId('section-list').locator('> li')
  const before = await rows.count()
  await page.getByTestId('add-section').click()
  await page.getByTestId('add-type-rich_text').click()
  await expect(rows).toHaveCount(before + 1)
  const form = page.getByTestId('section-form-rich_text')
  const editor = form.locator('[data-field="body"] [contenteditable="true"]')
  await editor.click()
  await page.keyboard.type(body)
  // Straight to "Mise en page" while the editor still has the focus: it is removed, then blurred.
  await form.getByRole('tab', { name: tr('fr', 'admin.builder.groups.layout') }).click()
  await expect(page.getByTestId('save-status')).toHaveText(/Brouillon enregistré/, { timeout: 15_000 })
  // The saved draft has the text.
  const pages = await (await request.fetch(`${API}/v1/admin/pages`, { headers: { Origin: ORIGIN } })).json()
  const home = pages.pages.find((p: { page_type: string }) => p.page_type === 'home')
  const draft = await (await request.fetch(`${API}/v1/admin/pages/${home.id}/builder`, { headers: { Origin: ORIGIN } })).json()
  const saved = draft.blocks.find((b: { content: Record<string, { body?: string }> }) => b.content.fr?.body?.includes(tag))
  expect(saved, 'the section saved with its text').toBeTruthy()
  // Back on "Contenu", the editor shows it.
  await form.getByRole('tab', { name: tr('fr', 'admin.builder.groups.content') }).click()
  await expect(editor).toContainText(body)

  // Leave the home draft as it was.
  await rows.nth(before).getByRole('button', { name: tr('fr', 'admin.builder.actions') }).click()
  await page.getByRole('menuitem', { name: tr('fr', 'common.delete') }).click()
  await expect(rows).toHaveCount(before)
  await expect(page.getByTestId('save-status')).toHaveText(/Brouillon enregistré/, { timeout: 15_000 })
})

/**
 * A page created with the wrong type is fixed from Admin › Pages: "Change type" in the row menu.
 * Becoming legal runs the publishing checks (here an unknown company field first), then the row
 * shows the new type. The live page keeps the old one until the next publication, whose dialog
 * lists the change.
 */
test('a page created with the wrong type becomes a legal page from the pages list', async ({ page, request }) => {
  const tag = Date.now().toString(36)
  const title = `Mentions ${tag}`
  const h = { Origin: ORIGIN }
  const created = await request.post(`${API}/v1/admin/pages`, { headers: h, data: { page_type: 'page', translations: { fr: { title, slug: `mentions-${tag}` } } } })
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  const draft = async (body: string) => {
    const tree = await (await request.get(`${API}/v1/admin/pages/${id}/builder`, { headers: h })).json()
    const saved = await request.put(`${API}/v1/admin/pages/${id}/builder`, {
      headers: { ...h, 'If-Match': `"${tree.draft_version}"` },
      data: { blocks: [{ id: crypto.randomUUID(), type: 'rich_text', settings: { max_width: 'normal' }, content: { fr: { title, body } } }] },
    })
    expect(saved.status()).toBe(200)
  }
  await draft('<p>Éditeur : {{seller.nope}}</p>')
  // Published as a plain page (unknown tokens only matter on legal pages).
  expect((await request.post(`${API}/v1/admin/pages/${id}/publish`, { headers: h, data: {} })).status()).toBe(201)

  await page.goto('/admin/pages')
  await ready(page)
  const row = page.locator('li', { hasText: title })
  await expect(row).toContainText(tr('fr', 'admin.builder.pageTypes.page'))
  await page.getByTestId(`page-actions-${id}`).click()
  await page.getByRole('menuitem', { name: tr('fr', 'admin.builder.changeType.action') }).click()
  const dialog = page.getByRole('dialog', { name: tr('fr', 'admin.builder.changeType.title', { title }) })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('radio', { name: tr('fr', 'admin.builder.pageTypes.legal') }).check()
  await expect(dialog).toContainText(tr('fr', 'admin.builder.changeType.legalChecks'))
  await expect(dialog).toContainText(tr('fr', 'admin.builder.changeType.live'))
  await dialog.getByTestId('change-type-save').click()
  await expect(dialog.getByTestId('change-type-error')).toContainText('{{seller.nope}}')

  // Fixed in the draft: the change goes through and the row shows it.
  await draft('<p>Éditeur : {{seller.legal_name}}</p>')
  await dialog.getByTestId('change-type-save').click()
  await expect(dialog).toBeHidden()
  await expect(row).toContainText(tr('fr', 'admin.builder.pageTypes.legal'))
  const tree = await (await request.get(`${API}/v1/admin/pages/${id}/builder`, { headers: h })).json()
  expect(tree.page.page_type).toBe('legal')

  // Not live yet: the publish dialog lists the change.
  await page.goto(`/admin/pages/${id}/builder`)
  await ready(page)
  await page.getByTestId('publish-open').click()
  await expect(page.getByTestId('publish-type-change')).toContainText(`${tr('fr', 'admin.builder.pageTypes.page')} → ${tr('fr', 'admin.builder.pageTypes.legal')}`)
  await page.keyboard.press('Escape')
  await page.goto('/admin/pages')
  await ready(page)

  // The home page has no such menu.
  const home = (await (await request.get(`${API}/v1/admin/pages`, { headers: h })).json()).pages.find((p: { page_type: string }) => p.page_type === 'home')
  await expect(page.getByTestId(`page-actions-${home.id}`)).toHaveCount(0)
})
