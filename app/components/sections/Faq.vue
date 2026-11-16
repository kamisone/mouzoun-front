<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Questions and answers as native disclosure widgets (keyboard and screen reader friendly). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const faqs = computed(() => (props.section.data.faqs ?? []) as { id: string, question: string, answer: string }[])
const { level } = useSectionContext(() => props.section)
</script>

<template>
  <MzSectionContainer :section="props.section" size="narrow">
    <MzSectionHeading :section="props.section" />
    <div class="divide-y divide-default border-y border-default">
      <details v-for="(f, i) in faqs" :key="f.id" class="group py-6" :open="i === 0 && !!props.section.settings.first_open">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-6 [&::-webkit-details-marker]:hidden">
          <component :is="`h${level + 1}`" class="text-h3">{{ f.question }}</component>
          <UIcon name="i-lucide-plus" class="size-5 shrink-0 transition group-open:rotate-45" aria-hidden="true" />
        </summary>
        <p class="mt-4 max-w-editorial text-muted">{{ f.answer }}</p>
      </details>
    </div>
  </MzSectionContainer>
</template>
