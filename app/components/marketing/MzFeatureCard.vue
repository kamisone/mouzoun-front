<script setup lang="ts">
/** Short text block (number or label, serif title, text), no border, no icon tile. */
const props = withDefaults(defineProps<{
  title: string
  description?: string
  /** Small label or number above the title ("01", "Le camp"). */
  label?: string
  to?: string
}>(), { description: undefined, label: undefined, to: undefined })
</script>

<template>
  <div class="relative flex flex-col border-t border-default pt-6">
    <p v-if="props.label" class="eyebrow mb-4">{{ props.label }}</p>
    <h3 class="text-h3">
      <NuxtLink v-if="props.to" :to="props.to" class="after:absolute after:inset-0 after:content-['']">{{ props.title }}</NuxtLink>
      <template v-else>{{ props.title }}</template>
    </h3>
    <p v-if="props.description" class="mt-3 text-body text-muted">{{ props.description }}</p>
    <slot />
  </div>
</template>
