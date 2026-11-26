import type { APIRequestContext } from '@playwright/test'
import { tr } from '../i18n'
import { expect, test } from './fixtures'
import { day, fillCheckout, ready } from './helpers'

/**
 * Catalogue editors against the real API (staff with products, pricing and inventory write):
 * a stay built in the admin (units, price, publish) is shown in French and Arabic and booked
 * through the public funnel; an activity's daily schedule creates departures, a booked one
 * cannot be cancelled; a package made of them costs in the simulator what the public funnel
 * charges; renaming the activity's slug gives a 301. Each run uses its own names.
 */
const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'
const ORIGIN = process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210'
const stamp = Date.now().toString(36)

async function call(request: APIRequestContext, method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, data?: unknown) {
  const res = await request.fetch(`${API}${path}`, { method, data, headers: { Origin: ORIGIN } })
  expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.status() === 204 ? null : res.json()
}
const admin = (request: APIRequestContext, method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, data?: unknown) => call(request, method, `/v1/admin${path}`, data)

/** A cover image with its alt text (what the publish checklist wants), uploaded through the API. */
async function cover(request: APIRequestContext): Promise<string> {
  // 1×1 PNG.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
  const res = await request.post(`${API}/v1/admin/media`, {
    headers: { Origin: ORIGIN },
    multipart: { visibility: 'public', file: { name: `cover-${stamp}.png`, mimeType: 'image/png', buffer: png } },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const media = await res.json() as { id: string }
  await admin(request, 'PUT', `/media/${media.id}/texts`, { translations: { fr: { alt_text: 'Tente au coucher du soleil' }, en: { alt_text: 'Tent at sunset' }, ar: { alt_text: 'خيمة عند الغروب' } } })
  return media.id
}

/** PATCH with the current state of the product plus `changes` (the editor's save). */
async function patch(request: APIRequestContext, kind: string, id: string, changes: Record<string, unknown>) {
  const p = await admin(request, 'GET', `/catalog/${kind}/${id}`)
  return admin(request, 'PATCH', `/catalog/${kind}/${id}`, {
    updated_at: p.updated_at, booking_mode: p.booking_mode, translations: p.translations, details: p.details, cover_media_id: p.cover_media_id,
    gallery_media_ids: p.gallery_media_ids, category_ids: p.category_ids, ...changes,
  })
}

let stayId = ''
let staySlug = ''
let activityId = ''

test.describe.configure({ mode: 'serial' })

test('a stay is created with 3 units and a price, published, shown in fr and ar and booked', async ({ page, request }) => {
  staySlug = `khaima-e2e-${stamp}`
  await page.goto('/admin/catalog/stays/new')
  await ready(page)
  await page.getByTestId('name-fr').fill(`Khaïma E2E ${stamp}`)
  await page.getByTestId('short-fr').fill('Une khaïma de test, au calme.')
  await page.getByTestId('locale-tabs').getByRole('tab', { name: /AR/ }).click()
  await page.getByTestId('name-ar').fill(`خيمة اختبار ${stamp}`)
  await page.getByTestId('save-top').click()
  await expect(page).toHaveURL(/\/admin\/catalog\/stays\/[0-9a-f-]{36}/)
  stayId = page.url().split('/').pop()!.split('?')[0]!

  // Units: bulk create E-01 … E-03.
  await page.goto(`/admin/catalog/stays/${stayId}?tab=units`)
  await ready(page)
  const panel = page.getByTestId('units-panel')
  await panel.getByLabel(/Préfixe/).fill('E-')
  await panel.getByLabel(/^À$/).fill('3')
  await page.getByTestId('bulk-units').click()
  await expect(panel.getByTestId('unit-E-03')).toBeVisible()

  // Price: one rule typed in euros, saved with the save bar.
  await page.goto(`/admin/catalog/stays/${stayId}?tab=pricing`)
  await ready(page)
  await page.getByTestId('add-price').click()
  await page.locator('[data-testid="price-row-0"] input[inputmode="decimal"]').first().fill('52,50')
  await page.getByTestId('catalog-save').click()
  await expect(page.getByText('Enregistré', { exact: true }).first()).toBeVisible()
  const prices = await admin(request, 'GET', `/catalog/stays/${stayId}/prices`)
  expect(prices.data[0].amount_minor).toBe(5250)

  // Cover with alt text (upload through the API), then publish from the status column.
  const media = await cover(request)
  await patch(request, 'stays', stayId, { cover_media_id: media })
  await page.goto(`/admin/catalog/stays/${stayId}`)
  await ready(page)
  await expect(page.getByTestId('publish')).toBeEnabled()
  await page.getByTestId('publish').click()
  await expect(page.getByTestId('status-badge')).toHaveText('Publié')

  const detail = await admin(request, 'GET', `/catalog/stays/${stayId}`)
  staySlug = detail.translations.fr.slug
  await page.goto(`/stays/${staySlug}`)
  await ready(page)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Khaïma E2E ${stamp}`)
  await page.goto(`/ar/stays/${encodeURIComponent(detail.translations.ar.slug)}`)
  await ready(page)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`خيمة اختبار ${stamp}`)

  // A night through the existing funnel, paid at the camp.
  const offset = 40 + Math.floor(Math.random() * 200)
  await page.goto(`/stays?checkin=${day(offset)}&checkout=${day(offset + 1)}&adults=2`)
  await ready(page)
  const result = page.getByTestId(`result-${staySlug}`)
  await result.getByTestId('see-rates').click()
  await result.getByTestId('rate-reserve').first().click()
  await expect(page).toHaveURL(/\/trip/)
  await ready(page)
  await page.getByTestId('trip-continue').click()
  await fillCheckout(page, `catalog-${stamp}@example.com`)
  await page.getByTestId('option-on_site').check()
  await page.getByTestId('checkout-submit').click()
  await expect(page.getByTestId('booking-page')).toBeVisible()
})

test('a daily schedule creates departures and a booked departure cannot be cancelled', async ({ page, request }) => {
  const created = await admin(request, 'POST', '/catalog/activities', {
    translations: { fr: { name: `Quad E2E ${stamp}`, short_description: 'Une heure de dunes.' } },
    details: { location_type: 'off_site', scheduling_mode: 'fixed_slots', duration_minutes: 60, max_participants: 8 },
  })
  activityId = created.id
  await admin(request, 'PUT', `/catalog/activities/${activityId}/prices`, [{ pricing_unit: 'per_person', amount_minor: 4500 }])
  await patch(request, 'activities', activityId, { cover_media_id: await cover(request) })

  await page.goto(`/admin/catalog/activities/${activityId}?tab=schedules`)
  await ready(page)
  await page.getByTestId('add-schedule').click()
  await expect(page.getByTestId('schedule-preview').locator('li')).toHaveCount(14)
  await page.getByTestId('save-schedules').click()
  await expect(page.getByText(/départ\(s\) créé\(s\)/).first()).toBeVisible()
  await admin(request, 'POST', `/catalog/activities/${activityId}/publish`)

  const slots = await admin(request, 'GET', `/catalog/activities/${activityId}/slots`)
  expect(slots.data.length).toBeGreaterThan(5)
  const slot = slots.data[3]
  const adult = (await call(request, 'GET', '/v1/catalog/guest-categories')).find((g: { code: string }) => g.code === 'adult').id
  const booking = await admin(request, 'POST', '/bookings', {
    items: [{ kind: 'activity', product_id: activityId, slot_id: slot.id, guests: [{ guest_category_id: adult, count: 2 }] }],
    customer: { first_name: 'Amina', last_name: 'E2E', email: `slot-${stamp}@example.com` },
    source: 'phone', payment_option: 'on_site', skip_guest_emails: true,
  })

  await page.goto(`/admin/catalog/activities/${activityId}?tab=departures`)
  await ready(page)
  await page.getByTestId(`cancel-slot-${slot.local}`).click()
  await expect(page.getByTestId('blocked-bookings')).toContainText(booking.reference)
  const still = await admin(request, 'GET', `/catalog/activities/${activityId}/slots`)
  expect(still.data.find((s: { id: string }) => s.id === slot.id).status).not.toBe('cancelled')
})

test('a package of them costs in the simulator what the public funnel charges', async ({ page, request }) => {
  const created = await admin(request, 'POST', '/catalog/packages', {
    translations: { fr: { name: `Formule E2E ${stamp}`, short_description: 'Deux nuits et un quad.' } },
    details: { duration_days: 3, duration_nights: 2, pricing_mode: 'sum_minus_discount', discount_percent: '10' },
  })
  const id = created.id as string
  await admin(request, 'PUT', `/catalog/packages/${id}/items`, [
    { item_product_id: stayId, quantity: 2, day_number: 1 },
    { item_product_id: activityId, quantity: 1, day_number: 2, is_optional: false },
  ])
  await patch(request, 'packages', id, { cover_media_id: await cover(request) })
  await admin(request, 'POST', `/catalog/packages/${id}/publish`)
  const start = day(60 + Math.floor(Math.random() * 100))

  await page.goto(`/admin/catalog/packages/${id}?tab=pricing`)
  await ready(page)
  const sim = page.getByTestId('price-simulator')
  await sim.locator('input[type="date"]').first().fill(start)
  await page.getByTestId('simulate').click()
  const shown = (await page.getByTestId('simulated-total').textContent())!.replace(/\s/g, '')

  const adult = (await call(request, 'GET', '/v1/catalog/guest-categories')).find((g: { code: string }) => g.code === 'adult').id
  const pub = await call(request, 'POST', '/v1/quote', { items: [{ kind: 'package', product_id: id, arrival: start, guests: [{ guest_category_id: adult, count: 2 }] }] })
  const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(pub.quote.total_minor / 100).replace(/\s/g, '')
  expect(shown).toBe(euros)
})

test('renaming the activity slug redirects the old address (301)', async ({ page, request }) => {
  const before = await admin(request, 'GET', `/catalog/activities/${activityId}`)
  const old = before.translations.fr.slug as string
  await page.goto(`/admin/catalog/activities/${activityId}?tab=seo`)
  await ready(page)
  const slug = page.getByTestId('slug-fr')
  await slug.fill(`${old}-v2`)
  await expect(page.getByText("L'ancienne adresse redirigera vers la nouvelle.")).toBeVisible()
  await page.getByTestId('catalog-save').click()
  await expect(page.getByText('Enregistré', { exact: true }).first()).toBeVisible()
  await expect.poll(async () => (await request.get(`/activities/${old}`, { maxRedirects: 0 })).status(), { timeout: 30_000 }).toBe(301)
  const res = await request.get(`/activities/${old}`, { maxRedirects: 0 })
  expect(res.headers().location).toMatch(new RegExp(`/activities/${old}-v2$`))
})

test('the presentation video is uploaded in the editor, a .mov is refused, and the page shows it', async ({ page, request }) => {
  await page.goto(`/admin/catalog/activities/${activityId}?tab=media`)
  await ready(page)
  const field = page.getByTestId('media-field').filter({ hasText: 'Vidéo de présentation' })
  await expect(field.getByTestId('media-field-hint')).toContainText('MP4 (H.264) ou WebM, 100 Mo max.')
  const input = field.locator('input[type="file"]')
  const mov = Buffer.concat([Buffer.from('\0\0\0\x14ftypqt  \0\0\0\0qt  ', 'binary'), Buffer.alloc(2048)])
  await input.setInputFiles({ name: 'IMG_0042.MOV', mimeType: 'video/quicktime', buffer: mov })
  await expect(field.getByRole('alert')).toContainText('Exportez la vidéo en MP4 (H.264)')
  const mp4 = Buffer.concat([Buffer.from('\0\0\0\x20ftypisom\0\0\x02\0isomiso2avc1mp41', 'binary'), Buffer.alloc(4096)])
  await input.setInputFiles({ name: `quad-${stamp}.mp4`, mimeType: 'video/mp4', buffer: mp4 })
  await expect(field.getByTestId('media-field-video')).toContainText(`quad-${stamp}.mp4`)
  await page.getByTestId('catalog-save').click()
  await expect(page.getByText('Enregistré', { exact: true }).first()).toBeVisible()

  const detail = await admin(request, 'GET', `/catalog/activities/${activityId}`)
  expect(detail.video_media_id).toBeTruthy()
  await page.goto(`/activities/${detail.translations.fr.slug}`)
  await ready(page)
  const video = page.getByTestId('product-video')
  await expect(video).toBeVisible()
  await expect(video.locator('video')).toHaveCount(0)
  await video.getByTestId('video-play').click()
  await expect(video.locator('video')).toHaveAttribute('src', /\.mp4$/)
})

test('catalog list: category and place filters have an "any" option, like the others', async ({ page }) => {
  await page.goto('/admin/catalog/activities')
  await ready(page)
  const picker = page.getByTestId('picker-category')
  const anyCategory = tr('fr', 'admin.catalog.list.anyCategory')
  await expect(picker).toContainText(anyCategory)
  await expect(page.getByTestId('picker-place')).toContainText(tr('fr', 'admin.catalog.list.anyPlace'))
  const rows = page.locator('tbody tr')
  const all = await rows.count()
  await picker.click()
  await expect(page.getByRole('option').first()).toHaveText(anyCategory)
  await page.getByRole('option', { name: /Vie à la ferme/ }).click()
  await expect(page).toHaveURL(/category=/)
  await expect.poll(() => rows.count()).toBeLessThan(all)
  // Back to every category: the first option.
  await picker.click()
  await page.getByRole('option', { name: anyCategory, exact: true }).click()
  await expect(page).not.toHaveURL(/category=/)
  await expect(picker).toContainText(anyCategory)
  await expect.poll(() => rows.count()).toBe(all)
})
