<script setup lang="ts">
/**
 * Confirmation before a consequential action. Focus goes to Cancel (the safe choice); the
 * confirm button shows progress while the parent's async handler runs.
 */
const props = withDefaults(defineProps<{
  title?: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}>(), { title: undefined, description: undefined, confirmLabel: undefined, danger: false, loading: false })

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()
</script>

<template>
  <UModal
    v-model:open="open"
    :title="props.title ?? t('confirm.title')"
    :description="props.description ?? (props.danger ? t('confirm.irreversible') : undefined)"
    :dismissible="!props.loading"
  >
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" :disabled="props.loading" autofocus @click="open = false" />
        <UButton
          :label="props.confirmLabel ?? t('common.confirm')"
          :color="props.danger ? 'error' : 'primary'"
          :loading="props.loading"
          data-testid="confirm-dialog-confirm"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
