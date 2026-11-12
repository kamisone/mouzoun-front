import { type Page, expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The booking funnel against the real API (fake payment provider). Each project runs it in its
 * language: French on desktop, Arabic (RTL) on a phone.
 */
const prefix = (projectName: string) => (projectName.startsWith('ar') ? '/ar' : '')
function day(offset: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
/** Each test books its own dates (no collision between runs on the dev database). */
const base = 60 + Math.floor(Math.random() * 200)

/** Clicks before hydration are lost: wait for the Vue app and the first data. */
async function ready(page: Page) {
  await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as unknown as { __vue_app__?: unknown })?.__vue_app__)
  await page.waitForLoadState('networkidle')
}

async function noSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map(v => `${v.id} ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`)).toEqual([])
}

async function fillCheckout(page: Page, email: string) {
  await expect(page.getByTestId('checkout-form')).toBeVisible()
  await ready(page)
  const form = page.getByTestId("checkout-form")
  await form.locator('input[autocomplete="given-name"]').fill('Amina')
  await form.locator('input[autocomplete="family-name"]').fill('Test')
  await form.locator('input[autocomplete="email"]').fill(email)
  await form.locator('input[autocomplete="tel-national"]').fill('600000000')
  await form.getByRole('checkbox', { name: /J'accepte|I accept|أوافق/ }).click()
}

test('stay + extra + activity, deposit paid online, then the booking page', async ({ page }, info) => {
  const p = prefix(info.project.name)
  const [arrival, departure] = [day(base), day(base + 2)]
  await page.goto(`${p}/stays?checkin=${arrival}&checkout=${departure}&adults=2`)
  await ready(page)
  const result = page.getByTestId('result-tente-nomade').or(page.getByTestId('result-khaymat-ruhhal'))
  await result.getByTestId('see-rates').click()
  await result.getByTestId('rate-reserve').first().click()

  await expect(page).toHaveURL(/\/trip/)
  await ready(page)
  await expect(page.getByTestId('trip-items')).toBeVisible()
  await noSeriousA11yIssues(page)
  // Complete the trip: an extra of the stay and an activity during the stay.
  await page.getByTestId('upsell-add').first().click()
  await expect(page.getByTestId('trip-items').locator('li li')).not.toHaveCount(0)
  await page.getByTestId('upsell-activity').first().click()
  await page.getByTestId('slot-chips').getByRole('radio').and(page.locator(':enabled')).first().click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByTestId('trip-items').locator(':scope > li')).toHaveCount(2)
  await page.getByTestId('trip-continue').click()

  await expect(page).toHaveURL(/\/checkout/)
  await fillCheckout(page, `deposit-${Date.now()}@example.com`)
  await page.getByTestId('option-deposit').check()
  await expect(page.getByTestId('due-today')).toBeVisible()
  await noSeriousA11yIssues(page)
  await page.getByTestId('checkout-submit').click()

  await expect(page).toHaveURL(/\/booking\/MZ-\d{2}-\d+\/pay/)
  await expect(page.getByTestId('hold-countdown')).toBeVisible()
  await page.getByTestId('pay-button').click()

  await expect(page.getByTestId('booking-page')).toBeVisible()
  await expect(page.getByTestId('booking-reference')).toHaveText(/MZ-\d{2}-\d+/)
  await expect(page.getByTestId('paid-amount')).not.toHaveText(/^0/, { timeout: 30_000 })
  await noSeriousA11yIssues(page)
})

test('pay at the camp, then cancel from the manage page with the refund shown first', async ({ page }, info) => {
  const p = prefix(info.project.name)
  const [arrival, departure] = [day(base + 5), day(base + 6)]
  await page.goto(`${p}/stays?checkin=${arrival}&checkout=${departure}&adults=2`)
  await ready(page)
  const result = page.getByTestId('result-emplacement-camping-car').or(page.getByTestId('result-makan-lilaraba'))
  await result.getByTestId('see-rates').click()
  await result.getByTestId('rate-reserve').first().click()
  await expect(page).toHaveURL(/\/trip/)
  await ready(page)
  await page.getByTestId('trip-continue').click()
  await fillCheckout(page, `camp-${Date.now()}@example.com`)
  await page.getByTestId('option-on_site').check()
  await page.getByTestId('checkout-submit').click()

  await expect(page.getByTestId('booking-page')).toBeVisible()
  await page.getByTestId('cancel-open').click()
  await expect(page.getByTestId('cancel-preview')).toBeVisible()
  await page.getByTestId('cancel-confirm').click()
  await expect(page.getByTestId('cancel-open')).toBeHidden()
})

test('booking request accepted by staff', async ({ page }, info) => {
  test.skip(!process.env.E2E_STAFF_EMAIL, 'needs E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD')
  test.skip(info.project.name !== 'fr-desktop', 'staff flow once')
  await page.goto(`/activities/visite-village-mssici`)
  await ready(page)
  await page.getByTestId('widget-date').fill(day(base + 10))
  await page.getByTestId('widget-reserve').click()
  await expect(page).toHaveURL(/\/trip/)
  await ready(page)
  await page.getByTestId('trip-continue').click()
  await fillCheckout(page, `request-${Date.now()}@example.com`)
  await page.getByTestId('checkout-submit').click()
  await expect(page.getByTestId('booking-page')).toBeVisible()
  const reference = (await page.getByTestId('booking-reference').textContent())!.trim()

  await page.goto('/admin/login')
  await ready(page)
  await page.locator('input[type="email"]').fill(process.env.E2E_STAFF_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.E2E_STAFF_PASSWORD!)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/admin$/)
  await page.goto(`/admin/bookings?q=${reference}`)
  await ready(page)
  await page.getByRole('link', { name: reference }).click()
  await page.getByRole('button', { name: 'Accepter' }).click()
  await expect(page.getByText('Attente de paiement').first()).toBeVisible()
})

test('staff phone booking with a cash payment', async ({ page }, info) => {
  test.skip(!process.env.E2E_STAFF_EMAIL, 'needs E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD')
  test.skip(info.project.name !== 'fr-desktop', 'staff flow once')
  await page.goto('/admin/login')
  await ready(page)
  await page.locator('input[type="email"]').fill(process.env.E2E_STAFF_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.E2E_STAFF_PASSWORD!)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/\/admin$/)
  await page.goto('/admin/bookings/new')
  await ready(page)
  await page.getByRole('button', { name: 'Prestation' }).click()
  await page.getByRole('option', { name: /Emplacement tente/ }).click()
  const [arrival, departure] = [day(base + 15), day(base + 17)]
  for (const d of [arrival, departure]) {
    while (!(await page.locator(`[data-value="${d}"]`).first().isVisible())) {
      await page.getByRole('button', { name: /suivant|next/i }).first().click()
    }
    await page.locator(`[data-value="${d}"]`).first().click()
  }
  await page.getByRole('button', { name: 'Ajouter une prestation' }).last().click()
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Hassan')
  await page.locator('input[type="tel"]').last().fill('+212 611 111 111')
  await page.getByRole('textbox', { name: 'Montant reçu maintenant' }).fill('20')
  await page.getByRole('button', { name: 'Créer la réservation' }).click()
  await expect(page).toHaveURL(/\/admin\/bookings\/[0-9a-f-]{36}/)
  await expect(page.getByText('Espèces').first()).toBeVisible()
})
