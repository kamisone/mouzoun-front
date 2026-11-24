import type { H3Event } from 'h3'

/** Serves an XML file of the API as is (`application/xml`, one hour in caches). */
export async function proxySitemap(event: H3Event, path: string) {
  const base = String(useRuntimeConfig(event).apiInternalBase).replace(/\/$/, '')
  const res = await $fetch.raw(`${base}${path}`, { responseType: 'text', ignoreResponseError: true, timeout: 20_000 }).catch(() => null)
  if (!res || res.status === 404) throw createError({ statusCode: res ? 404 : 503, statusMessage: res ? 'Not found' : 'Unavailable' })
  if (!res.ok) throw createError({ statusCode: 503, statusMessage: 'Unavailable' })
  setResponseHeaders(event, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' })
  return res._data as string
}
