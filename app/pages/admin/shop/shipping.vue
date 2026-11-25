<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/** Shipping profiles, zones and rates; taxes; stock locations (pickup points). Categories have their own page. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.shipping' })
// Old links to the former "Catégories" tab.
const route = useRoute()
if (route.query.tab === 'categories') await navigateTo('/admin/shop/categories', { replace: true })
const { t } = useI18n()
const admin = useAdminApi()
const { money } = useMoney()
const { can, act } = useShopAdmin()
const tab = ref('rates')
const { data: shipping, refresh } = await useAsyncData('admin-shop-shipping', () => admin.shop.shipping.get())
const { data: taxes, refresh: refreshTaxes } = await useAsyncData('admin-shop-taxes', () => admin.shop.taxes.list())
const { data: locations, refresh: refreshLocations } = await useAsyncData('admin-shop-locations', () => admin.shop.locations.list())
const LOCALES = ['fr', 'en', 'ar']

// A generic edit dialog: `kind` picks the fields and the save call.
const dialog = reactive<{ open: boolean, kind: string, id?: string, form: Json }>({ open: false, kind: '', form: {} })
// Placeholder rates (seeded, never offered at checkout): each must be opened before "Confirm all".
const seen = ref(new Set<string>())
const placeholders = computed(() => (shipping.value?.rates ?? []).filter((r: Json) => r.is_placeholder))
const allSeen = computed(() => placeholders.value.every((r: Json) => seen.value.has(r.id)))
async function confirmPlaceholders() {
  if (await act(() => admin.shop.shipping.confirmPlaceholders(placeholders.value.map((r: Json) => r.id)), t('admin.shop.shipping.placeholders.confirmed'))) await refresh()
}
function edit(kind: string, row?: Json) {
  if (kind === 'rate' && row?.is_placeholder) seen.value = new Set([...seen.value, row.id])
  const forms: Record<string, () => Json> = {
    profile: () => ({ code: row?.code ?? '', name: row?.name ?? '', is_default: row?.is_default ?? false }),
    zone: () => ({ code: row?.code ?? '', countries: (row?.country_codes ?? ['MA']).join(', '), postal: (row?.postal_code_patterns ?? []).join(', '), is_export: row?.is_export ?? false, is_active: row?.is_active ?? true, sort_order: row?.sort_order ?? 0, ...Object.fromEntries(LOCALES.map(l => [`name_${l}`, row?.names?.[l] ?? ''])) }),
    rate: () => ({ zone_id: row?.zone_id ?? shipping.value?.zones[0]?.id, profile_id: row?.profile_id ?? shipping.value?.profiles[0]?.id, code: row?.code ?? '', kind: row?.kind ?? 'flat', carrier: row?.carrier ?? '', amount: (row?.amount_minor ?? 0) / 100, per_kg: (row?.per_kg_minor ?? 0) / 100, free_over: row?.free_over_minor ? row.free_over_minor / 100 : null, min_weight: row?.min_weight_grams ?? null, max_weight: row?.max_weight_grams ?? null, days_min: row?.delivery_days_min ?? null, days_max: row?.delivery_days_max ?? null, cod: row?.allows_cash_on_delivery ?? false, cod_fee: row?.cod_fee_minor ? row.cod_fee_minor / 100 : null, is_active: row?.is_active ?? true, ...Object.fromEntries(LOCALES.map(l => [`name_${l}`, row?.translations?.[l]?.name ?? ''])) }),
    tax: () => ({ code: row?.code ?? '', rate: row ? Number(row.rate_percent) : 20, is_active: row?.is_active ?? true, ...Object.fromEntries(LOCALES.map(l => [`name_${l}`, row?.names?.[l] ?? ''])) }),
    location: () => ({ code: row?.code ?? '', is_active: row?.is_active ?? true, fulfills_online_orders: row?.fulfills_online_orders ?? true, is_pickup_point: row?.is_pickup_point ?? false, sort_order: row?.sort_order ?? 0, ...Object.fromEntries(LOCALES.flatMap(l => [[`name_${l}`, row?.translations?.[l]?.name ?? ''], [`instructions_${l}`, row?.translations?.[l]?.pickup_instructions ?? '']])) }),
  }
  Object.assign(dialog, { open: true, kind, id: row?.id, form: forms[kind]!() })
}
const cents = (v: number | null) => (v === null || v === undefined || v === 0 ? null : Math.round(Number(v) * 100))
async function save() {
  const f = dialog.form
  const names = (prefix: string) => Object.fromEntries(LOCALES.map(l => [l, f[`${prefix}_${l}`]]).filter(([, v]) => v))
  const calls: Record<string, () => Promise<Json>> = {
    profile: () => admin.shop.shipping.saveProfile(f, dialog.id),
    zone: () => admin.shop.shipping.saveZone({ code: f.code, country_codes: f.countries.split(',').map((s: string) => s.trim()).filter(Boolean), postal_code_patterns: f.postal ? f.postal.split(',').map((s: string) => s.trim()) : null, is_export: f.is_export, is_active: f.is_active, sort_order: f.sort_order, names: names('name') }, dialog.id),
    rate: () => admin.shop.shipping.saveRate({ zone_id: f.zone_id, profile_id: f.profile_id, code: f.code, kind: f.kind, carrier: f.carrier || null, amount_minor: f.kind === 'free' ? null : Math.round(f.amount * 100), per_kg_minor: f.kind === 'weight_based' ? Math.round(f.per_kg * 100) : null, free_over_minor: cents(f.free_over), min_weight_grams: f.min_weight || null, max_weight_grams: f.max_weight || null, delivery_days_min: f.days_min, delivery_days_max: f.days_max, allows_cash_on_delivery: f.cod, cod_fee_minor: f.cod ? cents(f.cod_fee) : null, is_active: f.is_active, translations: Object.fromEntries(LOCALES.map(l => [l, { name: f[`name_${l}`] }])) }, dialog.id),
    tax: () => admin.shop.taxes.save({ code: f.code, rate_percent: String(f.rate), is_active: f.is_active, names: names('name') }, dialog.id),
    location: () => admin.shop.locations.save({ code: f.code, is_active: f.is_active, fulfills_online_orders: f.fulfills_online_orders, is_pickup_point: f.is_pickup_point, sort_order: f.sort_order, address: {}, translations: Object.fromEntries(LOCALES.map(l => [l, { name: f[`name_${l}`], pickup_instructions: f[`instructions_${l}`] || null }])) }, dialog.id),
  }
  if (await act(calls[dialog.kind]!, t('admin.shop.products.saved'))) {
    dialog.open = false
    await Promise.all([refresh(), refreshTaxes(), refreshLocations()])
  }
}
const zoneName = (id: string) => shipping.value?.zones.find((z: Json) => z.id === id)?.code
const profileName = (id: string) => shipping.value?.profiles.find((p: Json) => p.id === id)?.name
const writable = computed(() => (tab.value === 'locations' ? can('shop.stock') : can('shop.pricing')))
const newKind = computed(() => ({ rates: 'rate', zones: 'zone', profiles: 'profile', taxes: 'tax', locations: 'location' } as Record<string, string>)[tab.value]!)
const textFields = computed(() => Object.keys(dialog.form).filter(k => typeof dialog.form[k] === 'string' && !['kind', 'zone_id', 'profile_id', 'carrier'].includes(k)))
const numberFields = computed(() => Object.keys(dialog.form).filter(k => typeof dialog.form[k] === 'number' || dialog.form[k] === null))
const boolFields = computed(() => Object.keys(dialog.form).filter(k => typeof dialog.form[k] === 'boolean'))
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.shop.nav.shipping')">
      <template #actions><UButton v-if="writable" icon="i-lucide-plus" :label="t('admin.shop.shipping.add')" @click="edit(newKind)" /></template>
    </MzPageHeader>
    <UTabs v-model="tab" :items="['rates', 'zones', 'profiles', 'taxes', 'locations'].map(v => ({ value: v, label: t(`admin.shop.shipping.tabs.${v}`) }))" variant="link" :content="false" />
    <UAlert
      v-if="tab === 'rates' && placeholders.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      data-testid="placeholder-rates"
      :title="t('admin.shop.shipping.placeholders.title', { n: placeholders.length })"
      :description="t('admin.shop.shipping.placeholders.text', { seen: placeholders.filter((r: Json) => seen.has(r.id)).length, n: placeholders.length })"
      :actions="writable ? [{ label: t('admin.shop.shipping.placeholders.confirmAll'), disabled: !allSeen, onClick: confirmPlaceholders }] : undefined"
    />
    <table class="w-full text-small">
      <tbody v-if="tab === 'rates'">
        <tr v-for="r in shipping?.rates ?? []" :key="r.id" class="cursor-pointer border-t border-default hover:bg-elevated" @click="writable && edit('rate', r)">
          <td class="p-2 font-medium">
            {{ r.translations.fr?.name ?? r.code }}
            <UBadge v-if="r.is_placeholder" :color="seen.has(r.id) ? 'neutral' : 'warning'" variant="soft" size="sm" class="ms-2" :icon="seen.has(r.id) ? 'i-lucide-eye' : undefined" :label="t('admin.shop.shipping.placeholders.badge')" data-testid="placeholder-badge" />
            <span v-if="r.min_weight_grams !== null || r.max_weight_grams !== null" class="ms-2 text-muted" dir="ltr">{{ (r.min_weight_grams ?? 0) / 1000 }}–{{ (r.max_weight_grams ?? 0) / 1000 }} kg</span>
          </td><td class="p-2">{{ zoneName(r.zone_id) }} · {{ profileName(r.profile_id) }}</td>
          <td class="p-2">{{ t(`admin.shop.shipping.kinds.${r.kind}`) }} · {{ r.amount_minor !== null ? money(r.amount_minor) : '' }}<template v-if="r.per_kg_minor"> + {{ money(r.per_kg_minor) }}/kg</template><template v-if="r.free_over_minor"> · {{ t('admin.shop.shipping.freeOver', { amount: money(r.free_over_minor) }) }}</template></td>
          <td class="p-2">{{ r.carrier }}<template v-if="r.allows_cash_on_delivery"> · COD</template></td><td class="p-2">{{ r.is_active ? '' : t('admin.shop.promotions.inactive') }}</td>
        </tr>
      </tbody>
      <tbody v-else-if="tab === 'zones'">
        <tr v-for="z in shipping?.zones ?? []" :key="z.id" class="cursor-pointer border-t border-default hover:bg-elevated" @click="writable && edit('zone', z)">
          <td class="p-2 font-medium">{{ z.names.fr ?? z.code }}</td><td class="p-2">{{ z.country_codes.join(', ') }}</td><td class="p-2">{{ z.is_export ? t('admin.shop.shipping.export') : '' }}</td><td class="p-2">{{ z.is_active ? '' : t('admin.shop.promotions.inactive') }}</td>
        </tr>
      </tbody>
      <tbody v-else-if="tab === 'profiles'">
        <tr v-for="p in shipping?.profiles ?? []" :key="p.id" class="cursor-pointer border-t border-default hover:bg-elevated" @click="writable && edit('profile', p)">
          <td class="p-2 font-medium">{{ p.name }}</td><td class="p-2" dir="ltr">{{ p.code }}</td><td class="p-2">{{ t('admin.shop.shipping.products', { n: p.product_count }) }}</td><td class="p-2">{{ p.is_default ? t('admin.shop.products.default') : '' }}</td>
        </tr>
      </tbody>
      <tbody v-else-if="tab === 'taxes'">
        <tr v-for="x in taxes?.data ?? []" :key="x.id" class="cursor-pointer border-t border-default hover:bg-elevated" @click="writable && edit('tax', x)">
          <td class="p-2 font-medium">{{ x.names.fr ?? x.code }}</td><td class="p-2 tabular-nums">{{ Number(x.rate_percent) }} %</td><td class="p-2">{{ t('admin.shop.shipping.products', { n: x.product_count }) }}</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="l in locations?.data ?? []" :key="l.id" class="cursor-pointer border-t border-default hover:bg-elevated" @click="writable && edit('location', l)">
          <td class="p-2 font-medium">{{ l.translations.fr?.name ?? l.code }}</td><td class="p-2">{{ l.is_pickup_point ? t('shop.checkout.fulfillment.pickupPoint') : '' }}</td><td class="p-2">{{ l.fulfills_online_orders ? t('admin.shop.shipping.online') : '' }}</td><td class="p-2">{{ l.is_active ? '' : t('admin.shop.promotions.inactive') }}</td>
        </tr>
      </tbody>
    </table>
    <UModal v-model:open="dialog.open" :title="t(`admin.shop.shipping.tabs.${tab}`)">
      <template #body>
        <form id="ship-form" class="grid gap-3 sm:grid-cols-2" @submit.prevent="save">
          <template v-if="dialog.kind === 'rate'">
            <UFormField :label="t('admin.shop.shipping.zone')" name="zone"><USelect v-model="dialog.form.zone_id" :items="(shipping?.zones ?? []).map((z: Json) => ({ value: z.id, label: z.code }))" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.shipping.profile')" name="profile"><USelect v-model="dialog.form.profile_id" :items="(shipping?.profiles ?? []).map((p: Json) => ({ value: p.id, label: p.name }))" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.shipping.kind')" name="kind"><USelect v-model="dialog.form.kind" :items="['flat', 'weight_based', 'price_based', 'free'].map(k => ({ value: k, label: t(`admin.shop.shipping.kinds.${k}`) }))" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.orders.carrier')" name="carrier"><USelect v-model="dialog.form.carrier" :items="['', 'amana', 'ctm', 'dhl']" class="w-full" /></UFormField>
          </template>
          <UFormField v-for="k in textFields" :key="k" :label="t(`admin.shop.shipping.fields.${k.replace(/_(fr|en|ar)$/, '')}`) + (k.match(/_(fr|en|ar)$/) ? ` (${k.slice(-2)})` : '')" :name="k"><UInput v-model="dialog.form[k]" class="w-full" /></UFormField>
          <UFormField v-for="k in numberFields" :key="k" :label="t(`admin.shop.shipping.fields.${k}`)" :name="k"><UInputNumber v-model="dialog.form[k]" :step="['amount', 'per_kg', 'free_over', 'cod_fee', 'rate'].includes(k) ? 0.01 : 1" class="w-full" /></UFormField>
          <USwitch v-for="k in boolFields" :key="k" v-model="dialog.form[k]" :label="t(`admin.shop.shipping.fields.${k}`)" />
        </form>
      </template>
      <template #footer>
        <UButton v-if="dialog.kind === 'rate' && dialog.id" :label="t('common.delete')" color="error" variant="ghost" @click="act(() => admin.shop.shipping.deleteRate(dialog.id!)).then(() => { dialog.open = false; refresh() })" />
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="dialog.open = false" />
        <UButton type="submit" form="ship-form" :label="t('common.save')" />
      </template>
    </UModal>
  </div>
</template>
