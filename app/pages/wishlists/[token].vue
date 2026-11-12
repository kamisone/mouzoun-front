<script setup lang="ts">
import type { Wishlist } from '~/utils/account-types'

/** A wishlist shared by link: the products only, never who made it. */
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const base = useApiBase()
const { locale } = useI18n()
const { data: list, error } = await useFetch<Wishlist>(`/v1/account/wishlists/shared/${encodeURIComponent(String(route.params.token))}`, {
  baseURL: base,
  headers: { 'Accept-Language': locale.value },
})
useSeo({ title: () => `${list.value?.is_default ? t('account.wishlist.defaultName') : list.value?.name ?? t('account.wishlist.shared')} · ${t('common.siteName')}`, description: () => t('account.wishlist.sharedIntro') })
useHead({ meta: [{ name: 'robots', content: 'noindex' }] })
const productPath = (kind: string, slug: string) => localePath(`/${kind === 'accommodation' ? 'stays' : kind === 'package' ? 'packages' : 'activities'}/${slug}`)
</script>

<template>
  <MzContainer class="flex flex-col gap-8 py-16">
    <MzEmptyState v-if="error || !list" icon="i-lucide-heart-crack" :title="t('account.wishlist.sharedGone')" :description="''">
      <UButton :to="localePath('/stays')" :label="t('common.book')" />
    </MzEmptyState>
    <template v-else>
      <header class="flex flex-col gap-2">
        <p class="text-small font-semibold tracking-eyebrow text-muted uppercase">{{ t('account.wishlist.shared') }}</p>
        <h1 class="font-display text-h1 text-highlighted">{{ list.is_default ? t('account.wishlist.defaultName') : list.name }}</h1>
      </header>
      <MzGrid :cols="3">
        <MzOfferCard
          v-for="item in list.items"
          :key="item.product.id"
          :title="item.product.name"
          :description="item.product.short_description ?? undefined"
          :image="item.product.cover?.url"
          :image-alt="item.product.cover?.alt ?? ''"
          :price-from-cents="item.product.from_price_minor"
          :to="productPath(item.product.kind, item.product.slug)"
          :product-id="item.product.id"
          ratio="3/2"
        />
      </MzGrid>
    </template>
  </MzContainer>
</template>
