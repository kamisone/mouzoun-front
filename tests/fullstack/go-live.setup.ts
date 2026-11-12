import { expect, test as setup } from '@playwright/test'
import { ready } from './helpers'
import { STAFF_STATE, staffSignIn } from './staff'

/**
 * Before every other project: staff open online booking from the back office, through the
 * go-live checklist (it must be all green on the development data), and the session is kept
 * for the staff tests.
 */
setup('staff open online booking once the go-live checklist passes', async ({ page }) => {
  await staffSignIn(page, ready)
  await page.goto('/admin/go-live')
  await ready(page)
  const status = page.getByTestId('go-live-status')
  await expect(status).toBeVisible()
  if (!(await status.textContent())?.includes('Ouverte au public')) {
    await expect(page.getByTestId('go-live-open'), 'the go-live checklist must pass on the development data').toBeEnabled()
    await page.getByTestId('go-live-open').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ouvrir les réservations' }).click()
  }
  await expect(status).toContainText('Ouverte au public')
  await page.context().storageState({ path: STAFF_STATE })
})
