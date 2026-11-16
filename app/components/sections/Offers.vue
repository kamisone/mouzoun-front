<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

interface Promotion {
  id: string
  name: string
  description: string | null
  discount_type: 'percent' | 'fixed_amount' | 'free_nights'
  discount_percent: number | null
  discount_amount_minor: number | null
  discount_free_nights: number | null
  currency: string | null
  ends_at: string | null
}

/** Offers active now (automatic promotions, never codes) with an optional countdown, or chosen products. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t } = useI18n()
const { money } = useMoney()
const localePath = useLocalePath()
const { text } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const promotions = computed(() => (props.section.data.promotions ?? []) as Promotion[])
const products = computed(() => (props.section.data.products ?? []) as { id: string, kind: string, slug: string, name: string, short_description: string | null, cover: { url: string, alt: string | null } | null, from_price_minor: number | null }[])
const now = ref(new Date())
useIntervalFn(() => (now.value = new Date()), 60_000)

function discount(p: Promotion) {
  if (p.discount_type === 'percent') return t('sections.offers.percent', { n: p.discount_percent })
  if (p.discount_type === 'free_nights') return t('sections.offers.freeNights', { n: p.discount_free_nights })
  return t('sections.offers.amount', { amount: money(p.discount_amount_minor ?? 0, p.currency ?? 'EUR', { trimZeroCents: true }) })
}
function remaining(end: string | null) {
  if (!end) return ''
  const ms = new Date(end).getTime() - now.value.getTime()
  if (ms <= 0) return ''
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  return t('sections.offers.endsIn', { days, hours })
}
const bases: Record<string, string> = { accommodation: '/stays', activity: '/activities', package: '/packages' }
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <ul v-if="promotions.length" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <li v-for="p in promotions" :key="p.id" class="flex flex-col gap-4 rounded-sm border border-default p-8">
        <UBadge :label="s.badge || discount(p)" color="primary" variant="subtle" class="self-start" />
        <h3 class="text-h3">{{ p.name }}</h3>
        <p v-if="p.description" class="text-muted">{{ p.description }}</p>
        <ClientOnly>
          <p v-if="s.show_countdown && remaining(p.ends_at)" class="text-small text-toned">
            <UIcon name="i-lucide-clock" class="me-2 inline size-4 align-[-2px]" aria-hidden="true" />{{ remaining(p.ends_at) }}
          </p>
        </ClientOnly>
        <UButton :label="text(props.section.content.cta_primary_label) || t('common.book')" :to="localePath('/stays')" class="mt-auto self-start" />
      </li>
    </ul>
    <ul v-else class="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
      <li v-for="card in products" :key="card.id">
        <MzOfferCard :title="card.name" :product-id="card.id" :description="card.short_description ?? undefined" :image="card.cover?.url" :image-alt="card.cover?.alt ?? card.name" :price-from-cents="card.from_price_minor" :label="s.badge || undefined" :to="bases[card.kind] ? localePath(`${bases[card.kind]}/${card.slug}`) : undefined" />
      </li>
    </ul>
  </MzSectionContainer>
</template>
