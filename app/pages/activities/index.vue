<script setup lang="ts">
import type { ProductCard } from '~/utils/booking-types'

/** Activities and packages: image-first cards with duration and "from" price. */
const { t } = useI18n()
const localePath = useLocalePath()
const api = useBookingApi()
useSeo({ title: () => `${t('booking.activities.title')} · ${t('common.siteName')}`, description: () => t('booking.activities.description') })

const { data: activities } = await useAsyncData('activities-list', () => api.products({ kind: 'activity' }).catch(() => [] as ProductCard[]), { default: () => [] })
const { data: packages } = await useAsyncData('packages-list', () => api.products({ kind: 'package' }).catch(() => [] as ProductCard[]), { default: () => [] })
</script>

<template>
  <div>
    <MzContainer class="flex flex-col gap-3 pt-12 lg:pt-16">
      <p class="eyebrow">{{ t('booking.activities.eyebrow') }}</p>
      <h1 class="text-display-lg">{{ t('booking.activities.title') }}</h1>
      <p class="max-w-editorial text-body-lg text-muted">{{ t('booking.activities.description') }}</p>
    </MzContainer>
    <MzSection :title="t('booking.activities.experiences')" space="md">
      <MzGrid :cols="3">
        <MzOfferCard
          v-for="a in activities"
          :key="a.id"
          :title="a.name"
          :description="a.short_description ?? undefined"
          :image="a.cover?.url"
          :image-alt="a.cover?.alt ?? a.name"
          :to="localePath(`/activities/${a.slug}`)"
          :price-from-cents="a.from_price_minor"
          price-unit="person"
          :duration-minutes="a.facts.duration_minutes ?? null"
        />
      </MzGrid>
    </MzSection>
    <MzSection v-if="packages.length" tone="sand" :eyebrow="t('booking.activities.packagesEyebrow')" :title="t('booking.activities.packages')" space="md">
      <MzGrid :cols="3">
        <MzOfferCard
          v-for="p in packages"
          :key="p.id"
          :title="p.name"
          :description="p.short_description ?? undefined"
          :image="p.cover?.url"
          :image-alt="p.cover?.alt ?? p.name"
          :to="localePath(`/packages/${p.slug}`)"
          :price-from-cents="p.from_price_minor"
          price-unit="person"
        />
      </MzGrid>
    </MzSection>
  </div>
</template>
