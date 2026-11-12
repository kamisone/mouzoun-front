import { defineConfig, devices } from '@playwright/test'

/**
 * Full-stack tests: the built front (`npm run build`) against a REAL API (Postgres, Redis) with
 * the simulated payment provider and emails delivered to Mailpit. The setup project opens online
 * booking from the back office (go-live checklist), then guests run in French on desktop and in
 * Arabic on a phone, and staff in the back office.
 *
 *   API: PAYMENTS_FAKE=true EMAIL_PROVIDER=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_TLS=none
 *        APP_PORT=18090 CORS_ORIGINS=http://127.0.0.1:3210 COOKIE_SECURE=false
 *        PUBLIC_SITE_URL=http://127.0.0.1:3210 ./target/debug/mouzoun-api
 *   Staff: cargo run --bin seed_dev -- staff e2e-staff@mouzoun.test <password> manager
 *
 *   E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… npx playwright test -c playwright.fullstack.config.ts
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
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /go-live\.setup\.ts/, use: desktop },
    { name: 'fr-desktop', testMatch: /guest\.spec\.ts/, dependencies: ['setup'], use: desktop },
    { name: 'ar-mobile', testMatch: /guest\.spec\.ts/, dependencies: ['setup'], use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'staff', testMatch: /staff\.spec\.ts/, dependencies: ['setup'], use: { ...desktop, storageState: staffState } },
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
    },
  },
})
