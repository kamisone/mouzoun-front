<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/**
 * Variation library (modelled on vitecamio's variant attributes): reusable dimensions (weight,
 * packaging, colour…) with their values, display type, colour swatches, pictures and price
 * adjustments. Products link them from their "Options & variants" tab; saving here updates the
 * linked products. "Générer" fills English and Arabic from the French name and labels.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.variations' })

const LOCALES = ['fr', 'en', 'ar'] as const
const DISPLAYS = ['button', 'swatch', 'dropdown'] as const
const { t } = useI18n()
const admin = useAdminApi()
const { money } = useMoney()
const { can, act } = useShopAdmin()
const { data, refresh } = await useAsyncData('admin-shop-variations', () => admin.shop.variations.list())
const { data: categories } = await useAsyncData('admin-shop-categories', () => admin.shop.categories.list())
const categoryItems = computed(() => [{ value: 'all', label: t('admin.shop.variations.noCategory') }, ...(categories.value?.data ?? []).map(c => ({ value: c.id as string, label: (c.translations.fr?.name ?? c.id) as string }))])
const canEdit = computed(() => can('shop.catalog'))

const names = (o: Json) => ({ fr: '', en: '', ar: '', ...(o ?? {}) })
const blankValue = (): Json => ({ id: null, code: '', labels: names({}), swatch_color: '', swatch_media_id: undefined, adjustment: null, is_active: true })
const blank = (): Json => ({ code: '', admin_label: '', display_type: 'button', category_id: 'all', sort_order: 0, is_active: true, names: names({}), values: [blankValue()] })

const form = ref<Json>(blank())
const editing = ref<string | null>(null)
const open = ref(false)
function edit(a?: Json) {
  editing.value = a?.id ?? null
  form.value = a
    ? {
        code: a.code, admin_label: a.admin_label ?? '', display_type: a.display_type, category_id: a.category_id ?? 'all', sort_order: a.sort_order, is_active: a.is_active,
        names: names(a.names), product_count: a.product_count,
        values: a.values.map((v: Json) => ({ id: v.id, code: v.code, labels: names(v.labels), swatch_color: v.swatch_color ?? '', swatch_media_id: v.swatch_media_id ?? undefined,
                                              adjustment: v.price_adjustment_minor != null ? v.price_adjustment_minor / 100 : null, is_active: v.is_active, product_count: v.product_count })),
      }
    : blank()
  gen.error.value = null
  open.value = true
}
function move(index: number | string, by: number) {
  const values = form.value.values as Json[]
  const i = Number(index)
  const j = i + by
  if (j < 0 || j >= values.length) return
  ;[values[i], values[j]] = [values[j]!, values[i]!]
}
async function save() {
  const f = form.value
  const body = {
    code: editing.value ? undefined : f.code || undefined, admin_label: f.admin_label || null, display_type: f.display_type,
    category_id: f.category_id === 'all' ? null : f.category_id, sort_order: Number(f.sort_order) || 0, is_active: f.is_active, names: f.names,
    values: (f.values as Json[]).map(v => ({
      id: v.id ?? undefined, code: v.id ? undefined : v.code || undefined, labels: v.labels, swatch_color: v.swatch_color || null,
      swatch_media_id: v.swatch_media_id ?? null, price_adjustment_minor: v.adjustment ? Math.round(v.adjustment * 100) : null, is_active: v.is_active,
    })),
  }
  if (await act(() => admin.shop.variations.save(body, editing.value ?? undefined), t('admin.shop.variations.saved'))) {
    open.value = false
    await refresh()
  }
}
async function remove(a: Json) {
  if (!confirm(t('admin.shop.variations.confirmDelete'))) return
  if (await act(() => admin.shop.variations.remove(a.id), t('admin.shop.variations.deleted'))) await refresh()
}

// "Générer": the name and every value label in one request (`name`, `v0`, `v1`…), then put back.
const gen = useTranslationGenerate()
async function generate() {
  const f = form.value
  const source: Record<string, string> = { name: f.names.fr }
  ;(f.values as Json[]).forEach((v, i) => { source[`v${i}`] = v.labels.fr })
  const target: Record<string, Record<string, string>> = Object.fromEntries(LOCALES.map(l => [l, {}]))
  await gen.generate(source, target)
  for (const l of LOCALES) {
    if (l === 'fr') continue
    for (const [k, value] of Object.entries(target[l]!)) {
      if (!value) continue
      if (k === 'name') f.names[l] = value
      else {
        const v = (f.values as Json[])[Number(k.slice(1))]
        if (v) v.labels[l] = value
      }
    }
  }
}
const adjustment = (minor: number | null) => minor ? `${minor > 0 ? '+' : '−'}${money(Math.abs(minor))}` : ''
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.shop.variations.title')">
      <template #actions>
        <UButton v-if="canEdit" icon="i-lucide-plus" :label="t('admin.shop.variations.new')" @click="edit()" />
      </template>
    </MzPageHeader>
    <p class="max-w-3xl text-small text-muted">{{ t('admin.shop.variations.intro') }}</p>

    <p v-if="!(data?.data ?? []).length" class="text-muted">{{ t('admin.shop.variations.empty') }}</p>
    <table v-else class="w-full text-small">
      <thead class="text-muted">
        <tr>
          <th class="p-2 text-start">{{ t('admin.shop.variations.name') }}</th>
          <th class="p-2 text-start">{{ t('admin.shop.variations.display') }}</th>
          <th class="p-2 text-start">{{ t('admin.shop.variations.values') }}</th>
          <th class="p-2 text-end">{{ t('admin.shop.nav.products') }}</th>
          <th class="p-2 text-start">{{ t('admin.shop.orders.status') }}</th>
          <th class="p-2" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in data?.data ?? []" :key="a.id" class="border-t border-default align-top" :class="canEdit && 'cursor-pointer hover:bg-elevated'" @click="canEdit && edit(a)">
          <td class="p-2">
            <span class="font-medium">{{ a.names.fr ?? a.code }}</span>
            <span class="block text-caption text-muted" dir="ltr">{{ a.code }}<template v-if="a.admin_label"> · {{ a.admin_label }}</template></span>
          </td>
          <td class="p-2"><UBadge color="neutral" variant="soft" :label="t(`admin.shop.variations.displays.${a.display_type}`)" /></td>
          <td class="p-2">
            <div class="flex flex-wrap gap-1">
              <span v-for="v in a.values" :key="v.id" class="inline-flex items-center gap-1 rounded-full border border-default px-2 py-1" :class="!v.is_active && 'opacity-50'">
                <span v-if="v.swatch_color" class="size-3 rounded-full border border-default" :style="{ backgroundColor: v.swatch_color }" />
                {{ v.labels.fr ?? v.code }}
                <span v-if="v.price_adjustment_minor" class="text-muted tabular-nums">{{ adjustment(v.price_adjustment_minor) }}</span>
              </span>
            </div>
          </td>
          <td class="p-2 text-end tabular-nums">{{ a.product_count }}</td>
          <td class="p-2"><UBadge :color="a.is_active ? 'success' : 'neutral'" variant="soft" :label="a.is_active ? t('admin.shop.variations.active') : t('admin.shop.variations.inactive')" /></td>
          <td class="p-2 text-end">
            <UButton v-if="canEdit" icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" :disabled="a.product_count > 0" :title="a.product_count > 0 ? t('admin.shop.variations.usedBy', { count: a.product_count }) : undefined" :aria-label="t('common.delete')" @click.stop="remove(a)" />
          </td>
        </tr>
      </tbody>
    </table>

    <UModal v-model:open="open" :title="editing ? t('admin.shop.variations.edit') : t('admin.shop.variations.new')" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body>
        <form id="variation" class="flex flex-col gap-4" @submit.prevent="save">
          <div class="grid gap-3 sm:grid-cols-3">
            <UFormField v-for="l in LOCALES" :key="l" :label="`${t('admin.shop.variations.name')} (${l})`" :required="l === 'fr'" :name="`name-${l}`">
              <UInput v-model="form.names[l]" :dir="l === 'ar' ? 'rtl' : 'ltr'" class="w-full" />
            </UFormField>
          </div>
          <MzGenerateButton :generating="gen.generating.value" :error="gen.error.value" :disabled="!form.names.fr?.trim()" @click="generate" />
          <div class="grid gap-3 sm:grid-cols-3">
            <UFormField :label="t('admin.shop.variations.code')" :help="t('admin.shop.variations.codeHint')" name="code">
              <UInput v-model="form.code" :disabled="!!editing" dir="ltr" placeholder="poids" class="w-full" />
            </UFormField>
            <UFormField :label="t('admin.shop.variations.adminLabel')" :help="t('admin.shop.variations.adminLabelHint')" name="admin-label">
              <UInput v-model="form.admin_label" class="w-full" />
            </UFormField>
            <UFormField :label="t('admin.shop.variations.display')" name="display">
              <USelect v-model="form.display_type" :items="DISPLAYS.map(d => ({ value: d, label: t(`admin.shop.variations.displays.${d}`) }))" class="w-full" />
            </UFormField>
            <UFormField :label="t('admin.shop.variations.category')" name="category">
              <USelect v-model="form.category_id" :items="categoryItems" class="w-full" />
            </UFormField>
            <UFormField :label="t('admin.shop.variations.order')" name="order">
              <UInputNumber v-model="form.sort_order" :min="0" class="w-full" />
            </UFormField>
            <UFormField :help="t('admin.shop.variations.inactiveHint')" name="active">
              <USwitch v-model="form.is_active" :label="t('admin.shop.variations.active')" />
            </UFormField>
          </div>

          <fieldset class="flex flex-col gap-2">
            <legend class="mb-2 font-medium">{{ t('admin.shop.variations.values') }}</legend>
            <div v-for="(v, i) in form.values" :key="v.id ?? `new-${i}`" class="flex flex-col gap-2 rounded-md border border-default p-3" :class="!v.is_active && 'opacity-70'">
              <div class="flex flex-wrap items-end gap-2">
                <UFormField v-for="l in LOCALES" :key="l" :label="`${t('admin.shop.variations.value')} (${l})`" :required="l === 'fr'" :name="`value-${i}-${l}`" class="w-36">
                  <UInput v-model="v.labels[l]" :dir="l === 'ar' ? 'rtl' : 'ltr'" size="sm" class="w-full" />
                </UFormField>
                <UFormField :label="t('admin.shop.variations.code')" :name="`value-code-${i}`" class="w-28">
                  <UInput v-model="v.code" :disabled="!!v.id" dir="ltr" size="sm" placeholder="500g" class="w-full" />
                </UFormField>
                <UFormField :label="t('admin.shop.variations.adjustment')" :help="i === 0 ? t('admin.shop.variations.adjustmentHint') : undefined" :name="`value-adj-${i}`" class="w-36">
                  <UInputNumber v-model="v.adjustment" :step="0.5" size="sm" class="w-full" />
                </UFormField>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <template v-if="form.display_type === 'swatch'">
                  <label class="flex items-center gap-2 text-small">
                    {{ t('admin.shop.variations.color') }}
                    <input v-model="v.swatch_color" type="color" class="size-8 cursor-pointer rounded border border-default bg-default" :aria-label="`${t('admin.shop.variations.color')} ${v.labels.fr}`">
                    <UInput v-model="v.swatch_color" size="xs" dir="ltr" placeholder="#rrggbb" class="w-24" />
                  </label>
                  <MzMediaField v-model="v.swatch_media_id" :label="t('admin.shop.variations.image')" />
                </template>
                <USwitch v-model="v.is_active" size="sm" :label="t('admin.shop.variations.active')" />
                <span v-if="v.product_count" class="text-caption text-muted">{{ t('admin.shop.variations.usedBy', { count: v.product_count }) }}</span>
                <div class="ms-auto flex gap-1">
                  <UButton icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="xs" :disabled="i === 0" :aria-label="`↑ ${v.labels.fr}`" @click="move(i, -1)" />
                  <UButton icon="i-lucide-arrow-down" color="neutral" variant="ghost" size="xs" :disabled="i === form.values.length - 1" :aria-label="`↓ ${v.labels.fr}`" @click="move(i, 1)" />
                  <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :disabled="v.product_count > 0" :aria-label="t('common.delete')" @click="form.values.splice(i, 1)" />
                </div>
              </div>
            </div>
            <UButton :label="t('admin.shop.variations.addValue')" icon="i-lucide-plus" size="xs" color="neutral" variant="link" class="self-start" @click="form.values.push(blankValue())" />
          </fieldset>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :label="t('common.cancel')" @click="open = false" />
          <UButton type="submit" form="variation" :label="t('common.save')" />
        </div>
      </template>
    </UModal>
  </div>
</template>
