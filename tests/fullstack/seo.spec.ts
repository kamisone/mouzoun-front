import type { APIRequestContext } from '@playwright/test'
import { expect, test } from './fixtures'
import { ready } from './helpers'

/**
 * SEO end to end against the real API (the Nuxt server runs with NUXT_SITE_ENV=production):
 * renamed content redirects in French and Arabic; a manual redirect made in Admin › SEO; a missing
 * address reaches "Erreurs 404" with a suggestion and becomes a redirect; every URL of the sitemap
 * answers 200, self-canonical, without noindex; robots.txt; the address tester explains a noindexed
 * page. Needs the demo data (`seed_dev`: shop, pages, renamed activity) and a staff account with
 * seo.manage and shop.catalog.
 */
// Shop pages, their redirects and the sitemap's shop entries need a visible shop.
test.use({ shopMode: 'catalog_only' })

const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'
const ORIGIN = process.env.FULLSTACK_ORIGIN ?? 'http://127.0.0.1:3210'

async function staff(request: APIRequestContext, method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, data?: unknown, headers: Record<string, string> = {}) {
  const res = await request.fetch(`${API}/v1/admin${path}`, { method, data, headers: { Origin: ORIGIN, ...headers } })
  expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.status() === 204 ? null : res.json()
}

async function location(request: APIRequestContext, path: string) {
  const res = await request.get(path, { maxRedirects: 0 })
  return { status: res.status(), location: res.headers().location ?? '' }
}

test('renamed content redirects its old addresses, in French and in Arabic', async ({ request }) => {
  const list = await staff(request, 'GET', '/shop/products?status=published&per_page=20')
  const id = list.data.find((p: { product_type: string }) => p.product_type !== 'gift_box').id as string
  const product = await staff(request, 'GET', `/shop/products/${id}`)
  const stamp = Date.now().toString(36)
  const old = { fr: product.translations.fr.slug as string, ar: product.translations.ar.slug as string }
  const renamed = { fr: `${old.fr}-${stamp}`, ar: `${old.ar}-${stamp}` }
  await staff(request, 'PUT', `/shop/products/${id}`, {
    ...product,
    translations: { ...product.translations, fr: { ...product.translations.fr, slug: renamed.fr }, ar: { ...product.translations.ar, slug: renamed.ar } },
  })
  await expect.poll(async () => (await location(request, `/boutique/p/${old.fr}`)).status, { timeout: 30_000 }).toBe(301)
  expect((await location(request, `/boutique/p/${old.fr}`)).location).toMatch(new RegExp(`/boutique/p/${renamed.fr}$`))
  const ar = await location(request, `/ar/boutique/p/${encodeURIComponent(old.ar)}?utm_source=test`)
  expect(ar.status).toBe(301)
  expect(decodeURIComponent(ar.location)).toMatch(new RegExp(`/ar/boutique/p/${renamed.ar}\\?utm_source=test$`))
  // The seeded activity rename (no editor for activities yet) redirects too.
  const redirects = await staff(request, 'GET', '/seo/redirects?source=auto&q=/activities/&per_page=100')
  const activity = redirects.data.find((r: { from_path: string }) => r.from_path.startsWith('/activities/'))
  expect(activity, 'seeded renamed activity').toBeTruthy()
  expect((await location(request, activity.from_path)).location).toContain(activity.to_path)
})

test('a manual redirect made in Admin › SEO is followed', async ({ page, request }) => {
  const from = `/ancienne-offre-${Date.now().toString(36)}`
  await page.goto('/admin/seo')
  await ready(page)
  await page.getByTestId('add-redirect').click()
  const form = page.getByTestId('redirect-form')
  await form.getByTestId('redirect-from').locator('input').or(form.locator('input[data-testid="redirect-from"]')).first().fill(from)
  await form.getByTestId('redirect-to').locator('input').or(form.locator('input[data-testid="redirect-to"]')).first().fill('/activities')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByTestId(`redirect-row-${from}`)).toBeVisible()
  await expect.poll(async () => (await location(request, `${from}?utm_campaign=x`)).location, { timeout: 30_000 }).toMatch(/\/activities\?utm_campaign=x$/)
})

test('a missing address shows in "Erreurs 404" with a suggestion and becomes a redirect', async ({ page, request }) => {
  test.setTimeout(180_000)
  const missing = `/boutique/cofrets-${Date.now().toString(36)}`
  expect((await request.get(missing)).status()).toBe(404)
  // Counted by the Nuxt server (batches every 10 s), written by the API every minute.
  await expect.poll(async () => (await staff(request, 'GET', `/seo/not-found?q=${encodeURIComponent(missing)}`)).data.length, { timeout: 120_000, intervals: [5_000] }).toBe(1)
  // Searched by its address: the list is sorted by visits and paginated, so a new row with one
  // visit is not always on the first page.
  await page.goto(`/admin/seo?tab=not-found&q=${encodeURIComponent(missing)}`)
  await ready(page)
  const row = page.getByTestId(`not-found-${missing}`)
  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: 'Rediriger vers /boutique/coffrets', exact: true })).toBeVisible()
  await row.getByRole('button', { name: 'Créer une redirection' }).click()
  const form = page.getByTestId('redirect-form')
  await expect(form.locator('input').first()).toHaveValue(missing)
  // Prefilled with the closest live address.
  const target = await form.locator('input').nth(1).inputValue()
  expect(target).toMatch(/^\/boutique\/coffrets/)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect.poll(async () => (await location(request, missing)).location, { timeout: 30_000 }).toMatch(new RegExp(`${target}$`))
})

test('every sitemap URL answers 200, is self-canonical and indexable; robots.txt points to it', async ({ request }) => {
  test.setTimeout(240_000)
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Allow: /')
  expect(robots).toContain('Disallow: /admin')
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/)
  const index = await request.get('/sitemap.xml')
  expect(index.headers()['content-type']).toContain('application/xml')
  const files = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]!)
  expect(files.length).toBeGreaterThan(2)
  const urls: string[] = []
  for (const f of files) {
    const xml = await (await request.get(new URL(f).pathname)).text()
    urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]!.replace(/&amp;/g, '&')))
  }
  expect(urls.length).toBeGreaterThan(20)
  for (const url of urls) {
    const path = new URL(url).pathname + new URL(url).search
    const res = await request.get(path, { maxRedirects: 0 })
    expect(res.status(), url).toBe(200)
    const html = await res.text()
    const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1] ?? html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/)?.[1]
    expect(canonical?.replace(/&amp;/g, '&'), `${url} canonical`).toBe(url)
    expect(html, `${url} noindex`).not.toMatch(/<meta[^>]+name="robots"[^>]+noindex/)
  }
})

test('the address tester explains why a page is not indexed', async ({ page, request }) => {
  // The seeded about page, its English version marked "do not index".
  const pages = await staff(request, 'GET', '/pages')
  const about = pages.pages.find((p: { page_type: string, published_revision: number | null }) => p.page_type === 'page' && p.published_revision)
  const tree = await staff(request, 'GET', `/pages/${about.id}/builder`)
  const texts = Object.fromEntries(Object.entries(tree.page.translations as Record<string, Record<string, unknown>>).map(([l, t]) => [l, { ...t, noindex: l === 'en' }]))
  await staff(request, 'PUT', `/pages/${about.id}/builder`, { blocks: tree.blocks, translations: texts }, { 'If-Match': `"${tree.draft_version}"` })
  const enSlug = (tree.page.translations as Record<string, { slug: string }>).en!.slug
  await page.goto('/admin/seo')
  await ready(page)
  await page.getByTestId('tester-input').locator('input').or(page.locator('input[data-testid="tester-input"]')).first().fill(`/en/${enSlug}`)
  await page.getByRole('button', { name: 'Tester' }).click()
  await expect(page.getByTestId('tester-indexing')).toContainText('« ne pas indexer » est coché')
  // The public page says the same to search engines.
  const html = await (await request.get(`/en/${enSlug}`)).text()
  expect(html).toMatch(/<meta[^>]+name="robots"[^>]+noindex/)
})
