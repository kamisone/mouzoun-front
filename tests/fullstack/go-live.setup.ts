import { existsSync, readFileSync } from 'node:fs'
import { tr } from '../i18n'
import { API, ORIGIN, expect, test as setup } from './fixtures'
import { ready } from './helpers'
import { STAFF_STATE, staffSignIn } from './staff'

/**
 * Before every other project: staff open online booking from the back office, through the
 * go-live checklist (it must be all green on the development data), and the session is kept
 * for the staff tests. A session kept from an earlier run is reused while the API still accepts
 * it: runs started one after the other (the order check) would otherwise hit the sign-in rate
 * limit ("Trop de tentatives").
 */
setup('staff open online booking once the go-live checklist passes', async ({ page }) => {
  let signedIn = false
  if (existsSync(STAFF_STATE)) {
    await page.context().addCookies(JSON.parse(readFileSync(STAFF_STATE, 'utf8')).cookies)
    const me = await page.request.get(`${API}/v1/auth/me`, { headers: { Origin: ORIGIN } })
    signedIn = me.ok() && (await me.json()).email === process.env.E2E_STAFF_EMAIL
  }
  if (!signedIn) await staffSignIn(page, ready)
  await page.goto('/admin/go-live')
  await ready(page)
  const status = page.getByTestId('go-live-status')
  await expect(status).toBeVisible()
  if (!(await status.textContent())?.includes('Ouverte au public')) {
    await expect(page.getByTestId('go-live-open'), 'the go-live checklist must pass on the development data').toBeEnabled()
    await page.getByTestId('go-live-open').click()
    await page.getByRole('dialog', { name: tr('fr', 'admin.goLive.confirmTitle') }).getByRole('button', { name: tr('fr', 'admin.goLive.open') }).click()
  }
  await expect(status).toContainText('Ouverte au public')
  await page.context().storageState({ path: STAFF_STATE })
})
