<script setup lang="ts">
/** The shop home: every product, filters and sort in the URL; "coming soon" in catalog mode. */
definePageMeta({ i18n: { paths: { fr: '/boutique', en: '/shop', ar: '/boutique' } } })

const { t } = useI18n()
const { data: config } = await useShopConfig()
if (config.value?.status === 'closed') throw createError({ statusCode: 404, statusMessage: 'Not found' })
useSeo({ title: () => `${t('shop.title')} · ${t('common.siteName')}`, description: () => t('shop.description') })
</script>

<template>
  <MzContainer class="flex flex-col gap-8 py-12 pt-24">
    <MzPageHeader :title="t('shop.title')" :description="t('shop.description')" />
    <MzShopComingSoon v-if="config?.status === 'catalog_only'" />
    <MzShopListing />
  </MzContainer>
</template>
