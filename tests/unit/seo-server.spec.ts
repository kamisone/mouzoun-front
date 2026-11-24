import { type IncomingMessage, type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, defineEventHandler, getRequestHeader, getRequestURL, sendRedirect, setResponseHeader, setResponseHeaders, toNodeListener } from 'h3'
import { $fetch } from 'ofetch'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as path from '../../server/utils/seo-path'
import * as robots from '../../server/utils/seo-robots'

/**
 * The Nuxt server's redirect layer, for real over HTTP: the middleware runs in an h3 app (Nitro's
 * auto-imports stubbed with the real h3 helpers) against a small mock of the API.
 */
interface Api { version: string, redirects: Record<string, { to: string, code: number }>, down: boolean, hits: unknown[], calls: number }
const api: Api = { version: '1', redirects: {}, down: false, hits: [], calls: 0 }
let apiServer: Server
let site: Server
let siteUrl = ''
const config = { apiInternalBase: '', internalApiToken: 'tok', siteEnv: 'development', public: { i18n: { baseUrl: 'https://mouzoun.test' } } }

function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let b = ''
    req.on('data', (c) => { b += c })
    req.on('end', () => resolve(b))
  })
}

let redirects: typeof import('../../server/utils/seo-redirects')

beforeAll(async () => {
  apiServer = createServer(async (req, res) => {
    api.calls++
    if (api.down) {
      res.writeHead(500).end()
      return
    }
    if (req.url === '/v1/seo/redirects/version') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ version: api.version }))
    if (req.url === '/v1/seo/redirects/map') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ version: api.version, redirects: api.redirects }))
    if (req.url === '/v1/seo/hits' && req.method === 'POST') {
      api.hits.push({ token: req.headers['x-internal-token'], body: JSON.parse(await body(req)) })
      return res.writeHead(204).end()
    }
    res.writeHead(404).end()
  })
  await new Promise<void>(r => apiServer.listen(0, '127.0.0.1', r))
  config.apiInternalBase = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`
  // Nitro auto-imports used by the server code.
  Object.assign(globalThis, {
    defineEventHandler, getRequestURL, setResponseHeader, setResponseHeaders, sendRedirect, getRequestHeader, $fetch,
    useRuntimeConfig: () => config,
    ...path,
  })
  redirects = await import('../../server/utils/seo-redirects')
  Object.assign(globalThis, redirects)
  const middleware = (await import('../../server/middleware/seo-redirects')).default
  const app = createApp()
  app.use(middleware)
  app.use(defineEventHandler(() => 'page'))
  site = createServer(toNodeListener(app))
  await new Promise<void>(r => site.listen(0, '127.0.0.1', r))
  siteUrl = `http://127.0.0.1:${(site.address() as AddressInfo).port}`
})
afterAll(() => {
  site?.close()
  apiServer?.close()
})
beforeEach(() => {
  Object.assign(api, { version: String(Date.now()), redirects: {}, down: false, hits: [], calls: 0 })
  redirects.resetRedirectMap()
})

const get = (p: string, method = 'GET') => fetch(`${siteUrl}${p}`, { method, redirect: 'manual' })

describe('path rules (same as the API)', () => {
  it('normalises, encodes and filters', () => {
    expect(path.normalizePath('/boutique/')).toBe('/boutique')
    expect(path.normalizePath('//a//b/')).toBe('/a/b')
    expect(path.normalizePath('/ar/boutique/%D8%AA%D9%85%D9%88%D8%B1')).toBe('/ar/boutique/تمور')
    expect(path.normalizePath('/éte')).toBe('/éte')
    expect(path.normalizePath('/Dattes')).toBe('/Dattes')
    expect(path.encodePath('/ar/boutique/تمور')).toBe('/ar/boutique/%D8%AA%D9%85%D9%88%D8%B1')
    expect(['/wp-login.php', '/.env', '/.git/HEAD', `/${'a'.repeat(301)}`].every(path.isNoise)).toBe(true)
    expect(path.isNoise('/boutique/dattes')).toBe(false)
    expect(['/api/x', '/_nuxt/a.js', '/admin/seo', '/favicon.ico', '/robots.txt', '/sitemaps/pages.xml'].every(path.isSkipped)).toBe(true)
    expect(path.isSkipped('/boutique/dattes')).toBe(false)
  })

  it('robots.txt allows crawling only in production', () => {
    expect(robots.robotsText(false, 'https://mouzoun.test', '')).toBe('User-agent: *\nDisallow: /\n')
    const prod = robots.robotsText(true, 'https://mouzoun.test', 'User-agent: GPTBot\nDisallow: /')
    expect(prod).toContain('Allow: /\n')
    for (const p of ['/admin', '/api', '/boutique/cart', '/en/shop/checkout', '/ar/boutique/orders', '/account', '/en/account', '/checkout']) expect(prod).toContain(`Disallow: ${p}\n`)
    expect(prod).toContain('Sitemap: https://mouzoun.test/sitemap.xml')
    expect(prod.trim().endsWith('User-agent: GPTBot\nDisallow: /')).toBe(true)
  })
})

describe('redirect middleware', () => {
  it('301s to the normalised path, absolute and with the query string', async () => {
    const res = await get('/boutique//dattes/?utm_source=ig')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://mouzoun.test/boutique/dattes?utm_source=ig')
    // Percent-encoded Arabic is the same path: no redirect.
    expect((await get('/ar/boutique/%D8%AA%D9%85%D9%88%D8%B1')).status).toBe(200)
  })

  it('follows a stored redirect, keeps UTM tags, caches 301 and never 302', async () => {
    api.redirects = { '/promo': { to: '/activities', code: 301 }, '/carte': { to: '/stays', code: 302 }, '/insta': { to: 'https://www.instagram.com/x/', code: 302 } }
    let res = await get('/promo?utm_campaign=ete')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://mouzoun.test/activities?utm_campaign=ete')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    res = await get('/carte')
    expect([res.status, res.headers.get('cache-control')]).toEqual([302, 'no-store'])
    res = await get('/insta')
    expect(res.headers.get('location')).toBe('https://www.instagram.com/x/')
    // HEAD is redirected too; POST is not.
    expect((await get('/promo', 'HEAD')).status).toBe(301)
    expect((await get('/promo', 'POST')).status).toBe(200)
  })

  it('leaves the API, assets and the back office alone', async () => {
    api.redirects = { '/api/x': { to: '/', code: 301 }, '/_nuxt/a.js': { to: '/', code: 301 }, '/admin': { to: '/', code: 301 } }
    for (const p of ['/api/x', '/_nuxt/a.js', '/admin', '/logo.png']) expect((await get(p)).status, p).toBe(200)
  })

  it('keeps serving when the API (or its Redis) is down: last copy, then no redirects', async () => {
    api.redirects = { '/promo': { to: '/activities', code: 301 } }
    expect((await get('/promo')).status).toBe(301)
    api.down = true
    // The copy is re-checked at most every 15 s: still the last copy.
    expect((await get('/promo')).status).toBe(301)
    redirects.resetRedirectMap()
    // Nothing cached and the API down: the page renders, no 500.
    expect((await get('/promo')).status).toBe(200)
    expect((await get('/stays')).status).toBe(200)
  })

  it('marks every response noindex outside production', async () => {
    expect((await get('/stays')).headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('counts redirect visits and 404s, then sends them in one batch with the token', async () => {
    await redirects.flushHits()
    api.hits = []
    api.redirects = { '/promo': { to: '/activities', code: 301 } }
    await get('/promo')
    await get('/promo')
    redirects.countNotFound('/sejours', 'https://www.google.com/')
    expect(redirects.pendingHits().redirects).toEqual({ '/promo': 2 })
    await redirects.flushHits()
    expect(api.hits).toEqual([{ token: 'tok', body: { redirects: { '/promo': 2 }, not_found: [{ path: '/sejours', hits: 1, referrer: 'https://www.google.com/' }] } }])
    expect(redirects.pendingHits()).toEqual({ redirects: {}, notFound: {} })
  })
})
