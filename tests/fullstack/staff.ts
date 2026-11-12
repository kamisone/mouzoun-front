import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

/**
 * Staff sign-in for full-stack tests: password, then the TOTP step. On the first run the API
 * enrols the account (the secret is on screen); it is kept in test-results/ (git-ignored) for
 * the next runs, or given with E2E_STAFF_TOTP_SECRET.
 */
const STORE = 'test-results/.staff-totp'

function base32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)))
  const mac = createHmac('sha1', base32(secret)).update(counter).digest()
  const offset = mac[mac.length - 1]! & 0x0f
  const value = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(value).padStart(6, '0')
}

export async function staffSignIn(page: Page, ready: (p: Page) => Promise<void>) {
  await page.goto('/admin/login')
  await ready(page)
  await page.locator('input[type="email"]').fill(process.env.E2E_STAFF_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.E2E_STAFF_PASSWORD!)
  await page.locator('form button[type="submit"]').click()
  const code = page.getByTestId('code-0')
  await expect(page.locator('body')).toContainText(/Vérification en deux étapes|Tableau de bord|Aujourd/, { timeout: 15_000 })
  if (!(await code.isVisible())) return page.waitForURL(/\/admin$/)
  let secret = process.env.E2E_STAFF_TOTP_SECRET ?? (existsSync(STORE) ? readFileSync(STORE, 'utf8').trim() : '')
  const shown = page.locator('code')
  if (await shown.isVisible()) {
    secret = (await shown.textContent())!.trim()
    mkdirSync('test-results', { recursive: true })
    writeFileSync(STORE, secret, { mode: 0o600 })
  }
  expect(secret, 'needs E2E_STAFF_TOTP_SECRET (the staff account is already enrolled)').not.toBe('')
  await code.click()
  await page.keyboard.type(totp(secret))
  await page.waitForURL(/\/admin$/)
}
