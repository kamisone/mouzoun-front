/**
 * Links built with the locale prefix (emails: `/fr/booking/MZ-…`) also work for the default
 * language, which has no prefix on this site (`prefix_except_default`).
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (url.pathname === '/fr' || url.pathname.startsWith('/fr/')) {
    return sendRedirect(event, `${url.pathname.slice(3) || '/'}${url.search}`, 301)
  }
})
