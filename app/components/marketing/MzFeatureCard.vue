<script setup lang="ts">
/** Icon + title + text, optionally a link (the whole card is clickable, one link only). */
const props = withDefaults(defineProps<{
  icon: string
  title: string
  description?: string
  to?: string
}>(), { description: undefined, to: undefined })
</script>

<template>
  <UCard class="relative h-full transition-shadow duration-200 has-[a:hover]:shadow-warm">
    <span class="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <UIcon :name="props.icon" class="size-6" aria-hidden="true" />
    </span>
    <h3 class="font-display text-lg font-semibold">
      <NuxtLink v-if="props.to" :to="props.to" class="after:absolute after:inset-0 after:content-['']">{{ props.title }}</NuxtLink>
      <template v-else>{{ props.title }}</template>
    </h3>
    <p v-if="props.description" class="mt-2 text-muted">{{ props.description }}</p>
    <slot />
  </UCard>
</template>
