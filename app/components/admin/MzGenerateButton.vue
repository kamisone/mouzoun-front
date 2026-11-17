<script setup lang="ts">
/**
 * "Générer" pill: fills the other languages from the French text (machine translation, to
 * review before saving). Disabled until the French source is written.
 */
const props = defineProps<{ generating: boolean, disabled?: boolean, error?: string | null, label?: string }>()
const emit = defineEmits<{ click: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <UTooltip :text="props.disabled ? t('admin.translate.needSource') : t('admin.translate.hint')">
      <UButton
        :label="props.generating ? t('admin.translate.generating') : (props.label ?? t('admin.translate.generate'))"
        :icon="props.generating ? undefined : 'i-lucide-sparkles'"
        :loading="props.generating"
        :disabled="props.disabled || props.generating"
        color="primary"
        variant="soft"
        size="sm"
        data-testid="generate-translations"
        @click="emit('click')"
      />
    </UTooltip>
    <p v-if="props.error" class="text-small text-warning" role="alert">{{ props.error }}</p>
  </div>
</template>
