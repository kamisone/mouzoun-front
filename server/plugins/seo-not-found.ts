import type { H3Event } from 'h3'

/**
 * Public pages that end in 404 are counted (batched to the API, then the 404 log in Admin › SEO),
 * except API calls, assets and scanner noise (`.php`, `/wp-`, `.env`, `/.git`, very long paths).
 * A page that throws its 404 (Nuxt's createError) goes through the `error` hook; a 404 response
 * written without an error through `afterResponse`.
 */
function record(event: H3Event | undefined) {
  if (!event || event.method !== 'GET') return
  const raw = getRequestURL(event).pathname
  if (isSkipped(raw)) return
  const path = normalizePath(raw)
  if (!path || isNoise(path)) return
  countNotFound(path, getRequestHeader(event, 'referer') ?? null)
}

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, { event }) => {
    if ((error as { statusCode?: number }).statusCode === 404) record(event)
  })
  nitro.hooks.hook('afterResponse', (event) => {
    if (event.node.res.statusCode === 404) record(event)
  })
})
