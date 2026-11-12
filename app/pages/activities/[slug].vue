<script setup lang="ts">
/** Product page: everything to decide, and the booking box beside it. */
const route = useRoute()
const { t } = useI18n()
const api = useBookingApi()
const setI18nParams = useSetI18nParams()

const slug = computed(() => String(route.params.slug))
const { data: product } = await useAsyncData(`product-${slug.value}`, () => api.product(slug.value).catch(() => null), { watch: [slug] })
if (!product.value) {
  throw createError({ statusCode: 404, statusMessage: t('error.notFound'), fatal: true })
}
setI18nParams(Object.fromEntries(product.value.alternates.map(a => [a.locale, { slug: a.slug }])))
useSeo({
  title: () => product.value?.seo_title ?? `${product.value?.name} · ${t('common.siteName')}`,
  description: () => product.value?.seo_description ?? product.value?.short_description ?? '',
  image: () => product.value?.cover?.url,
})
</script>

<template>
  <MzProductView v-if="product" :product="product" />
</template>
