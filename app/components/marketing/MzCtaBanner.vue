<script setup lang="ts">
/** Closing call to action: a calm band on the sand surface, serif title, one action. */
const props = withDefaults(defineProps<{
  title: string
  description?: string
  eyebrow?: string
}>(), { description: undefined, eyebrow: undefined })
</script>

<template>
  <section class="bg-muted py-24 lg:py-40">
    <MzContainer size="editorial" class="text-center">
      <MzReveal>
        <p v-if="props.eyebrow" class="eyebrow mb-4">{{ props.eyebrow }}</p>
        <h2 class="text-display-lg text-balance">{{ props.title }}</h2>
        <p v-if="props.description" class="mt-6 text-body-lg text-muted">{{ props.description }}</p>
        <div v-if="$slots.default" class="mt-12 flex flex-wrap justify-center gap-6">
          <slot />
        </div>
      </MzReveal>
    </MzContainer>
  </section>
</template>
