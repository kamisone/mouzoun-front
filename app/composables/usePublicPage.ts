import type { RenderedPage, RenderedSection } from '~/utils/page-types'

/**
 * A page of the page builder for the current language: the published revision, or the draft when
 * the URL carries `?preview=<token>` (builder iframe). Sets the title, description, social image,
 * hreflang alternates (per-language slugs) and the JSON-LD returned by the API.
 *
 * In preview, the builder sends the section being edited by postMessage: it is rendered by the
 * API (same data and links as the public page) and replaced in place, without saving.
 */
export async function usePublicPage(target: () => { kind: 'home' } | { kind: 'slug', slug: string }) {
  const route = useRoute()
  const { locale } = useI18n()
  const config = useRuntimeConfig()
  const setI18nParams = useSetI18nParams()
  const preview = computed(() => (typeof route.query.preview === 'string' ? route.query.preview : undefined))
  const key = computed(() => {
    const t = target()
    return `page:${t.kind === 'home' ? 'home' : t.slug}:${locale.value}:${preview.value ?? ''}:${route.query.revision ?? ''}`
  })

  // Every composable runs before the first await: after it, server rendering has no Nuxt context.
  const request = useAsyncData(key, () => {
    const t = target()
    const path = t.kind === 'home' ? '/v1/pages/home' : `/v1/pages/by-slug/${t.slug}`
    return $fetch<RenderedPage>(path, { baseURL: useApiBase(), query: { locale: locale.value, preview: preview.value, revision: preview.value ? route.query.revision : undefined } })
  }, { watch: [locale] })
  const { data, refresh } = request

  watchEffect(() => {
    const page = data.value?.page
    if (!page || page.type === 'home') return
    // The language switcher and hreflang links lead to this page's slug in each language.
    setI18nParams(Object.fromEntries(page.hreflang.map(h => [h.locale, { slug: h.path.replace(/^\/(?:[a-z]{2}\/)?/, '').split('/') }])))
  })

  useSeo({
    title: () => data.value?.page.seo.title ?? '',
    description: () => data.value?.page.seo.description ?? '',
    image: () => data.value?.page.seo.image?.url,
  })
  useHead(() => ({
    meta: data.value?.page.seo.noindex || preview.value ? [{ name: 'robots', content: 'noindex, nofollow' }] : [],
    script: (data.value?.json_ld ?? []).map(doc => ({ type: 'application/ld+json', innerHTML: JSON.stringify(doc).replace(/</g, '\\u003c') })),
  }))

  if (import.meta.client && preview.value) {
    useEventListener(window, 'message', async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !data.value) return
      const msg = event.data as { type?: string, section?: unknown, id?: string }
      if (msg.type === 'mz:refresh') return refresh()
      if (msg.type === 'mz:scroll-to' && msg.id) {
        document.querySelector(`[data-section-id="${msg.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (msg.type !== 'mz:preview-section' || !msg.section) return
      const res = await $fetch<{ section: RenderedSection | null }>(`/v1/pages/${data.value.page.id}/preview/section`, {
        baseURL: config.public.apiBase,
        method: 'POST',
        query: { locale: locale.value },
        body: { token: preview.value, section: msg.section },
      }).catch(() => null)
      if (!res || !data.value) return
      const id = (msg.section as { id: string }).id
      const sections = data.value.sections.filter(s => s.id !== id || res.section)
      data.value = { ...data.value, sections: sections.map(s => (s.id === id && res.section ? res.section : s)) }
    })
  }

  const { error } = await request
  return { data, error, preview, refresh }
}
