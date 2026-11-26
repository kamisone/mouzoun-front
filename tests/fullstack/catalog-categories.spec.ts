import type { APIRequestContext } from '@playwright/test'
import { expect, test } from './fixtures'
import { ready } from './helpers'

/**
 * Stay and activity categories end to end against the real API: the four seeded ones (Aventure
 * désert, Vie à la ferme, Culture & village, Hébergements) in Admin › Catalogue › Catégories →
 * create one (fr/en/ar), add an activity from the form, reorder by dragging → the catalog
 * editor's Categories field and the builder's "Hébergements et activités" rule only offer stay
 * and activity categories → a carousel filtered by "Vie à la ferme" shows only its activity on
 * the home page. Needs the demo data (`seed_dev`) and a staff account with products.write and
 * content.publish (manager or super_admin).
 */
const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'
const ORIGIN = process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210'
const SEEDED = ['Aventure désert', 'Vie à la ferme', 'Culture & village', 'Hébergements']

interface Row { id: string, translations: { fr?: { name: string, slug: string } }, product_count: number }

async function staffApi(request: APIRequestContext, method: 'GET' | 'POST', path: string, data?: unknown) {
  const res = await request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: ORIGIN } })
  expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.status() === 204 ? null : res.json()
}
const categories = async (request: APIRequestContext) => (await staffApi(request, 'GET', '/catalog/categories')).data as Row[]
const named = (rows: Row[], fr: string) => rows.find(r => r.translations.fr?.name === fr)

test('stay and activity categories from the catalog to a page', async ({ page, request }) => {
  test.setTimeout(180_000)
  const stamp = Date.now().toString(36)
  const name = { fr: `Bien-être ${stamp}`, en: `Wellness ${stamp}`, ar: `راحة ${stamp}` }

  // ---- Seeded categories, with their products ---------------------------------------------
  const seeded = await categories(request)
  for (const fr of SEEDED) expect(named(seeded, fr), `seeded "${fr}"`).toBeTruthy()
  expect(named(seeded, 'Hébergements')!.product_count).toBe(3)
  expect(named(seeded, 'Vie à la ferme')!.product_count).toBe(1)

  // ---- The list, from the Catalogue menu ----------------------------------------------------
  await page.goto('/admin/catalog/stays')
  await ready(page)
  await page.locator('a[href="/admin/catalog/categories"]').first().click()
  await expect(page).toHaveURL(/\/admin\/catalog\/categories$/)
  await ready(page)
  for (const r of seeded) await expect(page.getByTestId(`category-row-${r.id}`)).toBeVisible()
  await expect(page.getByTestId('category-tree')).not.toContainText('Masquée du menu')

  // ---- Create one: three languages, active ------------------------------------------------
  await page.getByTestId('new-category').click()
  await expect(page).toHaveURL(/\/admin\/catalog\/categories\/new$/)
  await ready(page)
  await page.locator('input[data-testid="name-fr"]').or(page.getByTestId('name-fr').locator('input')).first().fill(name.fr)
  await expect(page.locator('input[data-testid="slug-fr"]').or(page.getByTestId('slug-fr').locator('input')).first()).toHaveValue(`bien-etre-${stamp}`)
  for (const l of ['en', 'ar'] as const) {
    await page.getByTestId(`locale-tab-${l}`).click()
    await page.locator(`input[data-testid="name-${l}"]`).or(page.getByTestId(`name-${l}`).locator('input')).first().fill(name[l])
  }
  // Shop-only fields are not offered.
  await expect(page.getByText('Tri des produits par défaut')).toHaveCount(0)
  await expect(page.getByText('Afficher dans le menu')).toHaveCount(0)
  await page.getByTestId('is-active').click()
  await page.getByTestId('save-category').click()
  await expect(page).toHaveURL(/\/admin\/catalog\/categories\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop()!
  const saved = await staffApi(request, 'GET', `/catalog/categories/${id}`)
  expect(saved.translations.ar.name).toBe(name.ar)
  expect(saved.is_active).toBe(true)

  // ---- Add an activity from the form: it links to the catalog editor ----------------------
  await ready(page)
  const products = page.getByTestId('category-products')
  await products.getByRole('button', { name: 'Ajouter des produits…' }).click()
  // The menu opens with its search box focused.
  await page.keyboard.type('Quad 2')
  await page.getByRole('option', { name: /Quad 2 h/ }).first().click()
  await page.keyboard.press('Escape')
  await products.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(products.locator('li')).toHaveCount(1)
  await expect(products.locator('li a')).toHaveAttribute('href', /\/admin\/catalog\/activities\/[0-9a-f-]{36}$/)
  await expect(products).toContainText('Activité')

  // ---- Reorder: drag the new one to the top -------------------------------------------------
  await page.goto('/admin/catalog/categories')
  await ready(page)
  const first = (await categories(request))[0]!
  await page.getByTestId(`category-row-${id}`).dragTo(page.getByTestId(`category-row-${first.id}`), { targetPosition: { x: 200, y: 2 } })
  await expect.poll(async () => (await categories(request))[0]!.id).toBe(id)
  expect((await staffApi(request, 'GET', `/catalog/categories/${id}`)).parent_id).toBeNull()

  // ---- The catalog editor only offers stay and activity categories -----------------------
  const activities = await staffApi(request, 'GET', '/catalog/activities')
  await page.goto(`/admin/catalog/activities/${activities.data[0].id}`)
  await ready(page)
  await page.getByTestId('picker-category').first().click()
  await expect(page.getByRole('option', { name: /Aventure désert/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Dattes/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // ---- Builder: "Hébergements et activités" by rule, activities of "Vie à la ferme" -------
  const title = `À la ferme ${stamp}`
  await page.goto('/admin/pages')
  await ready(page)
  await page.getByTestId('open-builder-home').click()
  await expect(page.getByTestId('section-list')).toBeVisible()
  await page.getByTestId('add-section').click()
  await page.getByTestId('add-type-product_carousel').click()
  const form = page.getByTestId('section-form-product_carousel')
  await expect(form).toBeVisible()
  await form.locator('[data-field="title"] input').fill(title)
  await form.getByRole('tab', { name: 'Source' }).click()
  await form.locator('[data-field="kind"]').getByRole('combobox').click()
  await page.getByRole('option', { name: 'Activité', exact: true }).click()
  await form.locator('[data-field="category_id"]').getByTestId('picker-category').click()
  await expect(page.getByRole('option', { name: /Vie à la ferme/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Dattes|Huile|Artisanat|Coffrets/ })).toHaveCount(0)
  await page.getByRole('option', { name: /Vie à la ferme/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('save-status')).toHaveText(/Brouillon enregistré/, { timeout: 15_000 })
  await page.getByTestId('publish-open').click()
  await page.getByTestId('publish-confirm').click()
  await expect(page.getByText(/Révision \d+ publiée/).first()).toBeVisible()

  const section = page.locator('section[data-section-type="product_carousel"]').filter({ has: page.getByRole('heading', { name: title }) })
  await page.goto('/')
  await ready(page)
  await expect(section).toContainText('Visite de la ferme et des troupeaux')
  await expect(section).not.toContainText('Quad 2 h')
  await expect(section).not.toContainText('Khaïma nomade')
})
