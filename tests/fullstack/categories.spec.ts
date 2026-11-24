import { type APIRequestContext, type Page, expect, test } from '@playwright/test'
import { ready } from './helpers'

/**
 * Shop categories end to end against the real API: create "Miel" (fr/en/ar, cover with alt
 * texts) → nest it under "Épices et épicerie" by dragging → add products, reorder by dragging and
 * pin one → the public page (cover, breadcrumbs, JSON-LD, product order, CLS) in French and in
 * Arabic → change the slug: the old address answers 301 → delete with reassignment: the old
 * address answers 301 to the replacement. Needs the demo shop (`seed_dev`) and a staff account
 * with shop.catalog and content.write (cover alt texts).
 */
const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'
const ORIGIN = process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210'

async function staffApi(request: APIRequestContext, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, data?: unknown) {
  const res = await request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: ORIGIN } })
  expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.status() === 204 ? null : res.json()
}

/** Layout shift of the page so far (PerformanceObserver, buffered). */
async function cls(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((resolve) => {
    let total = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number, hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) total += e.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    setTimeout(() => resolve(total), 500)
  }))
}

test('a category from creation to deletion', async ({ page, request }) => {
  test.setTimeout(180_000)
  const stamp = Date.now().toString(36)
  const name = { fr: `Miel ${stamp}`, en: `Honey ${stamp}`, ar: `عسل ${stamp}` }
  const slug = { fr: `miel-${stamp}`, en: `honey-${stamp}`, ar: `عسل-${stamp}` }
  const list = await staffApi(request, 'GET', '/shop/categories')
  const pantry = list.data.find((c: { translations: { fr?: { slug: string } } }) => c.translations.fr?.slug === 'epices-epicerie')
  expect(pantry, 'seeded "Épices et épicerie"').toBeTruthy()

  // ---- Create ------------------------------------------------------------------------------
  await page.goto('/admin/shop/categories/new')
  await ready(page)
  await page.getByTestId('name-fr').locator('input').or(page.locator('input[data-testid="name-fr"]')).first().fill(name.fr)
  await expect(page.locator('input[data-testid="slug-fr"]').or(page.getByTestId('slug-fr').locator('input')).first()).toHaveValue(slug.fr)
  await page.getByRole('textbox', { name: 'Description' }).first().fill('Miel de jujubier récolté près de la ferme.')
  for (const l of ['en', 'ar'] as const) {
    await page.getByTestId(`locale-tab-${l}`).click()
    await page.locator(`input[data-testid="name-${l}"]`).or(page.getByTestId(`name-${l}`).locator('input')).first().fill(name[l])
  }
  // Cover from the media library, with its alt texts.
  await page.getByRole('button', { name: /Choisir/ }).first().click()
  await page.getByRole('button', { name: 'oasis.jpg' }).click()
  await page.keyboard.press('Escape')
  for (const [l, alt] of [['FR', 'Ruches dans l\'oasis'], ['EN', 'Beehives in the oasis'], ['AR', 'خلايا النحل في الواحة']]) {
    await page.getByLabel(`Texte alternatif (${l})`).fill(alt!)
  }
  await page.getByTestId('is-active').click()
  await page.getByTestId('save-category').click()
  await expect(page).toHaveURL(/\/admin\/shop\/categories\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop()!

  // ---- Nest under "Épices et épicerie" by dragging --------------------------------------
  await page.goto('/admin/shop/categories')
  await ready(page)
  const mine = page.getByTestId(`category-row-${id}`)
  const target = page.getByTestId(`category-row-${pantry.id}`)
  await mine.dragTo(target, { targetPosition: { x: 200, y: (await target.boundingBox())!.height / 2 } })
  await expect.poll(async () => (await staffApi(request, 'GET', `/shop/categories/${id}`)).parent_id).toBe(pantry.id)

  // ---- Products: add two, drag the second above the first, pin it -------------------------
  const products = await staffApi(request, 'GET', '/shop/products?status=published&per_page=5')
  const [first, second] = products.data as { id: string, name: string }[]
  await staffApi(request, 'POST', `/shop/categories/${id}/products`, { product_ids: [first!.id, second!.id] })
  await page.goto(`/admin/shop/categories/${id}`)
  await ready(page)
  const rows = page.getByTestId('category-products').locator('li')
  await expect(rows).toHaveCount(2)
  await rows.nth(1).dragTo(rows.nth(0), { targetPosition: { x: 40, y: 4 } })
  await expect.poll(async () => (await staffApi(request, 'GET', `/shop/categories/${id}/products`)).data[0].product_id).toBe(second!.id)
  await page.getByRole('button', { name: new RegExp(`Épingler ${second!.name}`) }).click()
  await expect.poll(async () => (await staffApi(request, 'GET', `/shop/categories/${id}/products`)).data[0].is_pinned).toBe(true)

  // ---- Public page ------------------------------------------------------------------------
  await page.goto(`/boutique/${slug.fr}`)
  await ready(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name.fr)
  await expect(page.getByTestId('category-cover').locator('img')).toHaveAttribute('alt', 'Ruches dans l\'oasis')
  await expect(page.getByTestId('category-cover').locator('img')).toHaveAttribute('loading', 'eager')
  const crumbs = page.getByTestId('shop-breadcrumbs')
  await expect(crumbs).toContainText('Épices et épicerie')
  await expect(crumbs).toContainText(name.fr)
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(ld.some(s => s.includes('"CollectionPage"'))).toBe(true)
  expect(ld.some(s => s.includes('"BreadcrumbList"') && s.includes(name.fr))).toBe(true)
  await expect(page.getByTestId('shop-card').first()).toContainText(second!.name)
  expect(await cls(page)).toBeLessThan(0.1)

  // Arabic, right to left.
  await page.goto(`/ar/boutique/${encodeURIComponent(slug.ar)}`)
  await ready(page)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name.ar)
  await expect(page.getByTestId('shop-breadcrumbs')).toContainText(name.ar)
  expect(await cls(page)).toBeLessThan(0.1)

  // ---- Slug change: the old address redirects -------------------------------------------
  await page.goto(`/admin/shop/categories/${id}`)
  await ready(page)
  await page.getByRole('button', { name: /Modifier l'adresse/ }).click()
  await page.locator('input[data-testid="slug-fr"]').or(page.getByTestId('slug-fr').locator('input')).first().fill(`miel-bio-${stamp}`)
  await expect(page.getByText('L\'ancienne adresse redirigera vers la nouvelle.')).toBeVisible()
  await page.getByTestId('save-category').click()
  await expect(page.getByTestId('save-bar')).toBeHidden()
  const moved = await page.request.get(`/boutique/${slug.fr}`, { maxRedirects: 0 })
  expect(moved.status()).toBe(301)
  expect(moved.headers().location).toContain(`/boutique/miel-bio-${stamp}`)

  // ---- Delete, products to "Épices et épicerie" -------------------------------------------
  await page.getByRole('button', { name: 'Supprimer' }).first().click()
  const dialog = page.getByTestId('category-delete-dialog')
  await expect(dialog.getByTestId('delete-impact')).toContainText('2')
  await dialog.getByTestId('category-picker').first().click()
  await page.getByRole('option', { name: /Épices et épicerie/ }).click()
  await page.getByTestId('delete-confirm-name').fill(name.fr)
  await page.getByTestId('delete-category').click()
  await expect(page).toHaveURL(/\/admin\/shop\/categories$/)
  for (const old of [`/boutique/${slug.fr}`, `/boutique/miel-bio-${stamp}`]) {
    const gone = await page.request.get(old, { maxRedirects: 0 })
    expect(gone.status(), old).toBe(301)
    expect(gone.headers().location).toContain('/boutique/epices-epicerie')
  }
})
