<script setup lang="ts">
/**
 * A shop category: breadcrumbs, cover (above the fold: eager, sized, blur-up), title,
 * description (three lines on phones, "Lire plus"), subcategory chips, then the listing with
 * the products of its subcategories too (pinned first, then the category's default sort).
 * An inactive category or an old address answers 301 (the API says where). JSON-LD
 * `CollectionPage` + `BreadcrumbList`; canonical without filters (only `page`); `noindex` while
 * it has no published product.
 */
definePageMeta({
  i18n: { paths: { fr: '/boutique/[category]', en: '/shop/[category]', ar: '/boutique/[category]' } },
  // One instance per category (filters in the query keep it).
  key: route => String(route.params.category),
})

const { t, locale } = useI18n()
const route = useRoute()
const api = useShopApi()
const shopPath = useShopPath()
const localePath = useLocalePath()
const runtime = useRuntimeConfig()
const { data: config } = await useShopConfig()
if (config.value?.status === 'closed') throw createError({ statusCode: 404, statusMessage: 'Not found' })

const slug = String(route.params.category)
const { data: page } = await useAsyncData(`shop-category-${locale.value}-${slug}`, () => api.category(slug).catch((e: { statusCode?: number }) => {
  if (e.statusCode === 404) return null
  throw e
}))
if (page.value?.redirect) await navigateTo(page.value.redirect, { redirectCode: 301, replace: true })
if (!page.value?.category) throw createError({ statusCode: 404, statusMessage: 'Not found' })
const c = computed(() => page.value!.category!)

// Description: clamped to three lines on phones until opened.
const expanded = ref(false)
const plain = (html: string | null) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const crumbs = computed(() => [
  { label: t('nav.home'), to: localePath('/') },
  { label: t('shop.title'), to: shopPath() },
  ...c.value.breadcrumbs.map(b => ({ label: b.name, to: shopPath(b.slug) })),
])

useSeo({
  title: () => `${c.value.seo_title || c.value.name} · ${t('shop.title')}`,
  description: () => c.value.seo_description || plain(c.value.description).slice(0, 155) || t('shop.description'),
  image: () => c.value.cover?.url,
})
// Language switcher: the category's slug in each language.
const setI18nParams = useSetI18nParams()
setI18nParams(Object.fromEntries(Object.entries(c.value.slugs ?? {}).map(([l, s]) => [l, { category: s }])))

const base = computed(() => String((runtime.public.i18n as { baseUrl?: string })?.baseUrl ?? '').replace(/\/$/, ''))
const canonical = computed(() => {
  const p = Number(route.query.page ?? 1)
  return `${base.value}${route.path}${p > 1 ? `?page=${p}` : ''}`
})
useHead(() => ({
  // Replaces the i18n canonical (same key): no filter parameters, `page` kept.
  link: [{ key: 'i18n-can', id: 'i18n-can', rel: 'canonical', href: canonical.value }],
  meta: c.value.indexable ? [] : [{ key: 'robots', name: 'robots', content: 'noindex, follow' }],
  script: [{
    key: 'ld-collection',
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': c.value.name,
      'description': c.value.seo_description || plain(c.value.description) || undefined,
      'url': canonical.value,
      'inLanguage': locale.value,
      ...(c.value.cover ? { image: c.value.cover.url } : {}),
    }),
  }],
}))
</script>

<template>
  <MzContainer class="flex flex-col gap-8 py-12 pt-24">
    <MzShopBreadcrumbs :items="crumbs" />
    <header class="grid items-center gap-6" :class="c.cover && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'" data-testid="category-header">
      <div class="flex min-w-0 flex-col gap-3">
        <h1 class="text-balance text-h1">{{ c.name }}</h1>
        <div v-if="c.description" class="flex flex-col items-start gap-1">
          <!-- eslint-disable-next-line vue/no-v-html -- sanitised by the API (limited rich text) -->
          <div class="max-w-editorial text-body-lg text-muted" :class="!expanded && 'line-clamp-3 md:line-clamp-none'" data-testid="category-description" v-html="c.description" />
          <UButton v-if="!expanded" :label="t('shop.readMore')" color="neutral" variant="link" class="px-0 md:hidden" :aria-expanded="false" @click="expanded = true" />
        </div>
        <ul v-if="c.children.length" class="flex flex-wrap gap-2" :aria-label="t('shop.subcategories')" data-testid="category-children">
          <li v-for="child in c.children" :key="child.id">
            <UButton :to="shopPath(child.slug)" color="neutral" variant="outline" size="sm" class="rounded-full">
              {{ child.name }} <span class="tabular-nums text-muted">{{ child.product_count }}</span>
            </UButton>
          </li>
        </ul>
      </div>
      <!-- Above the fold: eager, high priority, ratio reserved (no layout shift). -->
      <MzMedia v-if="c.cover" :media="c.cover" ratio="3/2" priority sizes="(min-width: 768px) 50vw, 100vw" data-testid="category-cover" />
    </header>
    <MzShopComingSoon v-if="config?.status === 'catalog_only'" />
    <section v-if="!c.product_count" class="flex flex-col items-start gap-4" data-testid="category-empty">
      <p class="text-body text-muted">{{ t('shop.categoryEmpty') }}</p>
      <UButton :to="shopPath()" :label="t('shop.backToShop')" color="neutral" variant="outline" icon="i-lucide-arrow-left" class="rtl:[&_svg]:rotate-180" />
      <MzShopComingSoon v-if="config?.status === 'open'" :title="t('shop.categoryNotify.title')" :text="t('shop.categoryNotify.text')" />
    </section>
    <MzShopListing v-else :category="{ id: c.id, parent_id: null, name: c.name, slug: c.slug, description: null, image_url: null, seo_title: null, seo_description: null, slugs: c.slugs }" />
  </MzContainer>
</template>
