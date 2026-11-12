import { expect, test, type Page, type Route } from '@playwright/test'
import { API_BASE, STAFF, seriousViolations } from './fixtures'

/**
 * Guest accounts against a mocked API: sign in by code (wrong code, then pasted), RTL, the
 * account pages, protected pages, and the staff second factor. Runs on desktop and a phone.
 */

const ACCOUNT = {
  id: '01930000-0000-7000-8000-0000000000a1',
  email: 'amina@example.com',
  email_verified: true,
  first_name: 'Amina',
  last_name: 'Benali',
  phone: null,
  country_code: 'MA',
  preferred_locale: 'fr',
  date_of_birth: null,
  display_currency: 'EUR',
  marketing_consent: false,
  has_password: false,
  identities: [],
  created_at: '2026-11-01T00:00:00Z',
  next_trip: { reference: 'MZ-26-000123', arrival: '2026-12-20', departure: '2026-12-22', status: 'confirmed', days: 38 },
}

const TRIP = {
  reference: 'MZ-26-000123',
  status: 'confirmed',
  arrival: '2026-12-20',
  departure: '2026-12-22',
  days_until: 38,
  products: 'Tente berbère',
  product_id: '01930000-0000-7000-8000-0000000000b1',
  cover_url: null,
  total_minor: 36000,
  paid_minor: 10800,
  balance_minor: 25200,
  balance_due_on: '2026-12-13',
  precheckin_completed: false,
  currency: 'EUR',
  party: { adults: 2, children: 0, infants: 0 },
}

interface Options { signedIn?: boolean, staffMfa?: boolean }

async function mock(page: Page, opts: Options = {}) {
  let signedIn = opts.signedIn ?? false
  let attempts = 5
  if (signedIn) await page.addInitScript(() => localStorage.setItem('mz-signed-in', '1'))
  await page.route(`${API_BASE}/**`, async (route: Route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body })
    switch (`${req.method()} ${path}`) {
      case 'GET /v1/account/me':
        return signedIn ? json(ACCOUNT) : json({ error: { code: 'unauthorized' } }, 401)
      case 'GET /v1/account/oauth/providers':
        return json({ google: true, apple: false })
      case 'POST /v1/account/auth/identify':
        return json({ sent: true, masked_email: 'a***@example.com', code_minutes: 10, resend_after_seconds: 30 }, 202)
      case 'POST /v1/account/auth/code': {
        const body = req.postDataJSON() as { code: string }
        if (body.code !== '246810') {
          attempts -= 1
          return json({ error: { code: 'invalid_code', message: 'invalid', details: { attempts_left: attempts } } }, 422)
        }
        signedIn = true
        return json({ account: ACCOUNT, created: false, needs_profile: false })
      }
      case 'GET /v1/account/trips':
        return json({ tab: 'upcoming', page: 1, total: 1, trips: [TRIP] })
      case 'GET /v1/account/sessions':
        return json({ sessions: [{ id: 's1', user_agent: 'Mozilla/5.0 (Macintosh; Mac OS X) Chrome/140', ip_address: '196.200.1.0/24', created_at: '2026-11-10T08:00:00Z', last_used_at: '2026-11-12T08:00:00Z', persistent: true, current: true }] })
      case 'GET /v1/account/passkeys':
        return json({ passkeys: [] })
      case 'GET /v1/account/privacy/deletion':
        return json({ scheduled_for: null, blockers: ['upcoming_stay'], grace_days: 14 })
      case 'GET /v1/account/saved':
        return json({ product_ids: [] })
      case 'POST /v1/account/saved':
        return json({ product_ids: [] })
      case 'GET /v1/auth/me':
        return opts.staffMfa && signedIn ? json(STAFF) : json({ error: { code: 'unauthorized' } }, 401)
      case 'POST /v1/auth/login':
        return json({ mfa_required: true, mfa_token: 'tok' })
      case 'POST /v1/auth/mfa': {
        const body = req.postDataJSON() as { code: string }
        if (body.code !== '135790') return json({ error: { code: 'invalid_code', message: 'invalid' } }, 422)
        signedIn = true
        return json({ user: STAFF, expires_in: 3600 })
      }
      case 'GET /v1/admin/dashboard/today':
        return json({ arrivals: [], departures: [], in_house: 0, occupancy: [], pending_requests: [], tasks: [], activities: [] })
      default:
        return json({ error: { code: 'not_found' } }, 404)
    }
  })
}

async function typeCode(page: Page, code: string) {
  await page.getByTestId('code-0').click()
  await page.keyboard.type(code)
}

for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 360, height: 780 }]) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('signs in with an emailed code: a wrong code is explained, the right one is pasted', async ({ page }) => {
      await mock(page)
      await page.goto('/account/signin')
      await expect(page.getByRole('heading', { level: 1, name: 'Se connecter ou créer un compte' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Continuer avec Google' })).toBeVisible()
      await page.getByTestId('signin-email').fill('amina@example.com')
      await page.getByTestId('signin-continue').click()

      await expect(page.getByText('Nous avons envoyé un code à a***@example.com')).toBeVisible()
      await expect(page.getByTestId('code-0')).toHaveAttribute('autocomplete', 'one-time-code')
      await expect(page.getByTestId('code-0')).toBeFocused()
      await typeCode(page, '111111')
      await expect(page.getByRole('alert')).toContainText('Il reste 4 essais')
      await expect(page.getByTestId('code-0')).toHaveAttribute('aria-invalid', 'true')

      // Paste the whole code into the first box.
      await page.getByTestId('code-0').focus()
      await page.evaluate(() => {
        const data = new DataTransfer()
        data.setData('text/plain', '246 810')
        document.querySelector('[data-testid="code-0"]')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
      })
      await expect(page).toHaveURL(/\/account$/)
      await expect(page.getByRole('heading', { level: 1, name: 'Bonjour Amina' })).toBeVisible()
      await expect(page.getByText('Prochain voyage')).toBeVisible()
    })

    test('account pages need a session and come back after signing in', async ({ page }) => {
      await mock(page)
      await page.goto('/account/trips')
      await expect(page).toHaveURL(/\/account\/signin\?return_to=(%2F|\/)account(%2F|\/)trips/)
    })

    test('my trips and login & security have no serious accessibility violations', async ({ page }) => {
      await mock(page, { signedIn: true })
      await page.goto('/account/trips')
      await expect(page.getByRole('heading', { level: 2, name: 'Tente berbère' })).toBeVisible()
      await expect(page.getByText('Solde à régler')).toBeVisible()
      expect(await seriousViolations(page)).toEqual([])
      await page.goto('/account/security')
      await expect(page.getByText('Cet appareil')).toBeVisible()
      expect(await seriousViolations(page)).toEqual([])
      await page.goto('/account/privacy')
      await expect(page.getByText('un séjour est à venir')).toBeVisible()
      expect(await seriousViolations(page)).toEqual([])
    })
  })
}

test.describe('Arabic, phone', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('sign-in is right-to-left with the code boxes left-to-right, and accessible', async ({ page }) => {
    await mock(page)
    await page.goto('/ar/account/signin')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { level: 1, name: 'سجّل الدخول أو أنشئ حسابًا' })).toBeVisible()
    expect(await seriousViolations(page)).toEqual([])
    await page.getByTestId('signin-email').fill('amina@example.com')
    await page.getByTestId('signin-continue').click()
    await expect(page.getByTestId('code-0')).toBeFocused()
    await expect(page.locator('fieldset [dir="ltr"]')).toHaveCount(1)
    expect(await seriousViolations(page)).toEqual([])
    await typeCode(page, '246810')
    await expect(page).toHaveURL(/\/ar\/account$/)
  })
})

test('staff sign in with a password and then a code from their authenticator app', async ({ page }) => {
  await mock(page, { staffMfa: true })
  await page.goto('/admin/login')
  await page.getByLabel('E-mail').fill(STAFF.email)
  await page.getByLabel('Mot de passe').fill('a long staff password')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Vérification en deux étapes' })).toBeVisible()
  await typeCode(page, '000000')
  await expect(page.getByRole('alert')).toContainText('Code incorrect')
  await typeCode(page, '135790')
  await expect(page).toHaveURL(/\/admin$/)
})
