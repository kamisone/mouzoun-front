<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'
import type { ShopCard } from '~/utils/shop-types'

/**
 * "Produits de la boutique" (`shop_products`): farm-shop products with the shop's own card
 * (MzShopCard, the same data as the shop listing), in a carousel or a grid, with a "view all" link
 * whose address comes from the API (route registry). Buttons follow the shop status. Nothing is
 * shown when no product matches, except in the builder preview, which says why.
 */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
const { text, preview } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const products = computed(() => (props.section.data.products ?? []) as ShopCard[])
const status = computed(() => props.section.data.shop_status as 'open' | 'catalog_only' | 'closed')
const viewAll = computed(() => (s.value.show_view_all !== false ? (props.section.data.view_all_url as string | null) : null))
const viewAllLabel = computed(() => text(props.section.content.view_all_label) || t('sections.shopAll'))
const isPreview = computed(() => !!unref(preview))
const ratio = computed(() => (s.value.image_ratio ?? 'square') as 'square' | 'portrait' | 'adapt')
const mobile1 = computed(() => Number(s.value.columns_mobile ?? 2) === 1)
const grids = {
  grid_3: 'md:grid-cols-3',
  grid_4: 'md:grid-cols-3 lg:grid-cols-4',
} as const
const cardProps = computed(() => ({
  canBuy: status.value === 'open',
  catalogOnly: status.value === 'catalog_only',
  quickAdd: s.value.quick_add !== false,
  ratio: ratio.value,
  showSecondaryImage: s.value.show_secondary_image !== false,
  showUnitPrice: s.value.show_unit_price !== false,
  showRating: !!s.value.show_rating,
}))
</script>

<template>
  <MzSectionContainer :section="props.section">
    <div class="flex flex-wrap items-end justify-between gap-x-6">
      <MzSectionHeading :section="props.section" />
      <NuxtLink v-if="viewAll && products.length" :to="viewAll" class="mb-12 hidden items-center gap-1 text-small font-medium underline-offset-4 hover:underline md:inline-flex lg:mb-16" data-testid="shop-products-view-all">
        {{ viewAllLabel }}<UIcon name="i-lucide-arrow-right" class="size-4 rtl:rotate-180" aria-hidden="true" />
      </NuxtLink>
    </div>

    <p v-if="!products.length && isPreview" class="rounded-md border border-dashed border-default p-6 text-center text-small text-muted" data-testid="shop-products-empty">
      {{ t('sections.shopEmpty') }}
    </p>
    <MzCarousel
      v-else-if="(s.layout ?? 'carousel') === 'carousel'"
      :count="products.length"
      :label="text(props.section.content.title) || t('sections.shopProducts')"
      :slide-class="mobile1 ? 'basis-4/5 sm:basis-1/2 lg:basis-1/4' : 'basis-[46%] sm:basis-1/3 lg:basis-1/4'"
    >
      <template #default="{ index: i }">
        <MzShopCard :product="products[i]!" v-bind="cardProps" />
      </template>
    </MzCarousel>
    <ul v-else class="grid gap-x-4 gap-y-8" :class="[mobile1 ? 'grid-cols-1' : 'grid-cols-2', grids[s.layout as keyof typeof grids] ?? grids.grid_3]" data-testid="shop-products-grid">
      <li v-for="p in products" :key="p.id">
        <MzShopCard :product="p" v-bind="cardProps" />
      </li>
    </ul>

    <UButton v-if="viewAll && products.length" :to="viewAll" :label="viewAllLabel" color="neutral" variant="outline" block class="mt-8 md:hidden" />
  </MzSectionContainer>
</template>
