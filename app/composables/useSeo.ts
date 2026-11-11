/**
 * Per-page SEO in the current language: title, description, Open Graph / Twitter cards.
 * hreflang alternates and canonical links come from useLocaleHead in app.vue.
 * The default social image is NUXT_PUBLIC_OG_IMAGE (absolute URL in the public bucket).
 */
export function useSeo(input: { title: MaybeRefOrGetter<string>, description: MaybeRefOrGetter<string>, image?: MaybeRefOrGetter<string | undefined> }) {
  const config = useRuntimeConfig()
  const { t } = useI18n()
  const image = computed(() => toValue(input.image) || (config.public.ogImage as string) || undefined)
  useSeoMeta({
    title: () => toValue(input.title),
    description: () => toValue(input.description),
    ogTitle: () => toValue(input.title),
    ogDescription: () => toValue(input.description),
    ogSiteName: () => t('common.siteName'),
    ogType: 'website',
    ogImage: () => image.value,
    twitterCard: () => (image.value ? 'summary_large_image' : 'summary'),
  })
}
