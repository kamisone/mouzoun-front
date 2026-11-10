import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  runtimeConfig: {
    // Server-side API URL (inside Docker network); override with NUXT_API_INTERNAL_BASE
    apiInternalBase: 'http://localhost:8080',
    public: {
      // Browser-side API URL; override with NUXT_PUBLIC_API_BASE
      apiBase: 'http://localhost:8080',
      siteUrl: 'http://localhost:3001',
      // Absolute base for hreflang/canonical SEO links; override with NUXT_PUBLIC_I18N_BASE_URL
      i18n: { baseUrl: 'http://localhost:3001' },
    },
  },

  i18n: {
    strategy: 'prefix',
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: { useCookie: true, redirectOn: 'root' },
    // Lets pages opt out of localized routes with definePageMeta({ i18n: false }) (used by /admin)
    customRoutes: 'meta',
  },

  // Public pages: cache rendered HTML at the server (stale-while-revalidate) — huge win under load
  routeRules: {
    '/': { redirect: '/fr' },
    '/fr/**': { swr: 300 },
    '/en/**': { swr: 300 },
    // Admin back-office: client-rendered SPA, never cached or indexed
    '/admin/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } },
    '/admin': { ssr: false, headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
