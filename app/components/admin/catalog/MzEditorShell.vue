<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

/**
 * Shell of the catalogue editors (stays, activities, packages, extras): header with actions,
 * two columns (content on the start side, status and organisation on the end side) and a sticky
 * save bar while there are unsaved changes. Leaving the page with unsaved changes asks first
 * (in-app navigation and closing the tab).
 */
const props = withDefaults(defineProps<{
  title: string
  breadcrumbs: BreadcrumbItem[]
  dirty?: boolean
  saving?: boolean
  readOnly?: boolean
}>(), { dirty: false, saving: false, readOnly: false })
const emit = defineEmits<{ save: [], discard: [] }>()
const { t } = useI18n()

onBeforeRouteLeave(() => {
  if (props.dirty && !props.saving && import.meta.client && !window.confirm(t('admin.catalog.leaveConfirm'))) return false
})
function beforeUnload(e: BeforeUnloadEvent) {
  if (props.dirty) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="flex flex-col gap-6 pb-24">
    <MzPageHeader :title="props.title" :breadcrumbs="props.breadcrumbs">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </MzPageHeader>
    <slot name="banner" />
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <fieldset :disabled="props.readOnly" class="min-w-0">
        <legend class="sr-only">{{ props.title }}</legend>
        <slot />
      </fieldset>
      <aside class="flex flex-col gap-4" :aria-label="t('admin.catalog.organisation')">
        <slot name="aside" />
      </aside>
    </div>
    <div
      v-if="props.dirty && !props.readOnly"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-elevated/95 px-4 py-3 backdrop-blur"
      role="region"
      :aria-label="t('admin.catalog.saveBar')"
      data-testid="save-bar"
    >
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
        <span class="me-auto text-small text-muted">{{ t('admin.catalog.unsaved') }}</span>
        <UButton :label="t('admin.catalog.discard')" color="neutral" variant="ghost" :disabled="props.saving" @click="emit('discard')" />
        <UButton :label="t('common.save')" icon="i-lucide-save" :loading="props.saving" data-testid="catalog-save" @click="emit('save')" />
      </div>
    </div>
  </div>
</template>
