<script setup lang="ts">
import type { RelayPoint } from '~/utils/shop-types'

/**
 * Relay-point picker: search by postal code, choose a point in the list. Emits the chosen id;
 * the cart stores the point and prices relay delivery.
 */
const props = defineProps<{ modelValue?: string, postalCode?: string | null, selected?: RelayPoint | null, error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
const { t } = useI18n()
const api = useShopApi()

const postal = ref(props.postalCode ?? '')
const points = ref<RelayPoint[]>([])
const loading = ref(false)
const searched = ref(false)
const failed = ref(false)

async function search() {
  if (!/^\d{5}$/.test(postal.value.trim())) {
    failed.value = true
    return
  }
  loading.value = true
  failed.value = false
  try {
    points.value = (await api.relayPoints(postal.value.trim())).data
    searched.value = true
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}
watch(() => props.postalCode, (p) => {
  if (p && !postal.value) postal.value = p
})
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="relay-picker">
    <div class="flex items-end gap-2">
      <UFormField :label="t('shop.checkout.relay.postalCode')" name="relay_postal" class="flex-1" :error="failed ? t('shop.checkout.relay.invalidPostal') : undefined">
        <UInput v-model="postal" inputmode="numeric" maxlength="5" dir="ltr" class="w-full" autocomplete="postal-code" @keydown.enter.prevent="search" />
      </UFormField>
      <UButton :label="t('shop.checkout.relay.search')" color="neutral" variant="outline" :loading="loading" @click="search" />
    </div>
    <p v-if="selected" class="rounded-md bg-elevated p-3 text-small" role="status">
      {{ t('shop.checkout.relay.chosen') }} <strong>{{ selected.name }}</strong>, {{ selected.line1 }}, {{ selected.postal_code }} {{ selected.city }}
    </p>
    <fieldset v-if="points.length" class="flex flex-col gap-2">
      <legend class="sr-only">{{ t('shop.checkout.relay.list') }}</legend>
      <label v-for="p in points" :key="p.id" class="flex cursor-pointer items-start gap-3 rounded-md border border-default p-3" :class="{ 'border-primary': p.id === modelValue }">
        <input type="radio" name="relay_point" :value="p.id" :checked="p.id === modelValue" class="mt-1" @change="emit('update:modelValue', p.id)">
        <span class="flex flex-col">
          <span class="font-medium text-highlighted">{{ p.name }}</span>
          <span class="text-small text-muted">{{ p.line1 }}, {{ p.postal_code }} {{ p.city }}</span>
          <span v-if="p.opening_hours.length" class="text-small text-muted">{{ p.opening_hours.join(' · ') }}</span>
        </span>
      </label>
    </fieldset>
    <p v-else-if="searched" class="text-small text-muted">{{ t('shop.checkout.relay.none') }}</p>
    <p v-if="error" class="text-small text-error">{{ error }}</p>
  </div>
</template>
