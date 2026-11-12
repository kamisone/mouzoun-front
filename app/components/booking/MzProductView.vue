<script setup lang="ts">
import type { ProductPage } from '~/utils/booking-types'

/**
 * Body of an accommodation, activity or package page: gallery, key facts, description,
 * highlights, included / not included, amenities by group, beds, programme, practical rules,
 * meeting point or location with directions, reviews, FAQ, related products — with the sticky
 * booking widget beside it. Structured data (schema.org) is added for search engines.
 */
const props = defineProps<{ product: ProductPage }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const { track } = useAnalytics()
onMounted(() => track('view_item', { items: [{ item_id: props.product.id, item_name: props.product.name, item_category: props.product.kind }] }))

const p = computed(() => props.product)
const gallery = computed(() => (p.value.gallery.length ? p.value.gallery : p.value.cover ? [p.value.cover] : []))
const minutes = (n: number | null | undefined) => (n ? (n % 60 === 0 ? t('common.hours', { n: n / 60 }) : t('common.minutes', { n })) : null)

const facts = computed(() => {
  const out: { icon: string, label: string }[] = []
  const a = p.value.accommodation
  if (a) {
    out.push({ icon: 'i-lucide-users', label: t('booking.facts.sleeps', { n: a.max_guests }) })
    if (a.surface_m2) out.push({ icon: 'i-lucide-ruler', label: t('booking.facts.surface', { n: Number(a.surface_m2) }) })
    for (const bed of a.beds ?? []) out.push({ icon: 'i-lucide-bed-double', label: t(`booking.beds.${bed.type}`, { n: bed.count }, bed.count) })
    if (a.min_nights > 1) out.push({ icon: 'i-lucide-moon', label: t('booking.facts.minNights', { n: a.min_nights }, a.min_nights) })
  }
  const act = p.value.activity
  if (act) {
    const d = minutes(act.duration_minutes)
    if (d) out.push({ icon: 'i-lucide-clock', label: d })
    if (act.difficulty) out.push({ icon: 'i-lucide-mountain', label: t(`booking.difficulty.${act.difficulty}`) })
    if (act.min_age) out.push({ icon: 'i-lucide-baby', label: t('booking.facts.minAge', { n: act.min_age }) })
    if (act.guide_languages.length) {
      const names = act.guide_languages.map(l => new Intl.DisplayNames([locale.value], { type: 'language' }).of(l) ?? l)
      out.push({ icon: 'i-lucide-languages', label: names.join(', ') })
    }
    out.push({ icon: 'i-lucide-zap', label: act.scheduling_mode === 'on_request' ? t('booking.facts.onRequest') : t('booking.facts.instant') })
  }
  const pk = p.value.package
  if (pk?.duration_days) out.push({ icon: 'i-lucide-calendar-days', label: t('booking.facts.days', { days: pk.duration_days, nights: pk.duration_nights ?? 0 }) })
  return out
})

const amenityGroups = computed(() => {
  const groups = new Map<string, ProductPage['amenities']>()
  for (const a of p.value.amenities) groups.set(a.group, [...(groups.get(a.group) ?? []), a])
  return [...groups.entries()]
})
const programme = computed(() => {
  const days = new Map<number, { title: string | null, description: string | null }[]>()
  for (const s of p.value.itinerary) days.set(s.day, [...(days.get(s.day) ?? []), s])
  for (const i of p.value.package?.items ?? []) {
    if (i.day_number && !p.value.itinerary.length) days.set(i.day_number, [...(days.get(i.day_number) ?? []), { title: i.name, description: null }])
  }
  return [...days.entries()].sort((a, b) => a[0] - b[0])
})
const mapsUrl = computed(() => (p.value.place?.latitude && p.value.place.longitude
  ? `https://www.google.com/maps/search/?api=1&query=${p.value.place.latitude},${p.value.place.longitude}`
  : null))

// schema.org: Campground / LodgingBusiness, TouristTrip, Product + Offer, ratings, FAQ, breadcrumb.
const siteUrl = computed(() => (config.public.i18n as { baseUrl?: string })?.baseUrl ?? '')
const listPath = computed(() => ({ accommodation: '/stays', activity: '/activities', package: '/packages' } as Record<string, string>)[p.value.kind] ?? '/')
useHead(() => ({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': p.value.kind === 'accommodation' ? ['Product', 'Accommodation'] : p.value.kind === 'activity' ? ['Product', 'TouristTrip'] : ['Product', 'TouristTrip'],
        'name': p.value.name,
        'description': p.value.seo_description ?? p.value.short_description ?? undefined,
        'image': gallery.value.map(g => g.url),
        ...(p.value.from_price_minor ? { offers: { '@type': 'Offer', 'priceCurrency': 'EUR', 'price': (p.value.from_price_minor / 100).toFixed(2), 'availability': 'https://schema.org/InStock', 'url': `${siteUrl.value}${useRoute().path}` } } : {}),
        ...(p.value.rating ? { aggregateRating: { '@type': 'AggregateRating', 'ratingValue': p.value.rating.average, 'reviewCount': p.value.rating.count } } : {}),
        ...(p.value.kind === 'accommodation' ? { containedInPlace: { '@type': 'Campground', 'name': t('common.siteName'), 'geo': { '@type': 'GeoCoordinates', 'latitude': 31.238933, 'longitude': -4.701349 } } } : {}),
      },
      ...(p.value.faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': p.value.faqs.map(f => ({ '@type': 'Question', 'name': f.question, 'acceptedAnswer': { '@type': 'Answer', 'text': f.answer } })) }] : []),
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': t('common.siteName'), 'item': `${siteUrl.value}${localePath('/')}` },
          { '@type': 'ListItem', 'position': 2, 'name': t(`booking.lists.${p.value.kind}`), 'item': `${siteUrl.value}${localePath(listPath.value)}` },
          { '@type': 'ListItem', 'position': 3, 'name': p.value.name },
        ],
      },
    ]),
  }],
}))
</script>

<template>
  <article class="pb-24 lg:pb-0">
    <MzContainer class="pt-8 lg:pt-12">
      <nav :aria-label="t('booking.breadcrumb')" class="pb-6 text-small text-muted">
        <ol class="flex flex-wrap items-center gap-2">
          <li><NuxtLink :to="localePath('/')" class="hover:text-highlighted">{{ t('common.siteName') }}</NuxtLink></li>
          <li aria-hidden="true">/</li>
          <li><NuxtLink :to="localePath(listPath)" class="hover:text-highlighted">{{ t(`booking.lists.${p.kind}`) }}</NuxtLink></li>
        </ol>
      </nav>
      <header class="flex flex-col gap-3 pb-8">
        <h1 class="text-display-lg">{{ p.name }}</h1>
        <p v-if="p.subtitle" class="text-body-lg text-muted">{{ p.subtitle }}</p>
        <p v-if="p.rating" class="flex items-center gap-2 text-small text-highlighted">
          <UIcon name="i-lucide-star" class="size-4" aria-hidden="true" />
          {{ t('booking.reviews.score', { score: p.rating.average, n: p.rating.count }, p.rating.count) }}
        </p>
      </header>
    </MzContainer>

    <MzContainer v-if="gallery.length">
      <div class="grid gap-2 lg:grid-cols-4 lg:grid-rows-2">
        <MzImage
          v-for="(img, i) in gallery.slice(0, 5)"
          :key="img.id"
          :src="img.url"
          :alt="img.alt ?? p.name"
          :ratio="i === 0 ? '4/3' : '1/1'"
          :priority="i === 0"
          sizes="xs:100vw lg:50vw"
          rounded
          :class="i === 0 ? 'lg:col-span-2 lg:row-span-2' : 'hidden lg:block'"
        />
      </div>
    </MzContainer>

    <MzContainer class="grid gap-12 pt-12 lg:grid-cols-12 lg:gap-16">
      <div class="flex flex-col gap-16 lg:col-span-7">
        <ul v-if="facts.length" class="flex flex-wrap gap-x-8 gap-y-3 border-b border-default pb-8">
          <li v-for="f in facts" :key="f.label" class="flex items-center gap-2 text-body text-highlighted">
            <UIcon :name="f.icon" class="size-5 text-muted" aria-hidden="true" />{{ f.label }}
          </li>
        </ul>

        <section v-if="p.description || p.highlights.length" class="max-w-editorial">
          <h2 class="sr-only">{{ t('booking.sections.about') }}</h2>
          <ul v-if="p.highlights.length" class="flex flex-col gap-3 pb-6">
            <li v-for="h in p.highlights" :key="h" class="flex gap-3 text-body-lg text-highlighted">
              <UIcon name="i-lucide-sparkle" class="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />{{ h }}
            </li>
          </ul>
          <p v-if="p.description" class="whitespace-pre-line text-body">{{ p.description }}</p>
        </section>

        <section v-if="p.included.length || p.not_included.length" class="grid gap-8 sm:grid-cols-2">
          <div v-if="p.included.length">
            <h2 class="text-h3 pb-4">{{ t('booking.sections.included') }}</h2>
            <ul class="flex flex-col gap-2">
              <li v-for="x in p.included" :key="x" class="flex gap-2"><UIcon name="i-lucide-check" class="mt-1 size-4 text-success" aria-hidden="true" />{{ x }}</li>
            </ul>
          </div>
          <div v-if="p.not_included.length">
            <h2 class="text-h3 pb-4">{{ t('booking.sections.notIncluded') }}</h2>
            <ul class="flex flex-col gap-2 text-muted">
              <li v-for="x in p.not_included" :key="x" class="flex gap-2"><UIcon name="i-lucide-x" class="mt-1 size-4" aria-hidden="true" />{{ x }}</li>
            </ul>
          </div>
        </section>

        <section v-if="amenityGroups.length">
          <h2 class="text-h2 pb-6">{{ t('booking.sections.amenities') }}</h2>
          <div class="grid gap-8 sm:grid-cols-2">
            <div v-for="[group, list] in amenityGroups" :key="group">
              <h3 class="eyebrow pb-3">{{ t(`booking.amenityGroups.${group}`, group) }}</h3>
              <ul class="flex flex-col gap-2">
                <li v-for="a in list" :key="a.code" class="flex items-center gap-2">
                  <UIcon :name="a.icon ?? 'i-lucide-check'" class="size-4 text-muted" aria-hidden="true" />{{ a.name }}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section v-if="programme.length">
          <h2 class="text-h2 pb-6">{{ t('booking.sections.programme') }}</h2>
          <ol class="flex flex-col gap-6 border-s border-default ps-6">
            <li v-for="[day, steps] in programme" :key="day">
              <p class="eyebrow pb-2">{{ t('booking.sections.day', { n: day }) }}</p>
              <ul class="flex flex-col gap-2">
                <li v-for="(s, i) in steps" :key="i">
                  <p class="font-medium text-highlighted">{{ s.title }}</p>
                  <p v-if="s.description" class="text-small text-muted">{{ s.description }}</p>
                </li>
              </ul>
            </li>
          </ol>
        </section>

        <section v-if="p.what_to_bring.length || p.requirements || p.important_info || p.accommodation?.check_in_from" class="flex flex-col gap-6">
          <h2 class="text-h2">{{ t('booking.sections.practical') }}</h2>
          <dl class="grid gap-6 sm:grid-cols-2">
            <div v-if="p.accommodation?.check_in_from">
              <dt class="eyebrow pb-1">{{ t('booking.sections.checkInOut') }}</dt>
              <dd>{{ t('booking.calendar.times', { in: p.accommodation.check_in_from.slice(0, 5), out: (p.accommodation.check_out_until ?? '12:00').slice(0, 5) }) }}</dd>
            </div>
            <div v-if="p.what_to_bring.length">
              <dt class="eyebrow pb-1">{{ t('booking.sections.bring') }}</dt>
              <dd>{{ p.what_to_bring.join(', ') }}</dd>
            </div>
            <div v-if="p.requirements">
              <dt class="eyebrow pb-1">{{ t('booking.sections.requirements') }}</dt>
              <dd class="whitespace-pre-line">{{ p.requirements }}</dd>
            </div>
            <div v-if="p.important_info">
              <dt class="eyebrow pb-1">{{ t('booking.sections.important') }}</dt>
              <dd class="whitespace-pre-line">{{ p.important_info }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="p.place">
          <h2 class="text-h2 pb-4">{{ p.place.is_meeting_point ? t('booking.sections.meetingPoint') : t('booking.sections.location') }}</h2>
          <p class="font-medium text-highlighted">{{ p.place.name }}</p>
          <p v-if="p.place.directions" class="whitespace-pre-line pt-2 text-muted">{{ p.place.directions }}</p>
          <a v-if="mapsUrl" :href="mapsUrl" target="_blank" rel="noopener" class="link-underline mt-4 inline-block text-small font-medium text-highlighted">{{ t('common.openInMaps') }}</a>
        </section>

        <section v-if="p.reviews.length">
          <h2 class="text-h2 pb-6">{{ t('booking.sections.reviews') }}</h2>
          <ul class="flex flex-col gap-8">
            <li v-for="r in p.reviews" :key="r.id" class="flex flex-col gap-2 border-b border-default pb-8">
              <p class="flex items-center gap-2 text-small text-muted">
                <span class="font-medium text-highlighted">{{ r.author_name }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ t('booking.reviews.rating', { n: r.rating }) }}</span>
                <UBadge v-if="r.verified" :label="t('booking.reviews.verified')" color="success" variant="subtle" size="sm" />
              </p>
              <p v-if="r.title" class="font-medium text-highlighted">{{ r.title }}</p>
              <p v-if="r.body" class="text-body">{{ r.body }}</p>
              <p v-if="r.reply" class="border-s border-default ps-4 text-small text-muted">{{ r.reply }}</p>
            </li>
          </ul>
        </section>

        <section v-if="p.faqs.length">
          <h2 class="text-h2 pb-4">{{ t('booking.sections.faq') }}</h2>
          <UAccordion :items="p.faqs.map(f => ({ label: f.question, content: f.answer }))" />
        </section>
      </div>

      <div class="lg:col-span-5">
        <MzBookingWidget :product="p" />
      </div>
    </MzContainer>

    <MzSection v-if="p.related.length" :eyebrow="t('booking.sections.relatedEyebrow')" :title="p.kind === 'accommodation' ? t('booking.sections.relatedStay') : t('booking.sections.related')">
      <MzGrid :cols="3">
        <MzOfferCard
          v-for="r in p.related.slice(0, 3)"
          :key="r.id"
          :title="r.name"
          :to="localePath(`${({ accommodation: '/stays', activity: '/activities', package: '/packages' } as Record<string, string>)[r.kind] ?? ''}/${r.slug}`)"
          :image="r.cover?.url"
          :image-alt="r.cover?.alt ?? r.name"
          :description="r.short_description ?? undefined"
          :price-from-cents="r.from_price_minor"
          :price-unit="r.kind === 'accommodation' ? 'night' : 'person'"
          :duration-minutes="r.facts.duration_minutes ?? null"
        />
      </MzGrid>
    </MzSection>
  </article>
</template>
