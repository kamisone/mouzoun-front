<script setup lang="ts">
import type { Period } from '~/utils/page-types'
import { fromCampLocal, toCampLocal } from '~/utils/camp-datetime'

/** Show from / until, in camp time (Africa/Casablanca). Both empty = always. */
const model = defineModel<Period | null>({ default: null })
const { t } = useI18n()
const uid = useId()
function set(key: 'start' | 'end', value: string) {
  const next = { start: model.value?.start ?? null, end: model.value?.end ?? null, [key]: fromCampLocal(value) }
  model.value = next.start || next.end ? next : null
}
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-small font-medium">{{ t('admin.builder.schedule.title') }} <span class="font-normal text-muted">({{ t('admin.builder.schedule.timezone') }})</span></legend>
    <div class="grid grid-cols-2 gap-2">
      <UFormField :label="t('admin.builder.schedule.from')">
        <UInput :id="`${uid}-start`" type="datetime-local" :model-value="toCampLocal(model?.start)" data-testid="schedule-start" @update:model-value="v => set('start', String(v))" />
      </UFormField>
      <UFormField :label="t('admin.builder.schedule.until')">
        <UInput :id="`${uid}-end`" type="datetime-local" :model-value="toCampLocal(model?.end)" data-testid="schedule-end" @update:model-value="v => set('end', String(v))" />
      </UFormField>
    </div>
  </fieldset>
</template>
