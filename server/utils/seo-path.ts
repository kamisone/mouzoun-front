/**
 * Public paths as the redirect layer compares them, the same rule as the API
 * (`back/src/modules/seo/path.rs`): percent-decoded, Unicode NFC (Arabic slugs), no trailing slash
 * (except `/`), no double slashes. Case is kept.
 */
export function safeDecode(path: string): string {
  try {
    return decodeURIComponent(path)
  }
  catch {
    return path
  }
}

export function normalizePath(raw: string): string | null {
  const path = raw.split(/[?#]/)[0] ?? ''
  if (!path.startsWith('/')) return null
  let out = safeDecode(path).normalize('NFC').replace(/\/{2,}/g, '/')
  while (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1)
  return out
}

/** Percent-encodes a decoded path, segment by segment (a decoded `?` stays in the path). */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/** Scanner requests never logged as 404s. */
export function isNoise(path: string): boolean {
  const p = path.toLowerCase()
  return p.length > 300 || p.endsWith('.php') || p.includes('.php/') || p.includes('/wp-') || p.includes('/.env')
    || p.endsWith('.env') || p.includes('/.git') || p.startsWith('/cgi-bin') || p.includes('xmlrpc')
}

/** Requests the redirect layer never touches: API, build assets, admin, static files. */
export function isSkipped(path: string): boolean {
  return /^\/(?:api|_nuxt|__nuxt|_ipx|_i18n|admin|healthz|_styleguide)(?:\/|$)/.test(path)
    || path === '/robots.txt' || path === '/sitemap.xml' || path.startsWith('/sitemaps/')
    || /\.[a-z0-9]{2,5}$/i.test(path)
}
