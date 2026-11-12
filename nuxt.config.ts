// Image hosts @nuxt/image may optimise (public GCS bucket, CDN). Comma-separated, build time.
const imageDomains = (process.env.NUXT_IMAGE_DOMAINS ?? 'storage.googleapis.com')
  .split(',')
  .map(d => d.trim())
  .filter(Boolean)

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },

  // @nuxt/ui brings Tailwind CSS v4, color-mode, icons and @nuxt/fonts.
  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@nuxt/image', '@vueuse/nuxt', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  // Components are organised in folders (base/, layout/...) but named by their file: <MzPrice>.
  components: [{ path: '~/components', pathPrefix: false }],

  // Public site: light by default (an explicit choice is remembered; admin defaults to
  // "system", see app/composables/useThemePreference.ts). The inline script avoids any flash.
  colorMode: {
    preference: 'light',
    fallback: 'light',
    storageKey: 'mz-color-mode',
  },

  fonts: {
    defaults: { weights: [400, 500], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
    families: [
      { name: 'Cormorant Garamond', provider: 'google', weights: [400, 500], styles: ['normal', 'italic'] },
      { name: 'Inter', provider: 'google', weights: [400, 500] },
      { name: 'Noto Naskh Arabic', provider: 'google', subsets: ['arabic'], weights: [400, 500, 600] },
      { name: 'IBM Plex Sans Arabic', provider: 'google', subsets: ['arabic'], weights: [400, 500] },
    ],
  },

  image: {
    domains: imageDomains,
    format: ['avif', 'webp'],
    quality: 75,
  },

  eslint: { config: { stylistic: false } },

  runtimeConfig: {
    // Server-side API URL (inside Docker network); override with NUXT_API_INTERNAL_BASE
    apiInternalBase: 'http://localhost:8080',
    public: {
      // Browser-side API URL; override with NUXT_PUBLIC_API_BASE
      apiBase: 'http://localhost:8080',
      // Absolute base for hreflang/canonical SEO links; override with NUXT_PUBLIC_I18N_BASE_URL
      i18n: { baseUrl: 'http://localhost:3001' },
      // Default social sharing image (absolute URL); override with NUXT_PUBLIC_OG_IMAGE
      ogImage: '',
      // Serve /_styleguide outside dev without staff login (CI accessibility checks only)
      styleguide: false,
    },
  },

  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', dir: 'ltr', file: 'fr.json' },
      { code: 'en', language: 'en-GB', name: 'English', dir: 'ltr', file: 'en.json' },
      { code: 'ar', language: 'ar-MA', name: 'العربية', dir: 'rtl', file: 'ar.json' },
    ],
    detectBrowserLanguage: { useCookie: true, cookieKey: 'mz-locale', redirectOn: 'root' },
    // Pages opt out of localized routes with definePageMeta({ i18n: false }) (used by /admin)
    customRoutes: 'meta',
  },

  routeRules: {
    // Public pages: cache rendered HTML at the server (stale-while-revalidate)
    '/**': { swr: 300 },
    // Admin back-office: client-rendered SPA, never cached or indexed
    '/admin/**': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } },
    // Style guide: client-rendered review tool, guarded by app/middleware/styleguide.ts
    '/_styleguide': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/*/_styleguide': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    // Booking funnel and guest pages: personal, never cached nor indexed.
    '/trip': { swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    '/*/trip': { swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    '/checkout': { swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    '/*/checkout': { swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    '/booking/**': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    '/*/booking/**': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    // Guest account: private, client-rendered (its API session must never rotate during SSR).
    '/account/**': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    '/*/account/**': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    '/account': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    '/*/account': { ssr: false, swr: false, headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    '/wishlists/**': { swr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    '/*/wishlists/**': { swr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // Availability-dependent search results: short cache only.
    '/stays': { swr: 30 },
    '/*/stays': { swr: 30 },
  },

  app: {
    head: {
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
