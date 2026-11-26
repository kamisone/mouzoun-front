import { readFileSync } from 'node:fs'
import type { BrowserContextOptions } from '@playwright/test'
import { CONSENT_AT_KEY, CONSENT_KEY, type ConsentChoice } from '../app/utils/consent'

type State = Exclude<BrowserContextOptions['storageState'], string | undefined>

/**
 * A storage state with the cookie choice already made, written exactly as the app writes it
 * (local storage `mz-consent` + `mz-consent-at`, app/utils/consent.ts), merged into the
 * project's own state (a staff session file, an object or nothing). Used by the `consent`
 * fixture of both Playwright suites, so pages open without the banner.
 */
export function withConsent(storageState: BrowserContextOptions['storageState'], consent: ConsentChoice, baseURL: string): State {
  const state: State = typeof storageState === 'string'
    ? JSON.parse(readFileSync(storageState, 'utf8'))
    : (storageState ?? { cookies: [], origins: [] })
  const origin = new URL(baseURL).origin
  const entries = [{ name: CONSENT_KEY, value: consent }, { name: CONSENT_AT_KEY, value: new Date().toISOString() }]
  const others = state.origins.filter(o => o.origin !== origin)
  const mine = state.origins.find(o => o.origin === origin)?.localStorage.filter(e => !entries.some(x => x.name === e.name)) ?? []
  return { cookies: state.cookies, origins: [...others, { origin, localStorage: [...mine, ...entries] }] }
}
