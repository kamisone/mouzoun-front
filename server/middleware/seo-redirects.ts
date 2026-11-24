/**
 * Site-wide redirects, before any page renders: normalise the path (decoded, NFC, no trailing or
 * double slash: 301 to the clean form), then look it up in the active redirects (one hop, query
 * string kept). Locations are absolute from the site URL (NUXT_PUBLIC_I18N_BASE_URL), never from
 * the Host header. Outside production every response carries `X-Robots-Tag: noindex`.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (config.siteEnv !== 'production') setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const url = getRequestURL(event)
  const raw = url.pathname
  if (isSkipped(raw)) return
  const path = normalizePath(raw)
  if (!path) return
  const base = String((config.public.i18n as { baseUrl?: string })?.baseUrl ?? '').replace(/\/$/, '')
  const send = (to: string, code: number) => {
    const location = /^https:\/\//.test(to) ? to : `${base}${encodePath(to)}`
    setResponseHeader(event, 'Cache-Control', code === 301 || code === 308 ? 'public, max-age=3600' : 'no-store')
    return sendRedirect(event, `${location}${url.search}`, code)
  }
  if (path !== safeDecode(raw)) return send(path, 301)

  const map = await redirectMap(event)
  const hit = map[path]
  if (!hit) return
  countRedirect(path)
  let target = hit
  // Chains are flattened when written: a second hop means something slipped through.
  const next = map[target.to]
  if (next) {
    console.warn(`[seo] redirect chain ${path} → ${target.to} → ${next.to}: followed once`)
    target = { to: next.to, code: target.code }
  }
  return send(target.to, target.code)
})
