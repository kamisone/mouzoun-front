<script setup lang="ts">
/** A row of a few facts: large serif value, small label. Hairline separators, no icons. */
export interface Fact { value: string, label: string }
const props = defineProps<{ facts: Fact[], title?: string }>()
</script>

<template>
  <div>
    <h2 v-if="props.title" class="sr-only">{{ props.title }}</h2>
    <dl class="grid grid-cols-2 gap-y-12 border-t border-default pt-12 lg:grid-cols-4">
      <MzReveal v-for="(fact, i) in props.facts" :key="fact.label" :index="i" class="flex flex-col-reverse gap-2 pe-6 lg:border-e lg:border-default lg:ps-8 lg:first:ps-0 lg:last:border-e-0">
        <dt class="text-small text-muted">{{ fact.label }}</dt>
        <dd class="font-display text-display-lg text-highlighted">{{ fact.value }}</dd>
      </MzReveal>
    </dl>
  </div>
</template>
