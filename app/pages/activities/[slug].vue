<script setup lang="ts">
const route = useRoute()
const { locale } = useI18n()
const { data: activity, error } = await useActivity(String(route.params.slug))

if (error.value || !activity.value) {
  throw createError({ statusCode: 404, statusMessage: 'Activity not found' })
}

const title = computed(() => (locale.value === 'en' ? activity.value!.title_en : activity.value!.title_fr))
const description = computed(() =>
  locale.value === 'en' ? activity.value!.description_en : activity.value!.description_fr,
)

useSeoMeta({
  title: () => `${title.value} — Mouzoun`,
  description: () => description.value.slice(0, 160),
  ogImage: () => activity.value?.cover_image_url ?? undefined,
})
</script>

<template>
  <article v-if="activity" class="mx-auto max-w-4xl px-4 py-16">
    <img
      v-if="activity.cover_image_url"
      :src="activity.cover_image_url"
      :alt="title"
      class="mb-8 aspect-[16/9] w-full rounded-2xl object-cover"
    />
    <h1 class="text-4xl font-bold">{{ title }}</h1>
    <p class="mt-2 text-oasis-600">
      {{ $t('activity.from') }} {{ activity.price_mad }} MAD · {{ Math.round(activity.duration_minutes / 60) }} h
    </p>
    <div class="mt-8 whitespace-pre-line leading-relaxed">{{ description }}</div>
  </article>
</template>
