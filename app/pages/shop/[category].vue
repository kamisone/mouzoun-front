<script setup lang="ts">
/** A shop category (and its sub-categories). */
definePageMeta({ i18n: { paths: { fr: '/boutique/[category]', en: '/shop/[category]', ar: '/boutique/[category]' } } })

const { t } = useI18n()
const route = useRoute()
const api = useShopApi()
const { data: config } = await useShopConfig()
if (config.value?.status === 'closed') throw createError({ statusCode: 404, statusMessage: 'Not found' })
const { data: categories } = await useAsyncData('shop-categories', () => api.categories())
const category = computed(() => categories.value?.data.find(c => c.slug === route.params.category || Object.values(c.slugs ?? {}).includes(String(route.params.category))) ?? null)
if (!category.value) throw createError({ statusCode: 404, statusMessage: 'Not found' })
useSeo({
  title: () => `${category.value?.seo_title || category.value?.name} · ${t('shop.title')}`,
  description: () => category.value?.seo_description || category.value?.description || t('shop.description'),
})
// Language switcher: the category's slug in each language.
const setI18nParams = useSetI18nParams()
setI18nParams(Object.fromEntries(Object.entries(category.value?.slugs ?? {}).map(([l, slug]) => [l, { category: slug }])))
</script>

<template>
  <MzContainer class="flex flex-col gap-8 py-12 pt-24">
    <MzPageHeader :title="category?.name ?? ''" :description="category?.description ?? undefined" />
    <MzShopComingSoon v-if="config?.status === 'catalog_only'" />
    <MzShopListing :category="category" />
  </MzContainer>
</template>
