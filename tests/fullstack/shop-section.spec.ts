import { tr } from '../i18n'
import { expect, test } from './fixtures'
import { ready } from './helpers'

/**
 * "Produits de la boutique" end to end against the real API: added to the home page in the
 * builder with the "Dattes" category and published; in catalog-only mode the cards have no buying
 * button; once the shop is open, a card leads to its product page (registry address), the
 * single-variant product goes in the cart (the drawer opens with the line), the multi-variant one
 * offers "Choisir les options"; once in Arabic. Needs the demo data (`seed_dev`) and a staff
 * account with content.publish and shop.settings.
 *
 * Starts in catalog-only mode (declared below) whatever ran before; the `shop` fixture opens the
 * shop mid-test and puts the mode and the compliance data back afterwards.
 */
test.use({ shopMode: 'catalog_only' })

test('a shop section added in the builder sells from the home page', async ({ page, shop }) => {
  test.setTimeout(180_000)
  const title = `Nos dattes ${Date.now().toString(36)}`

  // ---- Builder: add the section, pick "Dattes", publish ------------------------------------
  await page.goto('/admin/pages')
  await ready(page)
  await page.getByTestId('open-builder-home').click()
  await expect(page.getByTestId('section-list')).toBeVisible()
  await page.getByTestId('add-section').click()
  await expect(page.getByTestId('add-type-shop_products')).toContainText('Produits de la boutique')
  await expect(page.getByTestId('add-type-product_carousel')).toContainText('Hébergements et activités')
  await page.getByTestId('add-type-shop_products').click()
  const form = page.getByTestId('section-form-shop_products')
  await expect(form).toBeVisible()
  await form.locator('[data-field="title"] input').fill(title)
  await form.getByRole('tab', { name: 'Source' }).click()
  await form.getByTestId('picker-category').click()
  await page.getByRole('option', { name: 'Dattes shop', exact: true }).click()
  await page.keyboard.press('Escape')
  // The preset shows featured products only: show the whole category.
  await form.locator('[data-field="featured_only"]').getByRole('switch').click()
  await expect(page.getByTestId('save-status')).toHaveText(/Brouillon enregistré/, { timeout: 15_000 })
  await page.getByTestId('publish-open').click()
  await page.getByTestId('publish-confirm').click()
  await expect(page.getByText(/Révision \d+ publiée/).first()).toBeVisible()

  // ---- Catalog only: prices, no buying ----------------------------------------------------
  const section = page.locator('section[data-section-type="shop_products"]').filter({ has: page.getByRole('heading', { name: title }) })
  await page.goto('/')
  await ready(page)
  await expect(section.getByTestId('shop-card')).toHaveCount(2)
  await expect(section.getByTestId('shop-card-add')).toHaveCount(0)
  await expect(section.getByTestId('shop-card-soon').first()).toBeVisible()
  await expect(section.getByTestId('shop-card-price').first()).toBeVisible()

  // ---- Open shop: link, add to cart, options -------------------------------------------------
  await shop.mode('open')
  await expect.poll(async () => {
    await page.goto('/')
    return section.getByTestId('shop-card-add').count()
  }, { timeout: 30_000 }).toBe(1)
  const single = section.getByTestId('shop-card').filter({ has: page.getByTestId('shop-card-add') })
  const multi = section.getByTestId('shop-card').filter({ has: page.getByTestId('shop-card-options') })
  const href = await single.getByTestId('shop-card-link').getAttribute('href')
  expect(href).toMatch(/^\/boutique\/p\//)
  await single.getByTestId('shop-card-link').click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goBack()
  await ready(page)
  const name = (await single.locator('h3').textContent())!.trim()
  await single.getByTestId('shop-card-add').click()
  const drawer = page.getByRole('dialog', { name: tr('fr', 'shop.cart.title') })
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText(name)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(single.getByTestId('shop-card-add')).toBeFocused()
  const optionsHref = await multi.getByTestId('shop-card-options').getAttribute('href')
  await multi.getByTestId('shop-card-options').click()
  await expect(page).toHaveURL(new RegExp(`${optionsHref}$`))

  // ---- Arabic ----------------------------------------------------------------------------------
  await page.goto('/ar')
  await ready(page)
  const arCards = page.locator('section[data-section-type="shop_products"]').getByTestId('shop-card-link')
  await expect(arCards.first()).toBeVisible()
  for (const a of await arCards.all()) expect(await a.getAttribute('href')).toMatch(/^\/ar\/boutique\/p\//)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  // The cart drawer opens at the end of the reading direction (the left in Arabic), named in
  // Arabic; Escape closes it and focus goes back to the card's button.
  const arAdd = page.locator('section[data-section-type="shop_products"]').getByTestId('shop-card-add').first()
  await arAdd.click()
  const arDrawer = page.getByRole('dialog', { name: tr('ar', 'shop.cart.title') })
  await expect(arDrawer).toBeVisible()
  await expect(arDrawer).toHaveAttribute('data-side', 'left')
  await page.keyboard.press('Escape')
  await expect(arDrawer).toBeHidden()
  await expect(arAdd).toBeFocused()
})
