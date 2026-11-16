<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

interface Review { id: string, author_name: string, author_country: string | null, rating: number, title: string | null, body: string | null }

/** Approved reviews and the average rating (the API adds the AggregateRating structured data). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t, locale } = useI18n()
const { text } = useSectionContext(() => props.section)
const reviews = computed(() => (props.section.data.reviews ?? []) as Review[])
const summary = computed(() => props.section.data.summary as { average: number | null, count: number } | undefined)
const country = (code: string | null) => (code ? new Intl.DisplayNames([locale.value], { type: 'region' }).of(code) : undefined)
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <p v-if="props.section.settings.show_summary && summary?.count" class="-mt-8 mb-12 flex items-center gap-2 text-body-lg">
      <UIcon name="i-lucide-star" class="size-5 text-primary" aria-hidden="true" />
      {{ t('sections.rating', { average: summary.average?.toLocaleString(locale), count: summary.count }) }}
    </p>
    <MzCarousel v-if="props.section.settings.layout !== 'grid'" :count="reviews.length" :label="text(props.section.content.title) || t('sections.reviews')" slide-class="basis-full md:basis-1/2">
      <template #default="{ index: i }">
        <MzTestimonial :quote="reviews[i]!.body || reviews[i]!.title || ''" :author="reviews[i]!.author_name" :origin="country(reviews[i]!.author_country)" :rating="reviews[i]!.rating" />
      </template>
    </MzCarousel>
    <ul v-else class="grid gap-12 md:grid-cols-2">
      <li v-for="r in reviews" :key="r.id">
        <MzTestimonial :quote="r.body || r.title || ''" :author="r.author_name" :origin="country(r.author_country)" :rating="r.rating" />
      </li>
    </ul>
  </MzSectionContainer>
</template>
