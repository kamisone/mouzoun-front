<script setup lang="ts">
import type { Activity } from '~/utils/types'

const props = defineProps<{ activity: Activity }>()
const { locale } = useI18n()
const localePath = useLocalePath()
const title = computed(() => (locale.value === 'en' ? props.activity.title_en : props.activity.title_fr))
</script>

<template>
  <NuxtLink
    :to="localePath(`/activities/${activity.slug}`)"
    class="group block overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md"
  >
    <div class="aspect-[4/3] bg-sand-100">
      <img
        v-if="activity.cover_image_url"
        :src="activity.cover_image_url"
        :alt="title"
        loading="lazy"
        class="h-full w-full object-cover transition group-hover:scale-105"
      />
    </div>
    <div class="p-4">
      <h3 class="font-semibold">{{ title }}</h3>
      <p class="mt-1 text-sm text-oasis-600">
        {{ $t('activity.from') }} {{ activity.price_mad }} MAD · {{ Math.round(activity.duration_minutes / 60) }} h
      </p>
    </div>
  </NuxtLink>
</template>
