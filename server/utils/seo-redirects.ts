import type { H3Event } from 'h3'

/**
 * The active redirects, from the API (`GET /v1/seo/redirects/map`, cached in Redis there). Kept in
 * this process and re-checked at most every 15 seconds (`/version`). When the API cannot be
 * reached, the last copy keeps serving (then none): the site never fails because of redirects.
 *
 * Visits are counted here and sent in batches every 10 seconds (`POST /v1/seo/hits`); the API adds
 * them to Redis counters written to Postgres every minute.
 */
export interface RedirectTarget { to: string, code: number }
interface MapState {
  version: string | null
  redirects: Record<string, RedirectTarget>
  checkedAt: number
  loading: Promise<void> | null
  warned: boolean
}
const CHECK_EVERY_MS = 15_000
const FLUSH_EVERY_MS = 10_000
const state: MapState = { version: null, redirects: {}, checkedAt: 0, loading: null, warned: false }

function api(event?: H3Event) {
  const config = useRuntimeConfig(event)
  return { base: String(config.apiInternalBase).replace(/\/$/, ''), token: String(config.internalApiToken || '') }
}

async function refresh(event?: H3Event) {
  state.checkedAt = Date.now()
  const { base } = api(event)
  try {
    const { version } = await $fetch<{ version: string }>(`${base}/v1/seo/redirects/version`, { timeout: 2000 })
    if (version !== state.version) {
      const map = await $fetch<{ version: string, redirects: Record<string, RedirectTarget> }>(`${base}/v1/seo/redirects/map`, { timeout: 5000 })
      state.redirects = map.redirects ?? {}
      state.version = map.version
    }
    state.warned = false
  }
  catch (error) {
    if (!state.warned) {
      console.warn('[seo] redirect map unavailable, serving the last copy:', (error as Error).message)
      state.warned = true
    }
  }
}

/** The map to use now (never waits once a first copy exists). */
export async function redirectMap(event?: H3Event): Promise<Record<string, RedirectTarget>> {
  if (Date.now() - state.checkedAt >= CHECK_EVERY_MS && !state.loading) {
    state.loading = refresh(event).finally(() => { state.loading = null })
  }
  if (state.version === null && state.loading) await state.loading
  return state.redirects
}

/** Tests: forget the cached map. */
export function resetRedirectMap() {
  Object.assign(state, { version: null, redirects: {}, checkedAt: 0, loading: null, warned: false })
}

// ---- Visit counts ------------------------------------------------------------------------------
const hits = { redirects: new Map<string, number>(), notFound: new Map<string, { hits: number, referrer: string | null }>() }
let timer: ReturnType<typeof setInterval> | null = null

export async function flushHits(event?: H3Event) {
  if (!hits.redirects.size && !hits.notFound.size) return
  const body = {
    redirects: Object.fromEntries(hits.redirects),
    not_found: [...hits.notFound].map(([path, v]) => ({ path, hits: v.hits, referrer: v.referrer })),
  }
  hits.redirects.clear()
  hits.notFound.clear()
  const { base, token } = api(event)
  await $fetch(`${base}/v1/seo/hits`, { method: 'POST', body, timeout: 5000, headers: token ? { 'x-internal-token': token } : {} })
    .catch(() => { /* counts are statistics: lost on failure */ })
}

function schedule() {
  if (timer) return
  timer = setInterval(() => void flushHits(), FLUSH_EVERY_MS)
  timer.unref?.()
}

export function countRedirect(from: string) {
  hits.redirects.set(from, (hits.redirects.get(from) ?? 0) + 1)
  schedule()
}

export function countNotFound(path: string, referrer: string | null) {
  if (hits.notFound.size >= 2000 && !hits.notFound.has(path)) return
  const cur = hits.notFound.get(path)
  hits.notFound.set(path, { hits: (cur?.hits ?? 0) + 1, referrer: referrer ?? cur?.referrer ?? null })
  schedule()
}

/** Tests: what is waiting to be sent. */
export function pendingHits() {
  return { redirects: Object.fromEntries(hits.redirects), notFound: Object.fromEntries(hits.notFound) }
}
