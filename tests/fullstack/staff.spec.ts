import { expect, test } from '@playwright/test'
import { base, day, fillCheckout, ready } from './helpers'

/** Back office against the real API, with the staff session of the setup project. */

test('booking request accepted by staff', async ({ browser, page }) => {
  // The guest books in a separate, signed-out context.
  const guest = await (await browser.newContext()).newPage()
  await guest.goto('/activities/visite-village-mssici')
  await ready(guest)
  await guest.getByTestId('widget-date').fill(day(base + 10))
  await guest.getByTestId('widget-reserve').click()
  await expect(guest).toHaveURL(/\/trip/)
  await ready(guest)
  await guest.getByTestId('trip-continue').click()
  await fillCheckout(guest, `request-${Date.now()}@example.com`)
  await guest.getByTestId('checkout-submit').click()
  await expect(guest.getByTestId('booking-page')).toBeVisible()
  const reference = (await guest.getByTestId('booking-reference').textContent())!.trim()

  await page.goto(`/admin/bookings?q=${reference}`)
  await ready(page)
  await page.getByRole('link', { name: reference }).click()
  await page.getByRole('button', { name: 'Accepter' }).click()
  await expect(page.getByText('Attente de paiement').first()).toBeVisible()
})

test('staff phone booking with a cash payment', async ({ page }) => {
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
