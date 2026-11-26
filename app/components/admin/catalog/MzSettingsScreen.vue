<script setup lang="ts">
import { CATALOG_LOCALES, type SettingField } from '~/utils/catalog-admin-api'
import { apiError } from '~/utils/catalog-admin-api'

/**
 * One list + form screen for a shared setting of the catalogue (seasons, rate plans, guest
 * categories, cancellation policies, resources), configured by `fields`. A setting still used
 * (prices, bookings, rate plans) is not deleted: the API answers `in_use` and the count shows.
 */
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const props = defineProps<{
  title: string
  description: string
  api: { list: () => Promise<{ data: Row[] }>, create: (b: Row) => Promise<unknown>, update: (id: string, b: Row) => Promise<unknown>, remove: (id: string) => Promise<unknown> }
  fields: SettingField[]
  blank: () => Row
  /** Columns of the list: [label, (row) => text]. */
  columns: [string, (r: Row) => string][]
  permission: string
  /** Text under each row's actions (how many rules or plans use it). */
  usage?: (r: Row) => string | undefined
  /** Menu group of the breadcrumb (Tarifs by default). */
  section?: string
}>()
const { t } = useI18n()
const toast = useToast()
const { user } = useAuth()
const canWrite = computed(() => user.value?.permissions.includes(props.permission) ?? false)
const { data, refresh } = await useAsyncData(`catalog-settings-${props.title}`, () => props.api.list())
const open = ref(false)
const editing = ref<string | null>(null)
const form = ref<Row>(props.blank())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const { load: reloadRefs } = useCatalogRefs()
function edit(row?: Row) {
  editing.value = row?.id ?? null
  form.value = row ? JSON.parse(JSON.stringify(row)) : props.blank()
  for (const f of props.fields) if (f.type === 'names' && !form.value[f.key]) form.value[f.key] = {}
  errors.value = {}
  open.value = true
}
async function save() {
  saving.value = true
  errors.value = {}
  try {
    if (editing.value) await props.api.update(editing.value, form.value)
    else await props.api.create(form.value)
    toast.add({ title: t('admin.catalog.saved'), color: 'success' })
    open.value = false
    await Promise.all([refresh(), reloadRefs(true)])
  }
  catch (e) {
    const er = apiError(e)
    errors.value = er.details?.fields ?? {}
    toast.add({ title: t(`admin.catalog.errors.${er.code ?? 'generic'}`), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
async function remove(row: Row) {
  try {
    await props.api.remove(row.id)
    toast.add({ title: t('admin.catalog.deleted'), color: 'success' })
    await Promise.all([refresh(), reloadRefs(true)])
  }
  catch (e) {
    const er = apiError(e)
    toast.add({ title: er.code === 'in_use' ? t('admin.catalog.errors.in_use_count', { n: er.details?.count, what: t(`admin.catalog.settings.uses.${er.details?.what}`) }) : t('shop.errors.generic'), color: 'error' })
  }
}
const err = (key: string) => (errors.value[key] ? t(`admin.catalog.errors.${errors.value[key]}`) : undefined)
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="props.title" :description="props.description" :breadcrumbs="[{ label: props.section ?? t('admin.catalog.pricingTitle') }, { label: props.title }]">
      <template #actions>
        <UButton v-if="canWrite" :label="t('admin.catalog.settings.add')" icon="i-lucide-plus" data-testid="add-setting" @click="edit()" />
      </template>
    </MzPageHeader>
    <div class="overflow-x-auto">
      <table class="w-full text-small">
        <thead><tr class="text-muted"><th v-for="[label] in props.columns" :key="label" class="p-2 text-start">{{ label }}</th><th class="p-2" /></tr></thead>
        <tbody>
          <tr v-for="r in data?.data ?? []" :key="r.id" class="border-t border-default align-top">
            <td v-for="[label, value] in props.columns" :key="label" class="p-2">{{ value(r) }}</td>
            <td class="p-2">
              <div class="flex justify-end gap-1">
                <UButton :label="canWrite ? t('admin.catalog.settings.edit') : t('admin.catalog.settings.view')" size="xs" color="neutral" variant="outline" @click="edit(r)" />
                <UButton v-if="canWrite" icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="remove(r)" />
              </div>
              <p v-if="props.usage?.(r)" class="mt-1 text-end text-caption text-muted">{{ props.usage(r) }}</p>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!(data?.data ?? []).length" class="p-2 text-small text-muted">{{ t('admin.catalog.settings.none') }}</p>
    </div>
    <MzFormDrawer v-model:open="open" :title="editing ? t('admin.catalog.settings.edit') : t('admin.catalog.settings.add')" form-id="catalog-setting" :loading="saving">
      <form id="catalog-setting" class="flex flex-col gap-4" @submit.prevent="save">
        <fieldset :disabled="!canWrite" class="flex flex-col gap-4">
          <template v-for="f in props.fields" :key="f.key">
            <template v-if="!f.when || f.when(form)">
              <UFormField v-if="f.type === 'names'" :label="f.label" :name="f.key" :error="err(`${f.key}.fr`)">
                <div class="grid gap-2 sm:grid-cols-3">
                  <UInput v-for="l in CATALOG_LOCALES" :key="l" v-model="form[f.key][l]" :placeholder="l.toUpperCase()" :dir="l === 'ar' ? 'rtl' : 'ltr'" :aria-label="`${f.label} (${l})`" />
                </div>
              </UFormField>
              <UFormField v-else-if="f.type === 'periods'" :label="f.label" :name="f.key" :help="f.help">
                <div class="flex flex-col gap-2">
                  <div v-for="(p, i) in form[f.key]" :key="i" class="flex flex-wrap items-center gap-2">
                    <UInput v-model="p.from" type="date" size="sm" :aria-label="t('admin.catalog.settings.from')" />
                    <span>→</span>
                    <UInput v-model="p.to" type="date" size="sm" :aria-label="t('admin.catalog.settings.to')" />
                    <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="form[f.key].splice(i, 1)" />
                    <span v-if="err(`${f.key}[${i}]`) || err(`${f.key}[${i}].to`)" class="text-small text-error">{{ err(`${f.key}[${i}]`) ?? err(`${f.key}[${i}].to`) }}</span>
                  </div>
                  <UButton :label="t('admin.catalog.settings.addPeriod')" icon="i-lucide-plus" size="xs" color="neutral" variant="link" class="self-start" @click="form[f.key].push({ from: '', to: '' })" />
                </div>
              </UFormField>
              <UFormField v-else-if="f.type === 'rules'" :label="f.label" :name="f.key" :help="f.help" :error="err(f.key)">
                <div class="flex flex-col gap-2">
                  <div v-for="(r, i) in form[f.key]" :key="i" class="flex flex-wrap items-center gap-2 text-small">
                    <span>{{ t('admin.catalog.settings.moreThan') }}</span>
                    <UInputNumber v-model="r.min_hours_before" :min="0" size="xs" class="w-24" :aria-label="t('admin.catalog.settings.hours')" />
                    <span>{{ t('admin.catalog.settings.hoursBefore') }}</span>
                    <UInputNumber v-model="r.refund_percent" :min="0" :max="100" size="xs" class="w-20" :aria-label="t('admin.catalog.settings.refund')" />
                    <span>{{ t('admin.catalog.settings.percentRefunded') }}</span>
                    <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="form[f.key].splice(i, 1)" />
                  </div>
                  <UButton :label="t('admin.catalog.settings.addRule')" icon="i-lucide-plus" size="xs" color="neutral" variant="link" class="self-start" @click="form[f.key].push({ min_hours_before: 0, refund_percent: 0 })" />
                </div>
              </UFormField>
              <USwitch v-else-if="f.type === 'switch'" v-model="form[f.key]" :label="f.label" />
              <UFormField v-else :label="f.label" :name="f.key" :help="f.help" :error="err(f.key)">
                <USelect v-if="f.type === 'select'" v-model="form[f.key]" :items="f.options" class="w-full" />
                <UInputNumber v-else-if="f.type === 'number'" :model-value="form[f.key] ?? undefined" class="w-full" @update:model-value="v => (form[f.key] = v ?? null)" />
                <MzMoneyInput v-else-if="f.type === 'money'" v-model="form[f.key]" />
                <UInput v-else-if="f.type === 'percent'" :model-value="form[f.key] ?? ''" inputmode="decimal" class="w-full" @update:model-value="v => (form[f.key] = String(v) || null)"><template #trailing>%</template></UInput>
                <input v-else-if="f.type === 'color'" v-model="form[f.key]" type="color" class="h-8 w-16 cursor-pointer rounded-xs border border-default bg-default" :aria-label="f.label">
                <UTextarea v-else-if="f.type === 'textarea'" v-model="form[f.key]" :rows="2" class="w-full" />
                <UInput v-else v-model="form[f.key]" class="w-full" :dir="f.type === 'code' ? 'ltr' : undefined" />
              </UFormField>
            </template>
          </template>
        </fieldset>
      </form>
    </MzFormDrawer>
  </div>
</template>
