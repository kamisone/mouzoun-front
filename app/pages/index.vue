<script setup lang="ts">
/** Demo home page: the editorial section templates with placeholder copy and photography. */
definePageMeta({ headerOverlay: true })

const { t } = useI18n()
const { photo } = usePhoto()
const { site } = useAppConfig()

useSeo({ title: () => t('home.seoTitle'), description: () => t('home.seoDescription'), image: () => photo('hero-dunes').src })

const hero = computed(() => photo('hero-dunes'))
const tent = computed(() => photo('nomad-tent'))
const farm = computed(() => photo('farm-fields'))
const night = computed(() => photo('night-sky'))

const experiences = computed(() => [
  { title: t('home.quadTitle'), description: t('home.quadText'), photo: photo('quads'), duration: 60, price: 4500, label: t('home.guided') },
  { title: t('home.camelTitle'), description: t('home.camelText'), photo: photo('caravan'), duration: 90, price: 2500, label: undefined },
  { title: t('home.villageTitle'), description: t('home.villageText'), photo: photo('ksar'), duration: 150, price: 1500, label: t('home.guided') },
])

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
      :lqip="hero.lqip"
      next="intro"
    >
      <template #actions>
        <UButton :label="t('home.cta')" size="lg" to="#book" />
      </template>
    </MzHero>

    <section id="intro" class="py-24 lg:py-40">
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
        <NuxtLink to="#book" class="link-underline text-small font-medium text-highlighted">{{ t('home.stayLink') }}</NuxtLink>
      </template>
    </MzEditorialSplit>

    <MzEditorialSplit id="farm" reverse :eyebrow="t('home.farmEyebrow')" :title="t('home.farmTitle')" :image="farm.src" :image-srcset="farm.srcset" :image-alt="farm.alt" :lqip="farm.lqip" ratio="3/2">
      <p>{{ t('home.farmText1') }}</p>
      <p>{{ t('home.farmText2') }}</p>
      <template #actions>
        <NuxtLink to="#practical" class="link-underline text-small font-medium text-highlighted">{{ t('home.farmLink') }}</NuxtLink>
      </template>
    </MzEditorialSplit>

    <MzSection id="experiences" :eyebrow="t('home.experiencesEyebrow')" :title="t('home.experiencesTitle')" tone="sand">
      <MzGrid :cols="3">
        <MzReveal v-for="(item, i) in experiences" :key="item.title" :index="i">
          <MzOfferCard
            :title="item.title"
            :description="item.description"
            :image="item.photo.src"
            :image-srcset="item.photo.srcset"
            :image-alt="item.photo.alt"
            :lqip="item.photo.lqip"
            :duration-minutes="item.duration"
            :price-from-cents="item.price"
            price-unit="person"
            :label="item.label"
            to="#book"
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
        <UButton :label="t('home.cta')" size="lg" :to="site.email ? `mailto:${site.email}` : '#contact'" />
        <NuxtLink to="#contact" class="link-underline self-center text-small font-medium text-highlighted">{{ t('home.ctaSecondary') }}</NuxtLink>
      </MzCtaBanner>
    </div>
  </div>
</template>
