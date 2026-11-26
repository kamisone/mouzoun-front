import { expect, test } from './fixtures'
import { ready } from './helpers'

/**
 * Admin › Settings › Legal entity against the real API: a wrong SIREN is shown next to its field
 * (never saved); a valid identity and mediator are saved, and the checklist lines turn green.
 * The `shop` fixture records the legal entity and the mediator first and puts them back after
 * the test, so the shop specs still start from the seed's placeholders.
 */
test('the company facts are edited in the admin form', async ({ page, shop }) => {
  await shop.remember()
  await page.goto('/admin/settings/legal-entity')
  await ready(page)
  const field = (code: string) => page.locator(`[data-field="${code}"]`)
  const fill = async (code: string, value: string) => field(code).locator('input').fill(value)

  // A new name each run, so the save always changes something.
  await fill('legal_name', `MOUZOUN E2E ${Date.now().toString(36).toUpperCase()} SAS`)
  await fill('legal_form', 'SAS')
  await fill('address.line1', '1 rue de Test')
  await fill('address.postal_code', '75001')
  await fill('address.city', 'Paris')
  await fill('email', 'boutique@example.com')
  await fill('registration.siren', '123456789')
  await fill('registration.siret', '73282932000074')
  await fill('registration.rcs_city', 'Paris')
  await fill('registration.vat_number', 'FR44732829320')
  await fill('mediator.name', 'Médiateur E2E')
  await fill('mediator.url', 'https://mediateur.example')
  await page.getByTestId('save-legal-entity').click()
  await expect(field('registration.siren')).toContainText('Clé de contrôle invalide')

  await fill('registration.siren', '732829320')
  await page.getByTestId('save-legal-entity').click()
  await expect(page.getByText('Entité juridique enregistrée').first()).toBeVisible()
  await expect(field('registration.siren')).not.toContainText('Clé de contrôle invalide')

  await page.goto('/admin/shop/france')
  await ready(page)
  await expect(page.getByTestId('check-seller_identity').locator('.text-success')).toBeVisible()
  await expect(page.getByTestId('check-consumer_mediator').locator('.text-success')).toBeVisible()
})
