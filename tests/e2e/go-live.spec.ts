import { expect, test, type Page } from '@playwright/test'
import { API_BASE, STAFF, seriousViolations } from './fixtures'

/** Go-live checklist and booking switch (mocked API). */

const CHECKS_FAILING = [
  { key: 'prices', ok: true, required: true, details: [] },
  { key: 'rate_plans', ok: true, required: true, details: [] },
  { key: 'availability', ok: true, required: true, details: [] },
  { key: 'content', ok: false, required: true, details: [{ what: 'product', name: 'Tente nomade', locale: 'ar' }] },
  { key: 'payments', ok: false, required: true, details: [{ missing: 'provider' }] },
  { key: 'payments_verified', ok: true, required: false, details: [] },
  { key: 'emails', ok: true, required: false, details: [] },
]

const PAYMENTS_NONE = { online: false, provider: null, mode: null, webhook_configured: false, last_webhook_at: null, webhook_errors: 0 }
const PAYMENTS_LIVE = { online: true, provider: 'stripe', mode: 'live', webhook_configured: true, last_webhook_at: '2026-11-12T09:00:00Z', webhook_errors: 0 }

async function mock(page: Page, ready: boolean) {
  let enabled = false
  const list = () => ({
    ready,
    enabled,
    checks: ready ? CHECKS_FAILING.map(c => ({ ...c, ok: true, details: [] })) : CHECKS_FAILING,
    payments: ready ? PAYMENTS_LIVE : PAYMENTS_NONE,
    checked_at: '2026-11-12T10:00:00Z',
  })
  await page.route(`${API_BASE}/**`, async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (path === '/v1/auth/me') return route.fulfill({ json: STAFF })
    if (path === '/v1/admin/booking/go-live') return route.fulfill({ json: list() })
    if (path === '/v1/admin/booking/enabled') {
      enabled = (req.postDataJSON() as { enabled: boolean }).enabled
      return route.fulfill({ json: list() })
    }
    if (path === '/v1/admin/dashboard/today') {
      return route.fulfill({ json: { date: '2026-11-12', arrivals: [], departures: [], in_house: [], slots: [], requests: [], balances_due: [], failed_payments: [], precheckin_missing: [], alerts: { open_tasks: 0, webhook_errors: 0, dead_events: 0 } } })
    }
    return route.fulfill({ status: 404, json: { error: { code: 'not_found' } } })
  })
}

test('booking cannot be opened while a required check fails, and says what to fix', async ({ page }) => {
  await mock(page, false)
  await page.goto('/admin/go-live')
  await expect(page.getByTestId('payment-status')).toContainText('Paiement en ligne non configuré')
  await expect(page.getByTestId('check-content')).toContainText('Tente nomade')
  await expect(page.getByTestId('check-content')).toContainText('AR')
  await expect(page.getByTestId('go-live-open')).toBeDisabled()
  expect(await seriousViolations(page)).toEqual([])
})

test('when everything is ready, booking opens after confirmation', async ({ page }) => {
  await mock(page, true)
  await page.goto('/admin/go-live')
  await expect(page.getByTestId('payment-status')).toContainText('Stripe en production')
  await page.getByTestId('go-live-open').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Ouvrir les réservations' }).click()
  await expect(page.getByTestId('go-live-status')).toContainText('Ouverte au public')
  await expect(page.getByTestId('go-live-close')).toBeVisible()
})

test('the dashboard says when booking is closed and online payment is not configured', async ({ page }) => {
  await mock(page, false)
  await page.goto('/admin')
  const banner = page.getByTestId('booking-state')
  await expect(banner).toContainText('La réservation en ligne est fermée au public.')
  await expect(banner).toContainText('Paiement en ligne non configuré')
})

test('a product page answers 503, not 404, when the API is unreachable (search engines retry)', async ({ page }) => {
  // Server-side rendering calls the API directly: in this suite nothing listens on it.
  const response = await page.goto('/stays/tente-nomade')
  expect(response?.status()).toBe(503)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Service momentanément indisponible')
})

test('while online booking is closed, the home page says how to book instead of pretending', async ({ page }) => {
  // Server-side, the API is unreachable in this suite: booking counts as closed.
  await page.goto('/')
  const book = page.getByTestId('home-book')
  await expect(book).toHaveText('Écrire pour réserver')
  await expect(book).toHaveAttribute('href', /^mailto:|#contact$/)
  await expect(page.getByRole('link', { name: 'Réserver un séjour' }).first()).toHaveAttribute('href', '#book')
})
