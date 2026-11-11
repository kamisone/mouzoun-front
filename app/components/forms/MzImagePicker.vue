<script setup lang="ts">
import type { Media } from '~/utils/types'
import { ACCEPTED_IMAGE_TYPES } from '~/composables/useMediaUpload'

/**
 * Picks an image for a form: uploads it directly to the bucket through the existing media
 * pipeline (useMediaUpload) and models the media. Preview, replace, remove.
 */
const props = withDefaults(defineProps<{
  label?: string
  ratio?: string
  disabled?: boolean
}>(), { label: undefined, ratio: '4/3', disabled: false })

const model = defineModel<Pick<Media, 'id' | 'url'> | null>({ default: null })
const { t } = useI18n()
const { size } = useDensity()
const { upload, uploading, error } = useMediaUpload()
const input = useTemplateRef<HTMLInputElement>('file')

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const media = await upload(file)
  if (media) model.value = { id: media.id, url: media.url }
  if (input.value) input.value.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="relative overflow-hidden rounded-lg border border-dashed border-accented bg-muted" :style="{ aspectRatio: props.ratio }">
      <MzImage v-if="model?.url" :src="model.url" :alt="props.label ?? ''" :decorative="!props.label" :ratio="props.ratio" :rounded="false" />
      <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
        <UIcon name="i-lucide-image-plus" class="size-8" aria-hidden="true" />
        <span class="text-sm">{{ props.label ?? t('forms.chooseImage') }}</span>
      </div>
      <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-default/70" role="status">
        <span class="text-sm font-semibold">{{ t('forms.uploading') }}</span>
      </div>
    </div>
    <input ref="file" type="file" class="sr-only" :accept="ACCEPTED_IMAGE_TYPES.join(',')" tabindex="-1" aria-hidden="true" @change="onFile">
    <div class="flex flex-wrap gap-2">
      <UButton
        :label="model ? t('forms.replaceImage') : t('forms.chooseImage')"
        icon="i-lucide-upload"
        variant="soft"
        :size="size"
        :loading="uploading"
        :disabled="props.disabled"
        @click="input?.click()"
      />
      <UButton v-if="model" :label="t('forms.removeImage')" icon="i-lucide-trash-2" color="neutral" variant="ghost" :size="size" :disabled="props.disabled || uploading" @click="model = null" />
    </div>
    <p v-if="error" class="text-sm text-error" role="alert">{{ error || t('forms.uploadFailed') }}</p>
  </div>
</template>
