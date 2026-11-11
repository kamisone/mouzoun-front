<script setup lang="ts">
const { t } = useI18n()
const { site } = useAppConfig()

useSeo({ title: () => t('home.seoTitle'), description: () => t('home.seoDescription') })

const features = computed(() => [
  { id: 'stay', icon: 'i-lucide-tent', title: t('home.featureCamp'), description: t('home.featureCampText') },
  { id: 'farm', icon: 'i-lucide-sprout', title: t('home.featureFarm'), description: t('home.featureFarmText') },
  { id: 'village', icon: 'i-lucide-house', title: t('home.featureVillage'), description: t('home.featureVillageText') },
])
</script>

<template>
  <div>
    <MzHero :eyebrow="t('home.eyebrow')" :title="t('home.title')" :description="t('home.subtitle')" height="md">
      <template #actions>
        <UButton :label="t('home.discover')" size="xl" to="#stay" trailing-icon="i-lucide-arrow-down" />
      </template>
    </MzHero>

    <MzSection id="activities" :eyebrow="t('home.featuresEyebrow')" :title="t('home.featuresTitle')" :description="t('home.featuresDescription')">
      <MzGrid :cols="3">
        <div v-for="feature in features" :id="feature.id" :key="feature.id" class="scroll-mt-(--ui-header-height)">
          <MzFeatureCard :icon="feature.icon" :title="feature.title" :description="feature.description" />
        </div>
      </MzGrid>
    </MzSection>

    <MzSection tone="muted" :title="t('map.title')" :level="2" size="narrow">
      <MzMapEmbed :lat="site.location.lat" :lng="site.location.lng" :title="t('map.title')" />
    </MzSection>

    <MzSection>
      <MzCtaBanner :title="t('home.ctaTitle')" :description="t('home.ctaText')">
        <UButton :label="t('common.book')" size="lg" color="neutral" variant="solid" to="#contact" />
      </MzCtaBanner>
    </MzSection>
  </div>
</template>
