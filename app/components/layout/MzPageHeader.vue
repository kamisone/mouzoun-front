<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

/** Top of a page (public or admin): breadcrumbs, the page's single <h1>, description, actions. */
const props = withDefaults(defineProps<{
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
}>(), { description: undefined, breadcrumbs: undefined })

const { t } = useI18n()
const { compact } = useDensity()
</script>

<template>
  <div class="flex flex-col gap-3" :class="compact ? 'pb-4' : 'pb-8'">
    <nav v-if="props.breadcrumbs?.length" :aria-label="t('admin.breadcrumb')">
      <UBreadcrumb :items="props.breadcrumbs" />
    </nav>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="font-display font-semibold tracking-tight text-balance" :class="compact ? 'text-2xl' : 'text-3xl sm:text-4xl'">
          {{ props.title }}
        </h1>
        <p v-if="props.description" class="mt-2 max-w-prose-wide text-muted">{{ props.description }}</p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
