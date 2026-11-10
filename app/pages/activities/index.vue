<script setup lang="ts">
const { t } = useI18n()
const { data: activities } = await useActivities()
useSeoMeta({ title: () => `${t('nav.activities')} — Mouzoun` })
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-16">
    <h1 class="mb-8 text-3xl font-bold">{{ $t('nav.activities') }}</h1>
    <div v-if="activities?.length" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <ActivityCard v-for="a in activities" :key="a.id" :activity="a" />
    </div>
    <p v-else class="text-night-900/60">{{ $t('activity.empty') }}</p>
  </section>
</template>
