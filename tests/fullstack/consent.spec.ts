import type { Page } from '@playwright/test'
import { CONSENT_AT_KEY, CONSENT_KEY } from '../../app/utils/consent'
import { type TestLocale, tr } from '../i18n'
import { expect, test } from './fixtures'
import { ready } from './helpers'

/**
 * The cookie banner against the real site, starting with no choice stored (`consent: null`,
 * every other spec starts with it given): it shows on the first visit in French and in Arabic,
 * announced as a region named by its title (not a dialog: it blocks nothing); nothing optional
 * is stored or loaded before a choice; "Tout refuser" is as easy as "Tout accepter"; each
 * choice is stored as the app reads it, hides the banner and survives a reload; the footer
 * brings it back to change the choice; it is reached and used with the keyboard; on a phone it
 * does not cover the booking bar.
 */
test.use({ consent: null })

const LOCALES: [TestLocale, string][] = [['fr', '/'], ['ar', '/ar']]
const banner = (page: Page, l: TestLocale) => page.getByRole('region', { name: tr(l, 'consent.title') })
const stored = (page: Page) => page.evaluate(([k, at]) => ({ choice: localStorage.getItem(k!), at: localStorage.getItem(at!) }), [CONSENT_KEY, CONSENT_AT_KEY])
/**
 * What measurement may have queued, scripts loaded from another host, and requests to audience
 * or advertising services. (Icons are fetched from the Iconify API: no script, no cookie.)
 */
const TRACKERS = /google-analytics|googletagmanager|doubleclick|facebook|hotjar|clarity\.ms|matomo|plausible|segment/
const optional = (page: Page) => page.evaluate((trackers) => {
  const own = new Set([location.host, '127.0.0.1:18090'])
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  const scripts = [...document.scripts].map(s => s.src).filter(Boolean).map(src => new URL(src).host).filter(h => !own.has(h))
  const loaded = resources.filter(r => r.initiatorType === 'script').map(r => new URL(r.name).host).filter(h => !own.has(h))
  const tracking = resources.map(r => new URL(r.name).host).filter(h => new RegExp(trackers).test(h))
  return { dataLayer: (window as unknown as { dataLayer?: unknown[] }).dataLayer?.length ?? 0, foreignScripts: [...new Set([...scripts, ...loaded])], tracking }
}, TRACKERS.source)

for (const [l, home] of LOCALES) {
  test(`${l}: shows on the first visit as a named region, with nothing optional before a choice`, async ({ page, context }) => {
    await page.goto(home)
    await ready(page)
    const region = banner(page, l)
    await expect(region).toBeVisible()
    await expect(region).toHaveAttribute('aria-describedby', 'cookie-text')
    // It blocks nothing: not announced as a dialog, no focus moved into it.
    await expect(page.getByRole('dialog', { name: tr(l, 'consent.title') })).toHaveCount(0)
    expect(await region.evaluate(el => el.contains(document.activeElement))).toBe(false)
    expect(await stored(page)).toEqual({ choice: null, at: null })
    expect(await optional(page)).toEqual({ dataLayer: 0, foreignScripts: [], tracking: [] })
    expect((await context.cookies()).map(c => c.name).filter(n => /^_ga|^_gid|^_gcl|^_fbp|analytic/i.test(n))).toEqual([])
    // Refusing is as easy as accepting: same size, same style, side by side.
    const reject = region.getByRole('button', { name: tr(l, 'consent.reject') })
    const accept = region.getByRole('button', { name: tr(l, 'consent.accept') })
    const [r, a] = [await reject.boundingBox(), await accept.boundingBox()]
    expect(Math.round(r!.width)).toBe(Math.round(a!.width))
    expect(Math.round(r!.height)).toBe(Math.round(a!.height))
    expect(await reject.getAttribute('class')).toBe(await accept.getAttribute('class'))
  })
}

test('accepting stores the choice, hides the banner and survives a reload', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  const before = Date.now()
  await banner(page, 'fr').getByRole('button', { name: tr('fr', 'consent.accept') }).click()
  await expect(banner(page, 'fr')).toBeHidden()
  const s = await stored(page)
  expect(s.choice).toBe('granted')
  expect(Date.parse(s.at!)).toBeGreaterThanOrEqual(before - 1000)
  await page.reload()
  await ready(page)
  await expect(banner(page, 'fr')).toBeHidden()
})

test('refusing stores the choice, measures nothing and survives a reload; the footer brings it back', async ({ page }) => {
  await page.goto('/ar')
  await ready(page)
  await banner(page, 'ar').getByRole('button', { name: tr('ar', 'consent.reject') }).click()
  await expect(banner(page, 'ar')).toBeHidden()
  expect((await stored(page)).choice).toBe('denied')
  await page.goto('/ar/stays')
  await ready(page)
  await expect(banner(page, 'ar')).toBeHidden()
  expect(await optional(page)).toEqual({ dataLayer: 0, foreignScripts: [], tracking: [] })
  // Changing one's mind: the footer link reopens it, and the new choice replaces the old one.
  await page.getByTestId('footer-cookies').click()
  await expect(banner(page, 'ar')).toBeVisible()
  await banner(page, 'ar').getByRole('button', { name: tr('ar', 'consent.accept') }).click()
  expect((await stored(page)).choice).toBe('granted')
})

test('is reached early and operated with the keyboard', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  const region = banner(page, 'fr')
  await expect(region).toBeVisible()
  // Skip link first, then the banner (policy link, refuse, accept), before the header.
  const reject = region.getByRole('button', { name: tr('fr', 'consent.reject') })
  let presses = 0
  while (!(await reject.evaluate(el => el === document.activeElement)) && presses < 6) {
    await page.keyboard.press('Tab')
    presses++
  }
  await expect(reject).toBeFocused()
  expect(presses).toBeLessThanOrEqual(3)
  await page.keyboard.press('Enter')
  await expect(region).toBeHidden()
  expect((await stored(page)).choice).toBe('denied')
})

test('on a phone, it does not cover the booking bar', async ({ browser, baseURL }) => {
  // Its own phone-sized context, with no choice stored either.
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  for (const path of ['/stays/emplacement-tente', '/ar/stays/emplacement-tente']) {
    await page.goto(path)
    await ready(page)
    const region = page.getByRole('region', { name: tr(path.startsWith('/ar') ? 'ar' : 'fr', 'consent.title') })
    const action = page.getByTestId('widget-open')
    await expect(region).toBeVisible()
    await expect(action).toBeVisible()
    const [b, a] = [(await region.boundingBox())!, (await action.boundingBox())!]
    expect(b.y + b.height, 'the banner ends above the booking bar').toBeLessThanOrEqual(a.y)
  }
  await context.close()
})
