<script setup lang="ts">
/**
 * Generic card for anything bookable (activity, accommodation, package): image, badges, title,
 * short text, duration, "from" price and a call to action. Data comes from the parent.
 */
export interface OfferBadge { label: string, color?: 'primary' | 'secondary' | 'info' | 'warning' | 'neutral' }

const props = withDefaults(defineProps<{
  title: string
  description?: string
  image?: string
  imageAlt?: string
  to?: string
  /** Lowest price, integer cents. */
  priceFromCents?: number | null
  currency?: string
  priceUnit?: 'night' | 'person'
  durationMinutes?: number | null
  badges?: OfferBadge[]
  ctaLabel?: string
}>(), {
  description: undefined, image: undefined, imageAlt: '', to: undefined, priceFromCents: null, currency: 'EUR',
  priceUnit: undefined, durationMinutes: null, badges: () => [], ctaLabel: undefined,
})

const { t } = useI18n()
const duration = computed(() => {
  const m = props.durationMinutes
  if (!m) return ''
  return m % 60 === 0 ? t('common.hours', { n: m / 60 }) : m > 60 ? `${t('common.hours', { n: Math.floor(m / 60) })} ${t('common.minutes', { n: m % 60 })}` : t('common.minutes', { n: m })
})
</script>

<template>
  <UCard as="article" class="group relative flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-warm" :ui="{ body: 'flex flex-1 flex-col gap-3 p-5 sm:p-5' }">
    <template v-if="props.image" #header>
      <div class="-m-5 sm:-mx-6">
        <MzImage :src="props.image" :alt="props.imageAlt" ratio="4/3" :rounded="false" sizes="100vw sm:50vw lg:33vw" />
      </div>
    </template>

    <div v-if="props.badges.length" class="flex flex-wrap gap-1.5">
      <UBadge v-for="badge in props.badges" :key="badge.label" :label="badge.label" :color="badge.color ?? 'neutral'" variant="soft" />
    </div>
    <h3 class="font-display text-xl font-semibold">
      <NuxtLink v-if="props.to" :to="props.to" class="after:absolute after:inset-0 after:content-['']">{{ props.title }}</NuxtLink>
      <template v-else>{{ props.title }}</template>
    </h3>
    <p v-if="props.description" class="line-clamp-3 text-muted">{{ props.description }}</p>

    <div class="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
      <div class="flex flex-col gap-1">
        <span v-if="duration" class="inline-flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-clock" class="size-4" aria-hidden="true" />{{ duration }}
        </span>
        <MzPrice v-if="props.priceFromCents != null" :cents="props.priceFromCents" :currency="props.currency" :unit="props.priceUnit" from trim-zero-cents />
      </div>
      <UButton
        v-if="props.to"
        :label="props.ctaLabel ?? t('common.learnMore')"
        trailing-icon="i-lucide-arrow-right"
        variant="soft"
        tabindex="-1"
        aria-hidden="true"
        :ui="{ trailingIcon: 'rtl:rotate-180' }"
        class="pointer-events-none"
      />
    </div>
  </UCard>
</template>
