/** robots.txt per environment (see server/routes/robots.txt.ts). */
const LOCALES = ['', '/en', '/ar']
const PRIVATE = ['/account', '/checkout', '/booking', '/trip', '/wishlists']
const SHOP_PRIVATE = ['cart', 'checkout', 'orders']

export function robotsText(production: boolean, base: string, extra: string): string {
  if (!production) return 'User-agent: *\nDisallow: /\n'
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api']
  for (const l of LOCALES) {
    for (const p of PRIVATE) lines.push(`Disallow: ${l}${p}`)
    const shop = l === '/en' ? 'shop' : 'boutique'
    for (const p of SHOP_PRIVATE) lines.push(`Disallow: ${l}/${shop}/${p}`)
  }
  // Internal search results (shop search and filters).
  lines.push('Disallow: /*?q=', 'Disallow: /*&q=')
  lines.push('', `Sitemap: ${base}/sitemap.xml`)
  if (extra.trim()) lines.push('', extra.trim())
  return `${lines.join('\n')}\n`
}
