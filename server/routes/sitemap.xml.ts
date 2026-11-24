/** Sitemap index, built by the API from the route registry (cached in Redis there). */
export default defineEventHandler(event => proxySitemap(event, '/v1/seo/sitemap.xml'))
