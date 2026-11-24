/**
 * robots.txt. Production (NUXT_SITE_ENV=production): everything but the back office, the API,
 * cart, checkout, order, booking, account pages and internal search results, then the sitemap and
 * the admin's extra lines (`seo.robots_extra`). Anywhere else: nothing may be crawled.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const production = config.siteEnv === 'production'
  const base = String((config.public.i18n as { baseUrl?: string })?.baseUrl ?? '').replace(/\/$/, '')
  let extra = ''
  if (production) {
    const api = String(config.apiInternalBase).replace(/\/$/, '')
    extra = (await $fetch<{ extra: string }>(`${api}/v1/seo/robots`, { timeout: 3000 }).catch(() => ({ extra: '' }))).extra ?? ''
  }
  setResponseHeaders(event, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' })
  return robotsText(production, base, extra)
})
