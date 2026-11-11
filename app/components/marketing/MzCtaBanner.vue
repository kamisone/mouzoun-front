<script setup lang="ts">
/** Closing call to action: strong colour block with title, text and actions. */
const props = withDefaults(defineProps<{
  title: string
  description?: string
  tone?: 'primary' | 'secondary' | 'inverted'
}>(), { description: undefined, tone: 'primary' })
const tones = { primary: 'bg-primary', secondary: 'bg-secondary', inverted: 'bg-inverted' }
</script>

<template>
  <div class="relative overflow-hidden rounded-xl px-6 py-12 text-center shadow-warm sm:px-12" :class="tones[props.tone]">
    <h2 class="font-display text-3xl font-semibold tracking-tight text-balance text-inverted">{{ props.title }}</h2>
    <p v-if="props.description" class="mx-auto mt-3 max-w-xl text-lg text-inverted/90">{{ props.description }}</p>
    <div v-if="$slots.default" class="mt-8 flex flex-wrap justify-center gap-3">
      <slot />
    </div>
  </div>
</template>
