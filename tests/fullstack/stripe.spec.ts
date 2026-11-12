import { type FrameLocator, type Page, expect, test } from '@playwright/test'
import { base, day, fillCheckout, ready } from './helpers'

/**
 * Stripe TEST mode end to end: the Payment Element, 3-D Secure, and the confirmation that only a
 * Stripe webhook can give. Runs only with STRIPE_E2E=1 (see playwright.fullstack.config.ts):
 * the API needs test keys and `stripe listen` forwarding webhooks to it.
 */

const cards = {
  success: '4242424242424242',
  threeDSecure: '4000002500003155',
  declined: '4000000000009995',
}

async function bookDeposit(page: Page, offset: number) {
  const [arrival, departure] = [day(base + offset), day(base + offset + 2)]
  await page.goto(`/stays?checkin=${arrival}&checkout=${departure}&adults=2`)
  await ready(page)
  const result = page.getByTestId('result-tente-nomade')
  await result.getByTestId('see-rates').click()
  await result.getByTestId('rate-reserve').first().click()
  await ready(page)
  await page.getByTestId('trip-continue').click()
  await fillCheckout(page, `stripe-${Date.now()}@example.com`)
  await page.getByTestId('option-deposit').check()
  await page.getByTestId('checkout-submit').click()
  await expect(page).toHaveURL(/\/booking\/MZ-\d{2}-\d+\/pay/)
}

/** The card fields of the Payment Element (one iframe). */
function paymentElement(page: Page): FrameLocator {
  return page.frameLocator('iframe[title*="Secure payment input frame"]').first()
}

async function fillCard(page: Page, number: string) {
  const frame = paymentElement(page)
  await frame.locator('[name="number"]').fill(number)
  await frame.locator('[name="expiry"]').fill('12 / 34')
  await frame.locator('[name="cvc"]').fill('123')
  const country = frame.locator('[name="country"]')
  if (await country.isVisible()) await country.selectOption('MA')
}

test('a card payment confirms the booking through the Stripe webhook', async ({ page }) => {
  await bookDeposit(page, 30)
  await fillCard(page, cards.success)
  await page.getByTestId('pay-button').click()
  await expect(page.getByTestId('booking-page')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('paid-amount')).not.toHaveText(/^0/, { timeout: 60_000 })
})

test('3-D Secure: the bank challenge, then the confirmation', async ({ page }) => {
  await bookDeposit(page, 35)
  await fillCard(page, cards.threeDSecure)
  await page.getByTestId('pay-button').click()
  const challenge = page.frameLocator('iframe[name^="__privateStripeFrame"]').last()
    .frameLocator('iframe[name="stripe-challenge-frame"]')
  await challenge.getByRole('button', { name: /complete/i }).click()
  await expect(page.getByTestId('booking-page')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('paid-amount')).not.toHaveText(/^0/, { timeout: 60_000 })
})

test('a declined card keeps the guest on the payment page with the reason, hold kept', async ({ page }) => {
  await bookDeposit(page, 40)
  await fillCard(page, cards.declined)
  await page.getByTestId('pay-button').click()
  await expect(page.getByTestId('payment-error')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('hold-countdown')).toBeVisible()
})
