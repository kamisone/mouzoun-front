<script setup lang="ts">
/**
 * Side panel for create / edit forms: opens from the end side (right in LTR, left in RTL),
 * sticky footer with Cancel / Save. The form itself goes in the default slot; Save submits the
 * form whose id is `formId`.
 */
const props = withDefaults(defineProps<{
  title: string
  description?: string
  formId: string
  saveLabel?: string
  loading?: boolean
}>(), { description: undefined, saveLabel: undefined, loading: false })

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const dir = useTextDirection({ selector: 'html' })
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="props.title"
    :description="props.description"
    :side="dir === 'rtl' ? 'left' : 'right'"
    :dismissible="!props.loading"
    :ui="{ content: 'max-w-xl', body: 'flex-1 overflow-y-auto' }"
  >
    <template #body>
      <slot />
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" size="sm" :disabled="props.loading" @click="open = false" />
        <UButton :label="props.saveLabel ?? t('common.save')" type="submit" :form="props.formId" size="sm" :loading="props.loading" />
      </div>
    </template>
  </USlideover>
</template>
