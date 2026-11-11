import { mkdirSync } from 'node:fs'
import { test } from '@playwright/test'
import { mockApi } from './fixtures'

/**
 * Review screenshots (not a test): SCREENSHOTS=docs/screenshots/after npm run test:e2e -- screenshots
 * Home and style guide × desktop 1440 / mobile 390 × light / dark × fr / ar.
 */
const out = process.env.SCREENSHOTS
test.skip(!out, 'set SCREENSHOTS=<dir> to capture review screenshots')

const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }
const pages = { home: { fr: '/', ar: '/ar' }, styleguide: { fr: '/_styleguide', ar: '/ar/_styleguide' } }

for (const [pageName, paths] of Object.entries(pages)) {
  for (const [vpName, viewport] of Object.entries(viewports)) {
    for (const theme of ['light', 'dark'] as const) {
      for (const locale of ['fr', 'ar'] as const) {
        test(`${pageName}-${vpName}-${theme}-${locale}`, async ({ page }) => {
          test.setTimeout(120_000)
          mkdirSync(out!, { recursive: true })
          await mockApi(page, true)
          await page.setViewportSize(viewport)
          await page.addInitScript((mode) => {
            localStorage.setItem('mz-color-mode', mode)
            localStorage.setItem('mz-color-mode-explicit', '1')
          }, theme)
          await page.emulateMedia({ reducedMotion: 'reduce' }) // reveal animations settled
          await page.goto(paths[locale])
          await page.waitForLoadState('networkidle')
          // Lazy images: scroll through the page once so everything is loaded.
          await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 600) {
              window.scrollTo(0, y)
              await new Promise(r => setTimeout(r, 60))
            }
            window.scrollTo(0, 0)
          })
          await page.waitForLoadState('networkidle')
          await page.screenshot({ path: `${out}/${pageName}-${vpName}-${theme}-${locale}.png`, fullPage: true })
        })
      }
    }
  }
}
