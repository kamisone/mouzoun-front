import { defineConfig, devices } from '@playwright/test'

/**
 * Full-stack tests: the built front (`npm run build`) against a REAL API (Postgres, Redis) with
 * the simulated payment provider and emails delivered to Mailpit. The setup project opens online
 * booking from the back office (go-live checklist), then guests run in French on desktop and in
 * Arabic on a phone, and staff in the back office.
 *
 *   Stack: tests/fullstack/scripts/stack.sh prepare (throwaway database, seed, staff account),
 *          then tests/fullstack/scripts/stack.sh api (API on :18090 with PAYMENTS_FAKE, Mailpit
 *          and the .env SMTP credentials blanked: Mailpit refuses SMTP authentication).
 *
 *   E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… npx playwright test -c playwright.fullstack.config.ts
 *
 * See tests/README.md (fixtures, named dialogs, global state, order check).
 *
 * Stripe TEST mode: give the API test keys (STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY /
 * STRIPE_WEBHOOK_SECRET from `stripe listen --forward-to http://127.0.0.1:18090/v1/payments/webhooks/stripe`)
 * and add STRIPE_E2E=1: the `stripe` project then runs too.
 */
const PORT = Number(process.env.FULLSTACK_PORT ?? 3210)
const API = process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090'

const missing = ['E2E_STAFF_EMAIL', 'E2E_STAFF_PASSWORD'].filter(name => !process.env[name])
if (missing.length) throw new Error(`playwright.fullstack.config.ts: set ${missing.join(', ')} (see the header)`)

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }
const staffState = 'playwright/.auth/staff-state.json'

export default defineConfig({
  testDir: 'tests/fullstack',
  // One database for the whole suite: specs that publish the same builder page or change shop
  // settings would race in parallel workers. `shop-state` is serial on its own as well.
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /go-live\.setup\.ts/, use: desktop },
    { name: 'fr-desktop', testMatch: /guest\.spec\.ts/, dependencies: ['setup'], use: desktop },
    { name: 'ar-mobile', testMatch: /guest\.spec\.ts/, dependencies: ['setup'], use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'staff', testMatch: /staff\.spec\.ts/, dependencies: ['setup'], use: { ...desktop, storageState: staffState } },
    // Specs that change the shop's global state (mode, legal entity, compliance data): one at a
    // time, in file order, whatever `--workers` says. Each declares the mode it starts from and
    // the `shop` fixture restores what it changed (tests/fullstack/fixtures.ts, README.md).
    // Farm shop, page-builder shop section, Admin › Settings › Legal entity, two visitors'
    // carts and accounts kept apart (shop.*, content.publish, settings.write).
    {
      name: 'shop-state',
      testMatch: [/\/shop\.spec\.ts/, /\/shop-section\.spec\.ts/, /\/legal-entity\.spec\.ts/, /\/privacy\.spec\.ts/],
      dependencies: ['setup'],
      workers: 1,
      fullyParallel: false,
      use: { ...desktop, storageState: staffState },
    },
    // The cookie banner, starting with no choice stored (every other spec starts with it given).
    { name: 'consent', testMatch: /\/consent\.spec\.ts/, dependencies: ['setup'], use: desktop },
    // Shop categories: admin tree, form, delete; public pages (shop.catalog + content.write).
    { name: 'categories', testMatch: /\/categories\.spec\.ts/, dependencies: ['setup'], use: { ...desktop, storageState: staffState } },
    // Stay and activity categories: catalog admin, editor and builder pickers (products.write + content.publish).
    { name: 'catalog-categories', testMatch: /catalog-categories\.spec\.ts/, dependencies: ['setup'], use: { ...desktop, storageState: staffState } },
    // SEO: redirects, 404 log, sitemap, robots (seo.manage + shop.catalog).
    { name: 'seo', testMatch: /seo\.spec\.ts/, dependencies: ['setup'], use: { ...desktop, storageState: staffState } },
    // Catalogue editors (products, pricing and inventory write: manager or super_admin).
    { name: 'catalog', testMatch: /catalog\.spec\.ts/, dependencies: ['setup'], use: { ...desktop, storageState: staffState } },
    // Page builder: the staff account needs content.publish (manager or super_admin).
    { name: 'builder', testMatch: /builder\.spec\.ts/, dependencies: ['setup'], use: { ...desktop, viewport: { width: 1600, height: 1000 }, storageState: staffState } },
    ...(process.env.STRIPE_E2E === '1'
      ? [{ name: 'stripe', testMatch: /stripe\.spec\.ts/, dependencies: ['setup'], use: desktop }]
      : []),
  ],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NUXT_PUBLIC_API_BASE: API,
      NUXT_API_INTERNAL_BASE: API,
      // Absolute redirect locations and canonical links on this test origin; robots.txt as in production.
      NUXT_PUBLIC_I18N_BASE_URL: `http://127.0.0.1:${PORT}`,
      NUXT_SITE_ENV: 'production',
    },
  },
})
