<script setup lang="ts">
/**
 * Shop breadcrumbs: Accueil › Boutique › Parent › Catégorie (› Produit), with the matching
 * `BreadcrumbList` JSON-LD. The last item is the current page (no link). The separator is a
 * mirrored character, so it points the right way in Arabic.
 */
const props = defineProps<{ items: { label: string, to?: string }[] }>()
const { t } = useI18n()
const config = useRuntimeConfig()
const base = computed(() => String((config.public.i18n as { baseUrl?: string })?.baseUrl ?? '').replace(/\/$/, ''))

useHead(() => ({
  script: [{
    key: 'ld-breadcrumbs',
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': props.items.map((item, i) => ({
        '@type': 'ListItem',
        'position': i + 1,
        'name': item.label,
        ...(item.to ? { item: `${base.value}${item.to}` } : {}),
      })),
    }),
  }],
}))
</script>

<template>
  <nav :aria-label="t('shop.breadcrumb')" class="text-small text-muted" data-testid="shop-breadcrumbs">
    <ol class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <li v-for="(item, i) in props.items" :key="i" class="flex items-center gap-2">
        <span v-if="i > 0" aria-hidden="true">›</span>
        <NuxtLink v-if="item.to && i < props.items.length - 1" :to="item.to" class="hover:underline">{{ item.label }}</NuxtLink>
        <span v-else aria-current="page" class="text-default">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>
