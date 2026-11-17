/**
 * Cookie consent (CNIL guidelines): the choice is kept 6 months, then asked again; refusing is
 * as easy as accepting; the choice can be changed at any time (footer link). Only the audience
 * measurement needs consent; the cart and session cookies are strictly necessary.
 */
export type ConsentChoice = 'granted' | 'denied'

export const CONSENT_KEY = 'mz-consent'
export const CONSENT_AT_KEY = 'mz-consent-at'
/** 6 months, in milliseconds. */
export const CONSENT_TTL_MS = 182 * 24 * 3600 * 1000

/** The stored choice while still valid, otherwise null (never asked, unreadable or expired). */
export function consentState(choice: string | null, at: string | null, now = Date.now()): ConsentChoice | null {
  if (choice !== 'granted' && choice !== 'denied') return null
  const time = at ? Date.parse(at) : Number.NaN
  if (Number.isNaN(time) || now - time > CONSENT_TTL_MS || time > now + 60_000) return null
  return choice
}

/** Reads the choice from local storage (null on the server or when storage is blocked). */
export function readConsent(now = Date.now()): ConsentChoice | null {
  try {
    return consentState(localStorage.getItem(CONSENT_KEY), localStorage.getItem(CONSENT_AT_KEY), now)
  }
  catch {
    return null
  }
}

export function writeConsent(choice: ConsentChoice, now = new Date()) {
  try {
    localStorage.setItem(CONSENT_KEY, choice)
    localStorage.setItem(CONSENT_AT_KEY, now.toISOString())
  }
  catch {
    // Storage blocked: the banner shows again next time, nothing is measured.
  }
}
