<script setup lang="ts">
/** Map + practical information (getting here, arrival, what to bring...) as a quiet list. */
export interface PracticalItem { title: string, text: string }
const props = defineProps<{
  lat: number
  lng: number
  items: PracticalItem[]
  /** Photograph behind the map until it is loaded. */
  preview?: { src: string, srcset?: string, lqip?: string }
}>()
</script>

<template>
  <div class="grid gap-12 lg:grid-cols-12 lg:gap-8">
    <div class="lg:col-span-7">
      <MzMapEmbed :lat="props.lat" :lng="props.lng" ratio="4/3" :preview="props.preview" />
    </div>
    <dl class="flex flex-col divide-y divide-default border-y border-default lg:col-span-4 lg:col-start-9">
      <MzReveal v-for="(item, i) in props.items" :key="item.title" :index="i" class="py-6">
        <dt class="eyebrow mb-2">{{ item.title }}</dt>
        <dd class="text-body text-toned">{{ item.text }}</dd>
      </MzReveal>
    </dl>
  </div>
</template>
