<script setup lang="ts">
import type { LegalEntityForm } from '~/utils/legal-entity'
import { fieldKey } from '~/utils/legal-entity'

/**
 * Admin › Settings › Legal entity: the French company that sells in the shop (identity printed on
 * invoices, checkout, emails, the footer and the legal pages) and its consumer mediator. Saving
 * checks the SIREN / SIRET keys, the VAT key and the postal code; errors show next to each field.
 * Issued invoices keep the identity they were issued with.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.legalEntity.title' })
const { t } = useI18n()
const admin = useAdminApi()
const toast = useToast()
const { user } = useAuth()
const canEdit = computed(() => user.value?.permissions.includes('settings.write') ?? false)

const { data, error: loadError, refresh } = await useAsyncData('admin-legal-entity', () => admin.legalEntity.get())
const form = ref<LegalEntityForm | null>(null)
watchEffect(() => { if (data.value) form.value = JSON.parse(JSON.stringify(data.value.entity)) })
const errors = ref<Record<string, string>>({})
const saving = ref(false)

/** Share capital edited in euros, stored in cents. */
const capital = computed({
  get: () => (form.value?.share_capital_minor ?? null) === null ? null : form.value!.share_capital_minor! / 100,
  set: (v: number | null) => { if (form.value) form.value.share_capital_minor = v === null || Number.isNaN(v) ? null : Math.round(v * 100) },
})
const label = (code: string) => t(`admin.legalEntity.fields.${fieldKey(code)}`)
const errorOf = (code: string) => (errors.value[code] ? t(`admin.legalEntity.rules.${errors.value[code]}`) : undefined)

async function save() {
  if (!form.value) return
  saving.value = true
  errors.value = {}
  try {
    const out = await admin.legalEntity.save(form.value)
    toast.add({ title: out.changed?.length ? t('admin.legalEntity.saved') : t('admin.legalEntity.unchanged'), color: 'success' })
    await refresh()
  }
  catch (e) {
    const fields = apiErrorDetails<{ fields?: Record<string, string> }>(e)?.fields
    if (fields) {
      errors.value = fields
      toast.add({ title: t('admin.legalEntity.invalid'), color: 'error' })
    }
    else {
      toast.add({ title: t('admin.legalEntity.error'), color: 'error' })
    }
  }
  finally {
    saving.value = false
  }
}

const identityFields = [
  ['legal_name', 'legal_form'],
  ['address.line1', 'address.line2', 'address.postal_code', 'address.city', 'country_code'],
  ['registration.siren', 'registration.siret', 'registration.rcs_city', 'registration.vat_number', 'registration.ape_code'],
  ['email', 'phone', 'publication_director'],
] as const
const mediatorFields = ['mediator.name', 'mediator.url', 'mediator.address'] as const
const ltr = new Set(['address.postal_code', 'country_code', 'registration.siren', 'registration.siret', 'registration.vat_number', 'registration.ape_code', 'email', 'phone', 'mediator.url'])

/** Two-way binding on a dotted field code. */
function model(code: string) {
  return computed({
    get: () => code.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], form.value) as string ?? '',
    set: (v: string) => {
      const keys = code.split('.')
      const last = keys.pop()!
      const target = keys.reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, form.value as unknown as Record<string, unknown>)
      target[last] = v
    },
  })
}
const models = Object.fromEntries([...identityFields.flat(), ...mediatorFields].map(c => [c, model(c)]))
</script>

<template>
  <div class="flex max-w-4xl flex-col gap-6">
    <MzPageHeader :title="t('admin.legalEntity.title')" :description="t('admin.legalEntity.intro')">
      <template #actions>
        <UButton v-if="canEdit && form" :label="t('common.save')" icon="i-lucide-save" :loading="saving" data-testid="save-legal-entity" @click="save" />
      </template>
    </MzPageHeader>
    <UAlert v-if="loadError" color="error" variant="subtle" :title="t('admin.legalEntity.forbidden')" />
    <template v-else-if="form">
      <UAlert
        v-if="data?.missing.length || data?.mediator_missing.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-circle-alert"
        data-testid="legal-entity-missing"
        :title="t('admin.legalEntity.missingTitle')"
        :description="[...data!.missing, ...data!.mediator_missing].map(label).join(', ')"
      />
      <form class="flex flex-col gap-6" @submit.prevent="save">
        <fieldset :disabled="!canEdit" class="flex flex-col gap-6">
          <UCard>
            <template #header><h2 class="font-medium">{{ t('admin.legalEntity.identity') }}</h2></template>
            <div class="flex flex-col gap-6">
              <div v-for="(group, gi) in identityFields" :key="gi" class="grid gap-4 sm:grid-cols-2">
                <UFormField v-for="code in group" :key="code" :label="label(code)" :name="code" :error="errorOf(code)" :data-field="code">
                  <UInput v-model="models[code]!.value" :dir="ltr.has(code) ? 'ltr' : undefined" class="w-full" />
                </UFormField>
                <UFormField v-if="gi === 0" :label="label('share_capital_minor')" name="share_capital_minor" :error="errorOf('share_capital_minor')" :hint="'€'">
                  <UInputNumber v-model="capital" :min="0" :step="0.01" class="w-full" />
                </UFormField>
              </div>
            </div>
          </UCard>
          <UCard>
            <template #header>
              <h2 class="font-medium">{{ t('admin.legalEntity.mediator') }}</h2>
              <p class="text-small text-muted">{{ t('admin.legalEntity.mediatorHint') }}</p>
            </template>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField v-for="code in mediatorFields" :key="code" :label="label(code)" :name="code" :error="errorOf(code)" :data-field="code" :class="code === 'mediator.address' ? 'sm:col-span-2' : undefined">
                <UInput v-model="models[code]!.value" :dir="ltr.has(code) ? 'ltr' : undefined" class="w-full" />
              </UFormField>
            </div>
          </UCard>
        </fieldset>
        <p class="text-small text-muted">{{ t('admin.legalEntity.invoiceNote') }}</p>
      </form>
    </template>
  </div>
</template>
