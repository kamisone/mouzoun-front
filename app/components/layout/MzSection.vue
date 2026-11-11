<script setup lang="ts">
/**
 * A page section with editorial rhythm: generous vertical space (64–96 px mobile, 128–160 px
 * desktop), optional eyebrow, serif title, short description and actions, then the content.
 * Left-aligned by default; `tone="sand"` for the subtle surface.
 */
const props = withDefaults(defineProps<{
  id?: string
  eyebrow?: string
  title?: string
  description?: string
  level?: 2 | 3
  align?: 'start' | 'center'
  tone?: 'default' | 'sand' | 'elevated'
  /** Vertical space: `md` 64→128 px, `lg` 96→160 px. */
  space?: 'md' | 'lg'
  size?: 'page' | 'narrow' | 'editorial'
}>(), { id: undefined, eyebrow: undefined, title: undefined, description: undefined, level: 2, align: 'start', tone: 'default', space: 'lg', size: 'page' })

const tones = { default: 'bg-default', sand: 'bg-muted', elevated: 'bg-elevated' }
const spaces = { md: 'py-16 md:py-24 lg:py-32', lg: 'py-24 lg:py-40' }
const headingId = computed(() => (props.id ? `${props.id}-title` : undefined))
</script>

<template>
  <section :id="props.id" :aria-labelledby="props.title ? headingId : undefined" :class="[tones[props.tone], spaces[props.space]]">
    <MzContainer :size="props.size">
      <header
        v-if="props.title || props.eyebrow || $slots.actions"
        class="mb-12 flex flex-col gap-6 lg:mb-16 lg:flex-row lg:items-end lg:justify-between"
        :class="props.align === 'center' && 'items-center text-center lg:flex-col lg:items-center'"
      >
        <div class="max-w-editorial">
          <p v-if="props.eyebrow" class="eyebrow mb-4">{{ props.eyebrow }}</p>
          <component :is="`h${props.level}`" v-if="props.title" :id="headingId" class="text-balance" :class="props.level === 2 ? 'text-h1' : 'text-h2'">
            {{ props.title }}
          </component>
          <p v-if="props.description" class="mt-6 text-body-lg text-muted">{{ props.description }}</p>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-4">
          <slot name="actions" />
        </div>
      </header>
      <slot />
    </MzContainer>
  </section>
</template>
