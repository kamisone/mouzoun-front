import type { APIRequestContext } from '@playwright/test'
import { tr } from '../i18n'
import { expect, test } from './fixtures'
import { ready } from './helpers'

/**
 * Farm shop end to end against the real API (simulated card provider, PAYMENTS_FAKE=true):
 * catalog-only mode hides buying; the shop opens only once the French compliance checklist
 * passes; then a guest in Paris adds two variants (Escape closes the cart drawer and focus goes
 * back to "Ajouter au panier"), applies a code, reads the recap, ticks the terms and presses
 * "Commander avec obligation de paiement", pays by card (fake Stripe session → signed webhook
 * pipeline), sees the order paid; staff ship it with Colissimo, and the order page shows the
 * tracking link.
 * Needs the demo shop (`seed_dev`) and the staff account of the suite (shop.* permissions).
 * The cookie banner has its own spec (consent.spec.ts).
 *
 * Starts in catalog-only mode (declared below); the `shop` fixture puts back the mode and the
 * compliance data after each test, so the order of the specs does not matter.
 */
test.use({ shopMode: 'catalog_only' })
const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'

async function staffApi(request: APIRequestContext, method: 'GET' | 'POST' | 'PATCH', path: string, data?: unknown) {
  const res = await request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210' } })
  expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.json()
}

async function staffSend(request: APIRequestContext, method: 'PUT' | 'PATCH', path: string, data: unknown) {
  return request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210' } })
}

test('catalog-only mode shows the products but no buying', async ({ page }) => {
  await page.goto('/boutique')
  await ready(page)
  await expect(page.getByTestId('shop-coming-soon')).toBeVisible()
  await expect(page.getByTestId('shop-card').first()).toBeVisible()
  await page.goto('/boutique/p/dattes-medjool')
  await ready(page)
  await expect(page.getByTestId('add-to-cart')).toHaveCount(0)
})

test('a guest buys two variants by card and follows the parcel', async ({ page, request, shop }) => {
  // The seed's placeholders block the opening until the checklist passes.
  const refused = await staffSend(request, 'PATCH', '/shop/settings', { 'shop.status': 'open' })
  expect(refused.status()).toBe(409)
  expect((await refused.json()).error.code).toBe('compliance_checklist')
  // Once the checklist passes, opening needs nothing else.
  await shop.mode('open')
  const code = `E2E${Date.now() % 100000}`
  await staffApi(request, 'POST', '/shop/promotions', { code, scope: 'shop', discount_type: 'percent', percent: '10', is_active: true, applies_to_all: true, translations: { fr: { name: 'E2E' } } })

  await page.goto('/boutique/p/dattes-medjool')
  await ready(page)
  await page.getByRole('radio', { name: '500 g' }).click()
  const add = page.getByTestId('add-to-cart')
  await add.click()
  // The drawer is a modal dialog named "Votre panier"; Escape closes it and focus goes back to
  // the button that opened it.
  const drawer = page.getByRole('dialog', { name: tr('fr', 'shop.cart.title') })
  await expect(drawer).toBeVisible()
  await expect(drawer).toHaveAttribute('aria-modal', 'true')
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(add).toBeFocused()
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
  // The test id is on the checkbox itself (Nuxt UI forwards attributes to it).
  await expect(page.getByTestId('checkout-terms')).toHaveRole('checkbox')
  await expect(page.getByTestId('checkout-terms')).not.toBeChecked()
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
