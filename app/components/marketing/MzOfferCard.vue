<script setup lang="ts">
/**
 * An activity, stay or package: image first (4:5 or 3:2), no border or shadow, serif title,
 * one line of meta (duration · from price), slow 1.03 image zoom on hover. Whole card is one link.
 */
const props = withDefaults(defineProps<{
  title: string
  description?: string
  image?: string
  imageSrcset?: string
  imageAlt?: string
  lqip?: string
  ratio?: '4/5' | '3/2'
  to?: string
  /** Lowest price, integer cents. */
  priceFromCents?: number | null
  currency?: string
  priceUnit?: 'night' | 'person'
  durationMinutes?: number | null
  /** One short label shown first in the meta line (e.g. "Guidé"): titles stay aligned. */
  label?: string
  /** Shows the wishlist heart over the image. */
  productId?: string
}>(), {
  description: undefined, image: undefined, imageSrcset: undefined, imageAlt: '', lqip: undefined, ratio: '4/5', to: undefined, priceFromCents: null,
  currency: 'EUR', priceUnit: undefined, durationMinutes: null, label: undefined, productId: undefined,
})

const { t } = useI18n()
const duration = computed(() => {
  const m = props.durationMinutes
  if (!m) return ''
  return m % 60 === 0 ? t('common.hours', { n: m / 60 }) : m > 60 ? `${t('common.hours', { n: Math.floor(m / 60) })} ${t('common.minutes', { n: m % 60 })}` : t('common.minutes', { n: m })
})
</script>

<template>
  <article class="group relative flex h-full flex-col">
    <MzImage v-if="props.image" :src="props.image" :srcset="props.imageSrcset" :alt="props.imageAlt" :lqip="props.lqip" :ratio="props.ratio" zoom sizes="xs:100vw md:50vw lg:33vw" />
    <ClientOnly v-if="props.productId">
      <MzWishlistButton :product-id="props.productId" :name="props.title" overlay class="absolute end-3 top-3 z-10" />
    </ClientOnly>
    <div class="flex flex-1 flex-col pt-6">
      <h3 class="text-h3">
        <NuxtLink v-if="props.to" :to="props.to" class="after:absolute after:inset-0 after:content-['']">{{ props.title }}</NuxtLink>
        <template v-else>{{ props.title }}</template>
      </h3>
      <p v-if="props.description" class="mt-2 line-clamp-2 text-small text-muted">{{ props.description }}</p>
      <p v-if="props.label || duration || props.priceFromCents != null" class="mt-4 flex flex-wrap items-baseline gap-x-2 text-small text-toned">
        <template v-if="props.label">
          <span>{{ props.label }}</span>
          <span v-if="duration || props.priceFromCents != null" aria-hidden="true">·</span>
        </template>
        <span v-if="duration">{{ duration }}</span>
        <span v-if="duration && props.priceFromCents != null" aria-hidden="true">·</span>
        <MzPrice v-if="props.priceFromCents != null" :cents="props.priceFromCents" :currency="props.currency" :unit="props.priceUnit" from trim-zero-cents size="sm" />
      </p>
    </div>
  </article>
</template>
