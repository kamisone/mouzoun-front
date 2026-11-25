import { type APIRequestContext, expect, test } from '@playwright/test'
import { ready } from './helpers'

/**
 * "Produits de la boutique" end to end against the real API: added to the home page in the
 * builder with the "Dattes" category and published; in catalog-only mode the cards have no buying
 * button; once the shop is open, a card leads to its product page (registry address), the
 * single-variant product goes in the cart (the drawer opens with the line), the multi-variant one
 * offers "Choisir les options"; once in Arabic. Needs the demo data (`seed_dev`) and a staff
 * account with content.publish and shop.settings.
 */
const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'
const ORIGIN = process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210'

async function staff(request: APIRequestContext, method: 'GET' | 'PUT' | 'PATCH', path: string, data?: unknown) {
  const res = await request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: ORIGIN } })
  expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.status() === 204 ? null : res.json()
}

/** Fills the seeded placeholders the French compliance checklist needs, then opens the shop. */
async function openShop(request: APIRequestContext) {
  const entities = await staff(request, 'GET', '/shop/legal-entities')
  const fr = entities.data.find((e: { code: string }) => e.code === 'mouzoun_fr')
  await request.fetch(`${API}/v1/admin/shop/legal-entities/${fr.id}`, { method: 'PUT', headers: { Origin: ORIGIN }, data: {
    legal_name: 'MOUZOUN TEST SAS', legal_form: 'SAS', share_capital_minor: 100000,
    address: { line1: '1 rue de Test', postal_code: '75001', city: 'Paris', country_code: 'FR' },
    registration: { siren: '123456789', siret: '12345678900011', rcs_city: 'Paris', vat_number: 'FR12123456789' },
    email: 'boutique@example.com', host: { name: 'Google Cloud France SARL' },
  } })
  const tax = await staff(request, 'GET', '/shop/tax-rates')
  for (const r of tax.rates.filter((x: { country_code: string, is_active: boolean, is_confirmed: boolean }) => x.country_code === 'FR' && x.is_active && !x.is_confirmed)) {
    await request.fetch(`${API}/v1/admin/shop/tax-rates/${r.id}`, { method: 'PUT', headers: { Origin: ORIGIN }, data: { ...r, is_confirmed: true } })
  }
  await staff(request, 'PATCH', '/shop/settings', { 'payments.stripe.enabled': true, 'shop.consumer_mediator': { name: 'Médiateur test', url: 'https://mediateur.example' } })
  await staff(request, 'PATCH', '/shop/settings', { 'shop.status': 'open' })
}

test('a shop section added in the builder sells from the home page', async ({ page, request }) => {
  test.setTimeout(180_000)
  const title = `Nos dattes ${Date.now().toString(36)}`

  // ---- Builder: add the section, pick "Dattes", publish ------------------------------------
  await page.goto('/admin/pages')
  await ready(page)
  await page.getByTestId('open-builder-home').click()
  await expect(page.getByTestId('section-list')).toBeVisible()
  await page.getByTestId('add-section').click()
  await expect(page.getByTestId('add-type-shop_products')).toContainText('Produits de la boutique')
  await expect(page.getByTestId('add-type-product_carousel')).toContainText('Hébergements et activités')
  await page.getByTestId('add-type-shop_products').click()
  const form = page.getByTestId('section-form-shop_products')
  await expect(form).toBeVisible()
  await form.locator('[data-field="title"] input').fill(title)
  await form.getByRole('tab', { name: 'Source' }).click()
  await form.getByTestId('picker-category').click()
  await page.getByRole('option', { name: 'Dattes shop', exact: true }).click()
  await page.keyboard.press('Escape')
  // The preset shows featured products only: show the whole category.
  await form.locator('[data-field="featured_only"]').getByRole('switch').click()
  await expect(page.getByTestId('save-status')).toHaveText(/Brouillon enregistré/, { timeout: 15_000 })
  await page.getByTestId('publish-open').click()
  await page.getByTestId('publish-confirm').click()
  await expect(page.getByText(/Révision \d+ publiée/).first()).toBeVisible()

  // ---- Catalog only: prices, no buying ----------------------------------------------------
  const section = page.locator('section[data-section-type="shop_products"]').filter({ has: page.getByRole('heading', { name: title }) })
  await page.goto('/')
  await ready(page)
  await expect(section.getByTestId('shop-card')).toHaveCount(2)
  await expect(section.getByTestId('shop-card-add')).toHaveCount(0)
  await expect(section.getByTestId('shop-card-soon').first()).toBeVisible()
  await expect(section.getByTestId('shop-card-price').first()).toBeVisible()

  // ---- Open shop: link, add to cart, options -------------------------------------------------
  await openShop(request)
  await expect.poll(async () => {
    await page.goto('/')
    return section.getByTestId('shop-card-add').count()
  }, { timeout: 30_000 }).toBe(1)
  const single = section.getByTestId('shop-card').filter({ has: page.getByTestId('shop-card-add') })
  const multi = section.getByTestId('shop-card').filter({ has: page.getByTestId('shop-card-options') })
  const href = await single.getByTestId('shop-card-link').getAttribute('href')
  expect(href).toMatch(/^\/boutique\/p\//)
  await single.getByTestId('shop-card-link').click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goBack()
  await ready(page)
  const name = (await single.locator('h3').textContent())!.trim()
  await single.getByTestId('shop-card-add').click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText(name)
  await page.keyboard.press('Escape')
  const optionsHref = await multi.getByTestId('shop-card-options').getAttribute('href')
  await multi.getByTestId('shop-card-options').click()
  await expect(page).toHaveURL(new RegExp(`${optionsHref}$`))

  // ---- Arabic ----------------------------------------------------------------------------------
  await page.goto('/ar')
  await ready(page)
  const arCards = page.locator('section[data-section-type="shop_products"]').getByTestId('shop-card-link')
  await expect(arCards.first()).toBeVisible()
  for (const a of await arCards.all()) expect(await a.getAttribute('href')).toMatch(/^\/ar\/boutique\/p\//)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})
