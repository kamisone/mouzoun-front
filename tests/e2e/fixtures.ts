import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export const API_BASE = 'http://127.0.0.1:3299'

export const STAFF = {
  id: '01930000-0000-7000-8000-000000000001',
  email: 'ops@mouzoun.test',
  full_name: 'Hassan Ait Ouarab',
  is_staff: true,
  roles: ['super_admin'],
  permissions: [],
  created_at: '2026-11-01T00:00:00Z',
}

/** Mocks the API: a signed-in staff user, or no session. */
export async function mockApi(page: Page, signedIn: boolean) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/v1/auth/me') {
      return signedIn
        ? route.fulfill({ json: STAFF })
        : route.fulfill({ status: 401, json: { error: { code: 'unauthorized' } } })
    }
    return route.fulfill({ status: 404, json: { error: { code: 'not_found' } } })
  })
}

/** Serious and critical accessibility violations (WCAG 2.2 A/AA rules). */
export async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  return results.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)
}
