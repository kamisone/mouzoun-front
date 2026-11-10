export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const { token, user, fetchMe, logout } = useAuth()

  if (to.path === '/admin/login') {
    return token.value ? navigateTo('/admin') : undefined
  }
  if (!token.value) return navigateTo({ path: '/admin/login', query: { redirect: to.fullPath } })
  if (!user.value) {
    try {
      await fetchMe()
    } catch {
      logout()
      return navigateTo('/admin/login')
    }
  }
})
