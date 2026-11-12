import { type Page, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Shared steps of the full-stack suite (real API, real database, emails in Mailpit). */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025'

export const prefix = (projectName: string) => (projectName.startsWith('ar') ? '/ar' : '')

export function day(offset: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

/** Each run books its own dates (no collision between runs on the development database). */
export const base = 60 + Math.floor(Math.random() * 200)

/** Clicks before hydration are lost: wait for the Vue app and the first data. */
export async function ready(page: Page) {
  await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as unknown as { __vue_app__?: unknown })?.__vue_app__)
  await page.waitForLoadState('networkidle')
}

export async function noSeriousA11yIssues(page: Page) {
  // Measured at rest: a dialog fading in has translucent text, which would read as low contrast.
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'))
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map(v => `${v.id} ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`)).toEqual([])
}

export async function fillCheckout(page: Page, email: string) {
  await expect(page.getByTestId('checkout-form')).toBeVisible()
  await ready(page)
  const form = page.getByTestId('checkout-form')
  await form.locator('input[autocomplete="given-name"]').fill('Amina')
  await form.locator('input[autocomplete="family-name"]').fill('Test')
  await form.locator('input[autocomplete="email"]').fill(email)
  await form.locator('input[autocomplete="tel-national"]').fill('600000000')
  await form.getByTestId('accept-terms').click()
}

interface MailSummary { ID: string, Subject: string, Created: string }

/** Text of the newest email sent to `to` whose body matches `pattern` (waits for delivery). */
export async function mailMatching(to: string, pattern: RegExp): Promise<RegExpMatchArray> {
  let match: RegExpMatchArray | null = null
  await expect.poll(async () => {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)
    const { messages } = await search.json() as { messages: MailSummary[] }
    for (const m of messages) {
      const body = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json() as { Text: string }
      match = body.Text.match(pattern)
      if (match) return true
    }
    return false
  }, { message: `an email to ${to} matching ${pattern}`, timeout: 30_000 }).toBe(true)
  return match!
}

/** Books a stay paid at the camp; returns its reference. */
export async function bookPayAtCamp(page: Page, p: string, email: string, offset: number, opts: { createAccount?: boolean } = {}) {
  const [arrival, departure] = [day(base + offset), day(base + offset + 1)]
  await page.goto(`${p}/stays?checkin=${arrival}&checkout=${departure}&adults=2`)
  await ready(page)
  const result = page.getByTestId('result-emplacement-camping-car').or(page.getByTestId('result-makan-lilaraba'))
  await result.getByTestId('see-rates').click()
  await result.getByTestId('rate-reserve').first().click()
  await expect(page).toHaveURL(/\/trip/)
  await ready(page)
  await page.getByTestId('trip-continue').click()
  await fillCheckout(page, email)
  await page.getByTestId('option-on_site').check()
  if (opts.createAccount) await page.getByTestId('checkout-create-account').click()
  await page.getByTestId('checkout-submit').click()
  await expect(page.getByTestId('booking-page')).toBeVisible()
  return (await page.getByTestId('booking-reference').textContent())!.trim()
}
