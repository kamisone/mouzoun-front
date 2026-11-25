/**
 * The back office has no language in its URLs (`i18n: false` pages, client-rendered), so i18n
 * starts every load in French and rewrites its own cookie (`mz-locale`) to match. The language
 * chosen in the admin is kept in a cookie of its own (`mz-admin-locale`, set by MzLocaleSwitcher
 * in `state` mode) and applied again once the app is mounted, and after each admin navigation.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const apply = async (path: string) => {
    if (!path.startsWith('/admin')) return
    const i18n = nuxtApp.$i18n as { locale: { value: string }, locales: { value: { code: string }[] }, setLocale: (l: string) => Promise<void> }
    const saved = useCookie<string | null>(ADMIN_LOCALE_COOKIE).value
    if (saved && saved !== i18n.locale.value && i18n.locales.value.some(l => l.code === saved)) await i18n.setLocale(saved)
  }
  nuxtApp.hook('app:mounted', () => apply(router.currentRoute.value.path))
  router.afterEach(to => apply(to.path))
})
