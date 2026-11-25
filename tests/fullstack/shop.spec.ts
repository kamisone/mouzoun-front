import { type APIRequestContext, expect, test } from '@playwright/test'
import { completeFoodInformation, ready } from './helpers'

/**
 * Farm shop end to end against the real API (simulated card provider, PAYMENTS_FAKE=true):
 * catalog-only mode hides buying; the cookie banner offers "refuse" as plainly as "accept";
 * the shop opens only once the French compliance checklist passes; then a guest in Paris adds
 * two variants, applies a code, reads the recap, ticks the terms and presses "Commander avec
 * obligation de paiement", pays by card (fake Stripe session → signed webhook pipeline), sees
 * the order paid; staff ship it with Colissimo, and the order page shows the tracking link.
 * Needs the demo shop (`seed_dev`) and the staff account of the suite (shop.* permissions).
 */
const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'

async function staffApi(request: APIRequestContext, method: 'GET' | 'POST' | 'PATCH', path: string, data?: unknown) {
  const res = await request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210' } })
  expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.json()
}

async function staffSend(request: APIRequestContext, method: 'PUT' | 'PATCH', path: string, data: unknown) {
  return request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210' } })
}

/** Fills the seeded placeholders (test identity, confirmed rates, mediator) so the shop can open. */
async function makeCompliant(request: APIRequestContext) {
  const entities = await staffApi(request, 'GET', '/shop/legal-entities')
  const fr = entities.data.find((e: { code: string }) => e.code === 'mouzoun_fr')
  await staffSend(request, 'PUT', `/shop/legal-entities/${fr.id}`, {
    legal_name: 'MOUZOUN TEST SAS', legal_form: 'SAS', share_capital_minor: 100000,
    address: { line1: '1 rue de Test', postal_code: '75001', city: 'Paris', country_code: 'FR' },
    registration: { siren: '732829320', siret: '73282932000074', rcs_city: 'Paris', vat_number: 'FR44732829320' },
    email: 'boutique@example.com', host: { name: 'Google Cloud France SARL' },
  })
  const tax = await staffApi(request, 'GET', '/shop/tax-rates')
  for (const r of tax.rates.filter((x: { country_code: string, is_active: boolean, is_confirmed: boolean }) => x.country_code === 'FR' && x.is_active && !x.is_confirmed)) {
    await staffSend(request, 'PUT', `/shop/tax-rates/${r.id}`, { ...r, is_confirmed: true })
  }
  await staffApi(request, 'PATCH', '/shop/settings', { 'payments.stripe.enabled': true, 'shop.consumer_mediator': { name: 'Médiateur test', url: 'https://mediateur.example' } })
  await completeFoodInformation(request, API, process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210')
}

test('the cookie banner refuses as easily as it accepts, and comes back from the footer', async ({ page }) => {
  await page.goto('/boutique')
  await ready(page)
  const banner = page.getByTestId('cookie-banner')
  await expect(banner).toBeVisible()
  const reject = page.getByTestId('cookie-reject')
  const accept = page.getByTestId('cookie-accept')
  // Same size and style: refusing is not harder than accepting.
  const [r, a] = [await reject.boundingBox(), await accept.boundingBox()]
  expect(Math.round(r!.width)).toBe(Math.round(a!.width))
  expect(Math.round(r!.height)).toBe(Math.round(a!.height))
  expect(await reject.getAttribute('class')).toBe(await accept.getAttribute('class'))
  await reject.click()
  await expect(banner).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('mz-consent'))).toBe('denied')
  await page.reload()
  await ready(page)
  await expect(banner).toBeHidden()
  await page.getByTestId('footer-cookies').click()
  await expect(banner).toBeVisible()
})

test('catalog-only mode shows the products but no buying', async ({ page, request }) => {
  await staffApi(request, 'PATCH', '/shop/settings', { 'shop.status': 'catalog_only' })
  await page.goto('/boutique')
  await ready(page)
  await expect(page.getByTestId('shop-coming-soon')).toBeVisible()
  await expect(page.getByTestId('shop-card').first()).toBeVisible()
  await page.goto('/boutique/p/dattes-medjool')
  await ready(page)
  await expect(page.getByTestId('add-to-cart')).toHaveCount(0)
})

test('a guest buys two variants by card and follows the parcel', async ({ page, request }) => {
  // Placeholders block the opening until the checklist passes.
  const refused = await staffSend(request, 'PATCH', '/shop/settings', { 'shop.status': 'open' })
  expect(refused.status()).toBe(409)
  await makeCompliant(request)
  // Once the checklist passes, opening needs nothing else.
  await staffApi(request, 'PATCH', '/shop/settings', { 'shop.status': 'open' })
  const code = `E2E${Date.now() % 100000}`
  await staffApi(request, 'POST', '/shop/promotions', { code, scope: 'shop', discount_type: 'percent', percent: '10', is_active: true, applies_to_all: true, translations: { fr: { name: 'E2E' } } })

  await page.goto('/boutique/p/dattes-medjool')
  await ready(page)
  await page.getByRole('radio', { name: '500 g' }).click()
  await page.getByTestId('add-to-cart').click()
  await expect(page.getByTestId('shop-cart-badge')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('radio', { name: '1 kg' }).click()
  await expect(page).toHaveURL(/variant=/)
  await page.getByTestId('add-to-cart').click()

  await page.goto('/boutique/cart')
  await ready(page)
  await expect(page.locator('[data-testid^="cart-line-MEDJOOL"]')).toHaveCount(2)
  await page.getByTestId('promo-input').fill(code)
  await page.getByRole('button', { name: 'Appliquer' }).click()
  await expect(page.getByText(`Code ${code}`)).toBeVisible()
  await page.getByTestId('go-checkout').click()

  await ready(page)
  const email = `shop-${Date.now()}@example.com`
  await page.getByTestId('checkout-email').fill(email)
  await page.getByLabel('Livraison à domicile').check()
  const address = page.getByTestId('address-form')
  await address.locator('input[autocomplete="given-name"]').fill('Amina')
  await address.locator('input[autocomplete="family-name"]').fill('Ait Ali')
  await address.locator('input[autocomplete="address-line1"]').fill('12 rue Oberkampf')
  await address.locator('input[autocomplete="postal-code"]').fill('75011')
  await address.locator('input[autocomplete="address-level2"]').fill('Paris')
  await address.locator('input[autocomplete="tel"]').fill('06 12 34 56 78')
  await page.getByRole('button', { name: 'Utiliser cette adresse' }).click()
  await page.getByLabel('Carte, Apple Pay, Google Pay').check()
  await expect(page.getByTestId('checkout-recap')).toContainText('MOUZOUN TEST SAS')
  // The terms box is never pre-ticked; the button states the obligation to pay.
  await expect(page.getByTestId('checkout-terms').locator('button, input').first()).not.toBeChecked()
  await expect(page.getByTestId('place-order')).toHaveText('Commander avec obligation de paiement')
  await page.getByTestId('checkout-terms').click()
  await page.getByTestId('place-order').click()

  // Simulated Stripe: back on the order page, "pay" sends the signed event through the webhook.
  await expect(page).toHaveURL(/\/boutique\/orders\/MZS-\d{2}-\d+.*fake_session=/)
  await ready(page)
  await page.getByTestId('fake-pay').click()
  await expect(page.getByTestId('order-payment-status')).toHaveText('Payée', { timeout: 30_000 })
  const number = page.url().match(/MZS-\d{2}-\d+/)![0]

  // Staff fulfil and ship it.
  const list = await staffApi(request, 'GET', `/shop/orders?q=${number}`)
  const id = list.data[0].id
  const fulfilled = await staffApi(request, 'POST', `/shop/orders/${id}/fulfillments`, {})
  await staffApi(request, 'PATCH', `/shop/fulfillments/${fulfilled.created_fulfillment_id}`, { action: 'ship', carrier: 'colissimo', tracking_number: '6A12345678901', tracking_url: 'https://www.laposte.fr/outils/suivre-vos-envois?code=6A12345678901' })

  await page.reload()
  await ready(page)
  await expect(page.getByTestId('order-fulfillment')).toContainText('6A12345678901')
  await expect(page.getByRole('link', { name: 'Suivre le colis' })).toHaveAttribute('href', /laposte\.fr/)
})
