/**
 * Back-office guard (client-side; admin pages are not server-rendered).
 * The session is an HttpOnly cookie, invisible to JavaScript: whether it exists is asked to the
 * API (`/v1/auth/me`) once, then the current user is kept in state. The API enforces every
 * permission anyway; this guard only drives navigation.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const { user, fetchMe } = useAuth()

  if (!user.value) {
    await fetchMe().catch(() => undefined)
  }

  if (to.path === '/admin/login') {
    return user.value ? navigateTo('/admin') : undefined
  }
  if (!user.value) {
    return navigateTo({ path: '/admin/login', query: { redirect: to.fullPath } })
  }
})
