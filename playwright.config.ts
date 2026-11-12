import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests against the production build (`npm run build` first, or let CI do it).
 * The API is mocked per test with page.route(): no back-end needed.
 */
const PORT = 3200
export const API_BASE = 'http://127.0.0.1:3299'
// Review screenshots are a capture tool, not tests: only collected when SCREENSHOTS=<dir> is set.
const SCREENSHOTS = /screenshots\.spec\.ts/
const desktopIgnore = process.env.SCREENSHOTS ? [/responsive\.spec\.ts/] : [/responsive\.spec\.ts/, SCREENSHOTS]

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }, testIgnore: desktopIgnore },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } }, testMatch: /responsive\.spec\.ts/ },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NUXT_PUBLIC_API_BASE: API_BASE,
      // Server-side rendering too: never a real API that happens to run on this machine.
      NUXT_API_INTERNAL_BASE: API_BASE,
      NUXT_PUBLIC_STYLEGUIDE: 'true',
    },
  },
})
