<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const { data: activities } = await useActivities()

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
        <NuxtLink
          :to="localePath('/activities')"
          class="mt-10 inline-block rounded-full bg-terracotta-500 px-8 py-3 font-semibold text-white hover:bg-terracotta-600"
        >
          {{ $t('home.cta') }}
        </NuxtLink>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16">
      <h2 class="mb-8 text-2xl font-bold">{{ $t('home.featured') }}</h2>
      <div v-if="activities?.length" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ActivityCard v-for="a in activities.slice(0, 6)" :key="a.id" :activity="a" />
      </div>
      <p v-else class="text-night-900/60">{{ $t('activity.empty') }}</p>
    </section>
  </div>
</template>
