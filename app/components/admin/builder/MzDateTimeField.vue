<script setup lang="ts">
import { fromCampLocal, toCampLocal } from '~/utils/camp-datetime'

/** Date and time in camp time (Africa/Casablanca), stored as an ISO instant. */
const props = defineProps<{ label: string }>()
const model = defineModel<string | null | undefined>()
</script>

<template>
  <UInput type="datetime-local" :model-value="toCampLocal(model)" :aria-label="props.label" @update:model-value="v => (model = fromCampLocal(String(v)))" />
</template>
