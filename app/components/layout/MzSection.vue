<script setup lang="ts">
/**
 * A page section with the site's vertical rhythm: optional eyebrow, title, description and
 * actions, then the content. `tone` changes the background, never the text contrast.
 */
const props = withDefaults(defineProps<{
  id?: string
  eyebrow?: string
  title?: string
  description?: string
  /** Heading level of the title (keeps the outline correct wherever the section sits). */
  level?: 2 | 3
  align?: 'start' | 'center'
  tone?: 'default' | 'muted' | 'elevated'
  size?: 'page' | 'narrow' | 'prose'
}>(), { id: undefined, eyebrow: undefined, title: undefined, description: undefined, level: 2, align: 'start', tone: 'default', size: 'page' })

const tones = { default: 'bg-default', muted: 'bg-muted', elevated: 'bg-elevated' }
const headingId = computed(() => (props.id ? `${props.id}-title` : undefined))
</script>

<template>
  <section :id="props.id" :aria-labelledby="props.title ? headingId : undefined" class="py-(--section-y)" :class="tones[props.tone]">
    <MzContainer :size="props.size">
      <header
        v-if="props.title || props.eyebrow || $slots.actions"
        class="mb-(--section-gap) flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        :class="props.align === 'center' && 'md:flex-col md:items-center text-center'"
      >
        <div class="max-w-prose-wide" :class="props.align === 'center' && 'mx-auto'">
          <p v-if="props.eyebrow" class="mb-2 text-sm font-semibold tracking-wide text-primary uppercase">
            {{ props.eyebrow }}
          </p>
          <component :is="`h${props.level}`" v-if="props.title" :id="headingId" class="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {{ props.title }}
          </component>
          <p v-if="props.description" class="mt-3 text-lg text-muted text-pretty">
            {{ props.description }}
          </p>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-3">
          <slot name="actions" />
        </div>
      </header>
      <slot />
    </MzContainer>
  </section>
</template>
