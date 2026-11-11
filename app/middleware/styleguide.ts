/**
 * The style guide is open in development (and when NUXT_PUBLIC_STYLEGUIDE=true, for CI checks);
 * in production only signed-in staff can see it.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.dev || useRuntimeConfig().public.styleguide) return
  if (import.meta.server) return
  const { user, fetchMe } = useAuth()
  if (!user.value) await fetchMe().catch(() => undefined)
  if (!user.value?.is_staff) return navigateTo({ path: '/admin/login', query: { redirect: to.fullPath } })
})
