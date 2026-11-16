<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

interface Card {
  id: string
  kind: 'accommodation' | 'activity' | 'package' | 'extra'
  slug: string
  name: string
  short_description: string | null
  is_featured: boolean
  cover: { url: string, alt: string | null } | null
  from_price_minor: number | null
  from_price_unit: string | null
  rating: { average: number, count: number } | null
  facts: { duration_minutes?: number | null, is_guided?: boolean | null }
}

/** Products picked by hand or by rule: carousel or grid of offer cards (live prices). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
const localePath = useLocalePath()
const { text } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const products = computed(() => (props.section.data.products ?? []) as Card[])
const bases = { accommodation: '/stays', activity: '/activities', package: '/packages', extra: '' } as const
const grids = { grid_3: 'grid gap-12 md:grid-cols-2 lg:grid-cols-3', grid_4: 'grid gap-8 sm:grid-cols-2 lg:grid-cols-4' } as const

function unit(card: Card) {
  const u = card.from_price_unit ?? ''
  return u.includes('night') ? 'night' : u.includes('person') ? 'person' : undefined
}
function href(card: Card) {
  return bases[card.kind] ? localePath(`${bases[card.kind]}/${card.slug}`) : undefined
}
function label(card: Card) {
  if (s.value.show_rating && card.rating?.count) return t('sections.rating', { average: card.rating.average.toLocaleString(), count: card.rating.count })
  return card.facts.is_guided ? t('home.guided') : undefined
}
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <MzCarousel v-if="s.layout === 'carousel' || !s.layout" :count="products.length" :label="text(props.section.content.title) || t('sections.products')">
      <template #default="{ index: i }">
        <MzOfferCard
          :title="products[i]!.name"
          :product-id="products[i]!.id"
          :description="s.card_style === 'compact' ? undefined : (products[i]!.short_description ?? undefined)"
          :image="products[i]!.cover?.url"
          :image-alt="products[i]!.cover?.alt ?? products[i]!.name"
          :ratio="s.card_style === 'compact' ? '3/2' : '4/5'"
          :duration-minutes="s.show_duration ? (products[i]!.facts.duration_minutes ?? null) : null"
          :price-from-cents="s.show_price_from ? products[i]!.from_price_minor : null"
          :price-unit="unit(products[i]!)"
          :label="label(products[i]!)"
          :to="href(products[i]!)"
        />
      </template>
    </MzCarousel>
    <div v-else :class="grids[s.layout as keyof typeof grids] ?? grids.grid_3">
      <MzReveal v-for="(card, i) in products" :key="card.id" :index="i">
        <MzOfferCard
          :title="card.name"
          :product-id="card.id"
          :description="s.card_style === 'compact' ? undefined : (card.short_description ?? undefined)"
          :image="card.cover?.url"
          :image-alt="card.cover?.alt ?? card.name"
          :ratio="s.card_style === 'compact' ? '3/2' : '4/5'"
          :duration-minutes="s.show_duration ? (card.facts.duration_minutes ?? null) : null"
          :price-from-cents="s.show_price_from ? card.from_price_minor : null"
          :price-unit="unit(card)"
          :label="label(card)"
          :to="href(card)"
        />
      </MzReveal>
    </div>
  </MzSectionContainer>
</template>
