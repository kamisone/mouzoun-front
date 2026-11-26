import type { Browser, BrowserContext } from '@playwright/test'
import { withConsent } from '../consent'
import { tr } from '../i18n'
import { expect, test } from './fixtures'
import { mailMatching, ready } from './helpers'

/**
 * Two visitors never see each other's cart or account. Each one, in its own browser, signs up
 * and puts a different Medjool variant in the shop cart. Then the cart, trip, checkout and
 * account pages are opened by one visitor and then the other, alternately, both in the browser
 * and as the server's HTML. Each sees only their own email and line, never the other's.
 * Personal routes are `cache: false` in nuxt.config.ts: a page cached for one visitor must never
 * reach the next. The shop is opened for the test and closed again after (`shop` fixture).
 */
test.use({ shopMode: 'catalog_only' })

interface Visitor { name: string, email: string, sku: string, variant: string, context: BrowserContext }

async function visitor(browser: Browser, baseURL: string, name: string, variant: string, sku: string): Promise<Visitor> {
  // A fresh browser, without the staff session of the project; cookie choice made.
  const context = await browser.newContext({ baseURL, storageState: withConsent(undefined, 'granted', baseURL) })
  return { name, email: `privacy-${name}-${Date.now().toString(36)}@example.com`, sku, variant, context }
}

async function signUp(v: Visitor) {
  const page = await v.context.newPage()
  await page.goto('/account/signin')
  await ready(page)
  await page.getByTestId('signin-email').fill(v.email)
  await page.getByTestId('signin-continue').click()
  const [code] = await mailMatching(v.email, /\b\d{6}\b/)
  await page.getByTestId('code-0').click()
  await page.keyboard.type(code)
  const panel = page.getByTestId('signin-panel')
  await panel.locator('input[autocomplete="given-name"]').fill(v.name)
  await panel.locator('input[autocomplete="family-name"]').fill('Test')
  await page.getByTestId('signin-finish').click()
  await expect(page).toHaveURL(/\/account/)
  await page.close()
}

async function addToCart(v: Visitor) {
  const page = await v.context.newPage()
  await page.goto('/boutique/p/dattes-medjool')
  await ready(page)
  await page.getByRole('radio', { name: v.variant }).click()
  await page.getByTestId('add-to-cart').click()
  const drawer = page.getByRole('dialog', { name: tr('fr', 'shop.cart.title') })
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await page.close()
}

test('two visitors never see each other\'s cart or account', async ({ browser, baseURL, shop }) => {
  test.setTimeout(180_000)
  await shop.mode('open')
  const a = await visitor(browser, baseURL!, 'amina', '500 g', 'MEDJOOL-500G')
  const b = await visitor(browser, baseURL!, 'brahim', '1 kg', 'MEDJOOL-1KG')
  for (const v of [a, b]) {
    await signUp(v)
    await addToCart(v)
  }

  // Alternately, twice, so that any page kept for one visitor would be served to the other.
  for (const [me, other] of [[a, b], [b, a], [a, b], [b, a]] as const) {
    const page = await me.context.newPage()
    await page.goto('/boutique/cart')
    await ready(page)
    await expect(page.locator(`[data-testid^="cart-line-${me.sku}"]`)).toHaveCount(1)
    await expect(page.locator(`[data-testid^="cart-line-${other.sku}"]`)).toHaveCount(0)

    await page.goto('/account/profile')
    await ready(page)
    // Shown in the account menu (and in the profile form below it).
    await expect(page.getByRole('navigation', { name: tr('fr', 'account.nav.label') }).getByText(me.email, { exact: true })).toBeVisible()
    await expect(page.getByText(other.email)).toHaveCount(0)
    await page.close()

    // The server's HTML of every personal page, with this visitor's cookies.
    for (const path of ['/boutique/cart', '/boutique/checkout', '/trip', '/checkout', '/account', '/account/profile', '/en/shop/cart']) {
      const res = await me.context.request.get(path)
      // Never kept by the server's page cache (it adds an ETag) nor by a shared cache.
      expect(res.headers()['cache-control'], `${path} cache-control`).toContain('no-store')
      expect(res.headers().etag, `${path} served from the page cache`).toBeUndefined()
      const html = await res.text()
      expect(html, `${path} for ${me.name}`).not.toContain(other.email)
      expect(html, `${path} for ${me.name}`).not.toContain(other.sku)
      expect(html, `${path} for ${me.name}`).not.toContain(other.name)
    }
  }
  await a.context.close()
  await b.context.close()
})
