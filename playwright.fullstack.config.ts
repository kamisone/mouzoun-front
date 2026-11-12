import { defineConfig, devices } from '@playwright/test'

/**
 * Full-stack booking tests: the built front against a REAL API (Postgres, Redis) running with
 * PAYMENTS_FAKE=true and booking.enabled = true. Not part of `npm run test:e2e` (mocked API).
 *
 *   FULLSTACK_API=http://127.0.0.1:18090 E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… \
 *     npx playwright test -c playwright.fullstack.config.ts
 *
 * Stripe with real test cards (3-D Secure): set STRIPE_E2E=1 with the API configured with Stripe
 * test keys (see back/docs/booking/README.md); otherwise that test is skipped.
 */
const PORT = Number(process.env.FULLSTACK_PORT ?? 3210)
export default defineConfig({
  testDir: 'tests/fullstack',
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'fr-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'ar-mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NUXT_PUBLIC_API_BASE: process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090',
      NUXT_API_INTERNAL_BASE: process.env.FULLSTACK_API ?? 'http://127.0.0.1:18090',
    },
  },
})
