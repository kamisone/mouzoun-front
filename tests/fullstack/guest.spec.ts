import { expect, test } from '@playwright/test'
import { base, bookPayAtCamp, day, fillCheckout, mailMatching, noSeriousA11yIssues, prefix, ready } from './helpers'

/**
 * Guests, against the real API with online booking open (setup project) and the simulated
 * payment provider. Each project runs it in its language: French on desktop, Arabic on a phone.
 */

test('the home page leads to online booking', async ({ page }, info) => {
  const p = prefix(info.project.name)
  await page.goto(`${p}/`)
  await ready(page)
  await page.getByTestId('home-book').click()
  await expect(page).toHaveURL(new RegExp(`${p}/stays`))
  await expect(page.getByRole('main').locator('a[href^="mailto:"]')).toHaveCount(0)
})

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
  // Everything is shown before paying: today's amount, the balance and its date, the policy.
  // On a phone the summary is folded above the form: the guest opens it.
  const toggle = page.getByTestId('summary-toggle')
  if (await toggle.isVisible()) await toggle.click()
  await expect(page.getByTestId('due-today').locator('visible=true')).toBeVisible()
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
  const email = `camp-${Date.now()}@example.com`
  await bookPayAtCamp(page, p, email, 5, { createAccount: true })
  // "Create an account" at checkout: a sign-in code goes to the booking address.
  await mailMatching(email, /\b\d{6}\b/)

  await page.getByTestId('cancel-open').click()
  await expect(page.getByTestId('cancel-preview')).toBeVisible()
  await noSeriousA11yIssues(page)
  await page.getByTestId('cancel-confirm').click()
  await expect(page.getByTestId('cancel-open')).toBeHidden()
})

test('a guest booking joins an account made with another address, through its email', async ({ page }, info) => {
  const p = prefix(info.project.name)
  const stamp = Date.now()
  const booker = `claim-booking-${stamp}@example.com`
  const member = `claim-account-${stamp}@example.com`
  const reference = await bookPayAtCamp(page, p, booker, 20)

  // Sign up with another address: code by email, then the name.
  await page.context().clearCookies()
  await page.goto(`${p}/account/signin`)
  await ready(page)
  await page.getByTestId('signin-email').fill(member)
  await page.getByTestId('signin-continue').click()
  const [code] = await mailMatching(member, /\b\d{6}\b/)
  await page.getByTestId('code-0').click()
  await page.keyboard.type(code)
  const panel = page.getByTestId('signin-panel')
  await panel.locator('input[autocomplete="given-name"]').fill('Amina')
  await panel.locator('input[autocomplete="family-name"]').fill('Test')
  await page.getByTestId('signin-finish').click()
  await expect(page).toHaveURL(new RegExp(`${p}/account`))

  // "Add a booking": the link goes to the booking's address, never to the account's.
  await page.goto(`${p}/account/trips/claim`)
  await ready(page)
  await page.getByTestId('claim-reference').fill(reference)
  await page.getByTestId('claim-email').fill(booker)
  await page.getByTestId('claim-submit').click()
  await expect(page.getByTestId('claim-sent')).toBeVisible()
  const [link] = await mailMatching(booker, /https?:\/\/\S+\/account\/trips\/claim\?token=[\w-]+/)

  await page.goto(new URL(link).pathname + new URL(link).search)
  await expect(page.getByTestId('claim-done')).toContainText(reference)
  await page.goto(`${p}/account/trips`)
  await ready(page)
  await expect(page.getByText(reference)).toBeVisible()
  await noSeriousA11yIssues(page)
})
