/** Account pages: signed-in guests only (client-rendered, see nuxt.config routeRules). */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const localePath = useLocalePath()
  const { account, load } = useAccount()
  if (!account.value) await load(true)
  if (!account.value) {
    return navigateTo({ path: localePath('/account/signin'), query: { return_to: to.fullPath } })
  }
})
