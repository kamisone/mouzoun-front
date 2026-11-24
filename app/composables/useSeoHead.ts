/** Canonical, hreflang and robots of a public path, from the API's route registry. */
export interface SeoHead {
  known: boolean
  canonical: string | null
  noindex: boolean
  reason: string | null
  alternates: { hreflang: string, href: string }[]
}

/**
 * The head tags every public page renders, from the route registry (`GET /v1/seo/head`), the
 * same rule as the sitemap: canonical (with `?page=` on listing pages, never filters), hreflang
 * to the indexable language versions plus x-default, `noindex` when not indexable. Paths the
 * registry does not know (account, cart...) and an unreachable API keep the i18n defaults.
 */
export function useSeoHead() {
  const route = useRoute()
  const base = useApiBase()
  const isAdmin = computed(() => route.path.startsWith('/admin') || route.path.startsWith('/_styleguide'))
  const { data } = useAsyncData(
    () => `seo-head:${route.path}`,
    () => (isAdmin.value
      ? Promise.resolve(null)
      : $fetch<SeoHead>('/v1/seo/head', { baseURL: base, query: { path: route.path }, timeout: 3000 }).catch(() => null)),
    { watch: [() => route.path] },
  )
  const page = computed(() => Number(route.query.page ?? 1))
  return computed(() => {
    const h = data.value
    if (!h?.known) return null
    const canonical = h.canonical && page.value > 1 ? `${h.canonical}?page=${page.value}` : h.canonical
    return { ...h, canonical }
  })
}
