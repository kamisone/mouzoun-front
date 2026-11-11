<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('home.seoTitle'),
  description: () => t('home.seoDescription'),
  ogTitle: () => t('home.seoTitle'),
  ogDescription: () => t('home.seoDescription'),
})
</script>

<template>
  <div>
    <section class="bg-gradient-to-b from-sand-100 to-sand-50">
      <div class="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 class="text-4xl font-bold tracking-tight md:text-6xl">{{ $t('home.title') }}</h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg text-night-900/70">{{ $t('home.subtitle') }}</p>
      </div>
    </section>
  </div>
</template>
