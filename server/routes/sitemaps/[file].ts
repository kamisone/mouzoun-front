/** One sitemap file (`pages.xml`, `activities-2.xml`...), built by the API. */
export default defineEventHandler(event => proxySitemap(event, `/v1/seo/sitemaps/${encodeURIComponent(getRouterParam(event, 'file') ?? '')}`))
