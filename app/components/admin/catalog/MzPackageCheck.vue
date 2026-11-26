<script setup lang="ts">
import { addDays } from '~/utils/catalog'
import { apiError } from '~/utils/catalog-admin-api'

/** "Vérifier une date": asks the booking funnel whether the package can be booked, and which item blocks. */
const props = defineProps<{ productId: string }>()
const { t } = useI18n()
const api = useAdminApi()
const { money } = useMoney()
const form = reactive({ start: addDays(new Date().toISOString().slice(0, 10), 30), adults: 2, children: 0 })
const result = ref<Awaited<ReturnType<typeof api.catalog.availability>> | null>(null)
const error = ref('')
async function check() {
  error.value = ''
  try {
    const party = [`adult:${form.adults}`, form.children ? `child:${form.children}` : ''].filter(Boolean).join(',')
    result.value = await api.catalog.availability(props.productId, form.start, party)
  }
  catch (e) {
    result.value = null
    error.value = apiError(e).message ?? t('shop.errors.generic')
  }
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-md border border-default p-4" :aria-label="t('admin.catalog.check.title')" data-testid="package-check">
    <h3 class="font-medium">{{ t('admin.catalog.check.title') }}</h3>
    <div class="flex flex-wrap items-end gap-2">
      <UFormField :label="t('admin.catalog.check.start')" name="check-start"><UInput v-model="form.start" type="date" size="sm" /></UFormField>
      <UFormField :label="t('admin.catalog.check.adults')" name="check-adults"><UInputNumber v-model="form.adults" :min="1" size="sm" class="w-24" /></UFormField>
      <UFormField :label="t('admin.catalog.check.children')" name="check-children"><UInputNumber v-model="form.children" :min="0" size="sm" class="w-24" /></UFormField>
      <UButton :label="t('admin.catalog.check.run')" size="sm" icon="i-lucide-search-check" data-testid="check-date" @click="check" />
    </div>
    <UAlert v-if="error" color="error" variant="soft" :title="error" />
    <UAlert v-else-if="result?.available" color="success" variant="soft" :title="t('admin.catalog.check.available', { total: money(result.total_minor) })" />
    <UAlert v-else-if="result" color="warning" variant="soft" :title="t('admin.catalog.check.blocked')">
      <template #description>
        <ul class="mt-1 text-small"><li v-for="b in result.blocking" :key="`${b.product_id}-${b.code}`"><strong>{{ b.name }}</strong> : {{ b.message }}</li></ul>
      </template>
    </UAlert>
  </section>
</template>
