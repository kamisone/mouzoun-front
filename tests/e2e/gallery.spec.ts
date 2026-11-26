import { createServer, type Server } from 'node:http'
import type { Page } from '@playwright/test'
import { API_BASE, expect, test } from './fixtures'

/**
 * Gallery section: preview → "View all photos" → albums → lightbox, keyboard and swipe, the back
 * button (lightbox, then viewer, never leaving the page), a shared photo link, Arabic mirroring
 * and layout stability.
 *
 * The page is rendered on the server, so its API call cannot be mocked with page.route(): a
 * small server on the mocked API port answers the gallery page only, and drops every other
 * connection, exactly like the absent API the other tests rely on. In the browser, page.route()
 * answers the photo pages.
 */
test.describe.configure({ mode: 'serial' })

const SLUGS = ['camp', 'nomad-tent', 'mint-tea', 'hero-dunes', 'host', 'sunset-ripples', 'caravan', 'quads', 'oasis', 'farm-fields', 'ksar', 'night-sky']
const SECTION = '01938000-0000-7000-8000-0000000000aa'
const uuid = (n: number) => `01938000-0000-7000-8000-${String(n).padStart(12, '0')}`

function media(n: number) {
  const slug = SLUGS[n % SLUGS.length]!
  return {
    id: uuid(n + 1),
    kind: 'image',
    mime_type: 'image/webp',
    url: `/images/photos/${slug}-1200.webp`,
    width: 2000,
    height: 1333,
    srcset: [480, 800, 1200, 1600, 2000].map(w => ({ url: `/images/photos/${slug}-${w}.webp`, width: w })),
    blurhash: null,
    placeholder: null,
    position: '50% 50%',
    alt: `Photo ${n + 1} (${slug})`,
  }
}

const ALBUMS = [
  { id: uuid(901), title: 'Le camp', description: 'Au pied des dunes.', photos: [0, 1, 2, 3, 4, 5].map(media) },
  { id: uuid(902), title: 'Activités', description: null, photos: [6, 7, 8, 9, 10, 11].map(media) },
  { id: uuid(903), title: 'Le ciel la nuit', description: null, photos: [12, 13, 14, 15, 16, 17].map(media) },
]
const ALL = ALBUMS.flatMap(a => a.photos.map(m => ({ media: m, caption: `${a.title}, photo`, album_id: a.id })))
const PREVIEW = [ALBUMS[0]!.photos[0]!, ALBUMS[1]!.photos[0]!, ALBUMS[2]!.photos[0]!, ALBUMS[0]!.photos[1]!, ALBUMS[1]!.photos[1]!]

function renderedPage(locale: string) {
  const preview = PREVIEW.map(m => ({ media_id: m.id, album_id: ALBUMS.find(a => a.photos.includes(m))!.id }))
  return {
    page: {
      id: uuid(800), type: 'page', locale, revision: 1, title: 'Galerie', slug: 'galerie-demo', path: '/galerie-demo',
      seo: { title: 'Galerie', description: null, image: null, canonical: null, noindex: true },
      hreflang: [{ locale: 'fr', path: '/galerie-demo' }, { locale: 'ar', path: '/ar/galerie-demo' }],
    },
    sections: [{
      id: SECTION, type: 'gallery', anchor_id: 'photos', visible_on: 'all', analytics_label: 'demo_gallery', appearance: {},
      settings: { preview_layout: 'mosaic', preview_height: 'md', preview_source: 'auto', show_count: true, show_album_chips: true,
        viewer_layout: 'albums', open_lightbox_directly: false, allow_download: false, allow_share: true, autoplay_videos: false },
      content: { title: 'En images', view_all_label: 'Voir les {count} photos' },
      items: [],
      data: {
        total_count: ALL.length,
        preview,
        albums: ALBUMS.map(a => ({ id: a.id, title: a.title, description: a.description, count: a.photos.length, cover_media_id: a.photos[0]!.id, hidden_in_preview: false })),
        media: Object.fromEntries([...PREVIEW, ...ALBUMS.map(a => a.photos[0]!)].map(m => [m.id, m])),
      },
    }],
    json_ld: [],
    variables: {},
    preview: false,
  }
}

function photosPage(url: URL) {
  const album = url.searchParams.get('album')
  const limit = Number(url.searchParams.get('limit') ?? 24)
  const start = Number(url.searchParams.get('cursor') ?? 0)
  const list = album ? ALL.filter(p => p.album_id === album) : ALL
  const items = list.slice(start, start + limit)
  return {
    ...(start ? {} : { albums: ALBUMS.map(a => ({ id: a.id, title: a.title, description: a.description, count: a.photos.length, cover: a.photos[0] })) }),
    items,
    next_cursor: start + limit < list.length ? String(start + limit) : null,
    total_count: ALL.length,
  }
}

let server: Server
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', API_BASE)
    if (url.pathname === '/v1/pages/by-slug/galerie-demo') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(renderedPage(url.searchParams.get('locale') ?? 'fr')))
      return
    }
    // Anything else: as if no API were running.
    req.socket.destroy()
  })
  await new Promise<void>(resolve => server.listen(Number(new URL(API_BASE).port), '127.0.0.1', resolve))
})
test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve))
})

async function open(page: Page, path: string) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === `/v1/sections/${SECTION}/gallery`) return route.fulfill({ json: photosPage(url) })
    if (url.pathname === '/v1/pages/by-slug/galerie-demo') return route.fulfill({ json: renderedPage('fr') })
    return route.fulfill({ status: 404, json: { error: { code: 'not_found' } } })
  })
  await page.goto(path)
  await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as unknown as { __vue_app__?: unknown })?.__vue_app__)
  await page.waitForLoadState('networkidle')
}

const back = (page: Page) => page.evaluate(() => history.back())

test('view all photos, switch album, browse with the keyboard and a swipe, back twice, share a photo', async ({ page }) => {
  await open(page, '/galerie-demo')
  const preview = page.getByTestId('gallery-preview')
  await expect(preview).toBeVisible()
  await expect(preview.locator('button[aria-label^="Agrandir"]')).toHaveCount(5)

  // The preview never moves the page (fixed height, sizes from the API).
  const cls = await page.evaluate(() => new Promise<number>((resolve) => {
    let total = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number, hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) total += e.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    setTimeout(() => resolve(total), 1500)
  }))
  expect(cls).toBeLessThan(0.1)

  await page.getByTestId('gallery-view-all-desktop').click()
  const viewer = page.getByTestId('gallery-viewer')
  await expect(viewer).toBeVisible()
  await expect(page).toHaveURL(/#gallery-photos(\/album-1)?$/)
  await expect(viewer.getByRole('heading', { name: 'Le camp' })).toBeVisible()

  // Album 2
  await page.getByTestId('gallery-tab-2').click()
  await expect(page).toHaveURL(/#gallery-photos\/album-2$/)
  const second = ALBUMS[1]!.photos
  await page.getByTestId(`gallery-photo-${second[0]!.id}`).click()
  const lightbox = page.getByTestId('gallery-lightbox')
  await expect(lightbox).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#gallery-photos/album-2/photo-${second[0]!.id}$`))
  await expect(page.getByTestId('lightbox-counter')).toHaveText('1 / 6')
  await expect(page.getByTestId('lightbox-image')).toHaveAttribute('alt', second[0]!.alt)
  // The controls stay light on the black lightbox, also when the site is in light mode.
  const colours = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="gallery-lightbox"]')!
    const close = document.querySelector('[data-testid="lightbox-close"]')!
    return { box: getComputedStyle(box).color, close: getComputedStyle(close).color, radius: getComputedStyle(close).borderRadius }
  })
  expect(colours.close).toBe(colours.box)
  expect(parseFloat(colours.radius)).toBeGreaterThan(20)

  // Keyboard, then a swipe towards the start of the line.
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('lightbox-counter')).toHaveText('2 / 6')
  const stage = await page.getByTestId('lightbox-stage').boundingBox()
  const y = stage!.y + stage!.height / 2
  await page.mouse.move(stage!.x + stage!.width * 0.7, y)
  await page.mouse.down()
  await page.mouse.move(stage!.x + stage!.width * 0.45, y, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByTestId('lightbox-counter')).toHaveText('3 / 6')
  await expect(page).toHaveURL(new RegExp(`photo-${second[2]!.id}$`))

  // The arrows on the stage answer clicks; the keys still work after a click on the photo.
  await page.getByTestId('lightbox-next').click()
  await expect(page.getByTestId('lightbox-counter')).toHaveText('4 / 6')
  await page.getByTestId('lightbox-prev').click()
  await expect(page.getByTestId('lightbox-counter')).toHaveText('3 / 6')
  await page.getByTestId('lightbox-image').click()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('lightbox-counter')).toHaveText('4 / 6')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('lightbox-counter')).toHaveText('3 / 6')
  // The thumbnail strip is centred under the photo.
  const strip = (await page.getByTestId('lightbox-thumbs').boundingBox())!
  const width = page.viewportSize()!.width
  expect(Math.abs(strip.x + strip.width / 2 - width / 2)).toBeLessThan(2)

  // Back: the lightbox closes, then the viewer; the page stays.
  await back(page)
  await expect(lightbox).toBeHidden()
  await expect(viewer).toBeVisible()
  await back(page)
  await expect(viewer).toBeHidden()
  await expect(page).toHaveURL(/\/galerie-demo$/)
  await expect(preview).toBeVisible()

  // A shared link, loaded fresh, opens that photo; back still closes it, then the viewer.
  await page.goto('about:blank')
  await open(page, `/galerie-demo#gallery-photos/album-2/photo-${second[4]!.id}`)
  await expect(page.getByTestId('gallery-lightbox')).toBeVisible()
  await expect(page.getByTestId('lightbox-image')).toHaveAttribute('alt', second[4]!.alt)
  await expect(page.getByTestId('lightbox-counter')).toHaveText('5 / 6')
  await back(page)
  await expect(page.getByTestId('gallery-viewer')).toBeVisible()
  await back(page)
  await expect(page.getByTestId('gallery-viewer')).toBeHidden()
  await expect(page).toHaveURL(/\/galerie-demo$/)
})

test('in Arabic the large photo is on the right and the arrows follow the reading direction', async ({ page }) => {
  await open(page, '/ar/galerie-demo')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const preview = page.getByTestId('gallery-preview')
  const box = (await preview.boundingBox())!
  const large = (await preview.locator('button.col-span-2').boundingBox())!
  expect(large.x + large.width / 2).toBeGreaterThan(box.x + box.width / 2)

  await preview.locator('button.col-span-2').click()
  await page.getByTestId(`gallery-photo-${ALBUMS[0]!.photos[0]!.id}`).click()
  await expect(page.getByTestId('lightbox-counter')).toHaveText('1 / 6')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('lightbox-counter')).toHaveText('2 / 6')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('lightbox-counter')).toHaveText('1 / 6')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('gallery-lightbox')).toBeHidden()
})
