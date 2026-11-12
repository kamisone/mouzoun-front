<script setup lang="ts">
/**
 * Home page. Every "book" button leads into online booking (the stays search); booking is never
 * done by email. Experiences come from the catalogue (real prices, real pages).
 */
definePageMeta({ headerOverlay: true })

const { t } = useI18n()
const { photo } = usePhoto()
const { site } = useAppConfig()
const localePath = useLocalePath()
const api = useBookingApi()
const bookTo = computed(() => localePath('/stays'))

useSeo({ title: () => t('home.seoTitle'), description: () => t('home.seoDescription'), image: () => photo('hero-dunes').src })

const hero = computed(() => photo('hero-dunes'))
const tent = computed(() => photo('nomad-tent'))
const farm = computed(() => photo('farm-fields'))
const night = computed(() => photo('night-sky'))

// Featured activities first, three at most; the section is hidden when there are none.
const { data: activities } = await useAsyncData('home-activities', () => api.products({ kind: 'activity' }).catch(() => []), { default: () => [] })
const experiences = computed(() =>
  [...activities.value].sort((a, b) => Number(b.is_featured) - Number(a.is_featured)).slice(0, 3),
)

const facts = computed(() => [
  { value: '6', label: t('home.factTents') },
  { value: '20', label: t('home.factPitches') },
  { value: '45', label: t('home.factRissani') },
  { value: '1', label: t('home.factFarm') },
])

const gallery = computed(() =>
  (['oasis', 'mint-tea', 'host', 'sunset-ripples', 'camp'] as const).map((slug) => {
    const p = photo(slug)
    return { src: p.src, srcset: p.srcset, alt: p.alt, lqip: p.lqip }
  }),
)

const practical = computed(() => [
  { title: t('home.practicalAccess'), text: t('home.practicalAccessText') },
  { title: t('home.practicalArrival'), text: t('home.practicalArrivalText') },
  { title: t('home.practicalSeason'), text: t('home.practicalSeasonText') },
  { title: t('home.practicalBring'), text: t('home.practicalBringText') },
])
</script>

<template>
  <div>
    <MzHero
      :eyebrow="t('home.eyebrow')"
      :title="t('home.title')"
      :description="t('home.subtitle')"
      :image="hero.src"
      :image-srcset="hero.srcset"
      :image-alt="hero.alt"
      :lqip="hero.lqip"
      next="intro"
    >
      <template #actions>
        <UButton :label="t('home.cta')" size="lg" :to="bookTo" />
      </template>
    </MzHero>

    <section id="intro" class="pt-24 pb-12 lg:pt-40 lg:pb-16">
      <MzContainer class="grid gap-8 lg:grid-cols-12">
        <MzReveal class="lg:col-span-3">
          <p class="eyebrow">{{ t('home.introEyebrow') }}</p>
        </MzReveal>
        <MzReveal :index="1" class="lg:col-span-8 lg:col-start-5">
          <h2 class="text-display-lg text-balance">{{ t('home.introTitle') }}</h2>
          <p class="mt-8 max-w-editorial text-body-lg text-muted">{{ t('home.introText') }}</p>
        </MzReveal>
      </MzContainer>
    </section>

    <MzEditorialSplit id="stay" :eyebrow="t('home.stayEyebrow')" :title="t('home.stayTitle')" :image="tent.src" :image-srcset="tent.srcset" :image-alt="tent.alt" :lqip="tent.lqip">
      <p>{{ t('home.stayText1') }}</p>
      <p>{{ t('home.stayText2') }}</p>
      <template #actions>
        <NuxtLink :to="bookTo" class="link-underline text-small font-medium text-highlighted">{{ t('home.stayLink') }}</NuxtLink>
      </template>
    </MzEditorialSplit>

    <MzEditorialSplit id="farm" reverse :eyebrow="t('home.farmEyebrow')" :title="t('home.farmTitle')" :image="farm.src" :image-srcset="farm.srcset" :image-alt="farm.alt" :lqip="farm.lqip" ratio="3/2">
      <p>{{ t('home.farmText1') }}</p>
      <p>{{ t('home.farmText2') }}</p>
      <template #actions>
        <NuxtLink to="#practical" class="link-underline text-small font-medium text-highlighted">{{ t('home.farmLink') }}</NuxtLink>
      </template>
    </MzEditorialSplit>

    <MzSection v-if="experiences.length" id="experiences" :eyebrow="t('home.experiencesEyebrow')" :title="t('home.experiencesTitle')" tone="sand">
      <MzGrid :cols="3">
        <MzReveal v-for="(item, i) in experiences" :key="item.id" :index="i">
          <MzOfferCard
            :title="item.name"
            :product-id="item.id"
            :description="item.short_description ?? undefined"
            :image="item.cover?.url"
            :image-alt="item.cover?.alt ?? item.name"
            :duration-minutes="item.facts.duration_minutes ?? null"
            :price-from-cents="item.from_price_minor"
            price-unit="person"
            :label="item.facts.is_guided ? t('home.guided') : undefined"
            :to="localePath(`/activities/${item.slug}`)"
          />
        </MzReveal>
      </MzGrid>
    </MzSection>

    <MzQuoteImage :quote="t('home.quote')" :author="t('home.quoteAuthor')" :origin="t('home.quoteOrigin')" :image="night.src" :image-srcset="night.srcset" :lqip="night.lqip" />

    <MzSection :title="t('home.factsTitle')" space="md">
      <MzFacts :facts="facts" />
    </MzSection>

    <MzSection :eyebrow="t('home.galleryEyebrow')" :title="t('home.galleryTitle')" space="md">
      <MzGallery :images="gallery" />
    </MzSection>

    <MzSection id="practical" :eyebrow="t('home.practicalEyebrow')" :title="t('home.practicalTitle')">
      <MzPracticalInfo :lat="site.location.lat" :lng="site.location.lng" :items="practical" :preview="photo('oasis')" />
    </MzSection>

    <div id="book">
      <MzCtaBanner :eyebrow="t('home.ctaEyebrow')" :title="t('home.ctaTitle')" :description="t('home.ctaText')">
        <UButton :label="t('home.cta')" size="lg" :to="bookTo" data-testid="home-book" />
        <NuxtLink to="#contact" class="link-underline self-center text-small font-medium text-highlighted">{{ t('home.ctaSecondary') }}</NuxtLink>
      </MzCtaBanner>
    </div>
  </div>
</template>
