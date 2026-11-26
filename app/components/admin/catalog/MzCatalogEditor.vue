<script setup lang="ts">
import type { CatalogKind, CatalogLocale, CatalogProduct, CatalogTranslation, Checklist, ItineraryStep, PackageItem, PriceRule, ProductSave, CatalogSlot } from '~/utils/catalog-admin-api'
import { CATALOG_LOCALES, apiError } from '~/utils/catalog-admin-api'
import { PUBLIC_SEGMENT, localeOfPath } from '~/utils/catalog'

/**
 * One editor for the four kinds guests book (stays, activities, packages, extras), configured
 * by `kind`. Content, media, SEO, organisation and the edited tab (itinerary, package items,
 * prices) are saved together (PATCH, one transaction, `updated_at` as optimistic lock: a 409
 * offers to reload). Units, calendar, schedules and departures are saved by their panels at
 * once. Tabs are read-only without the matching permission.
 */
const props = defineProps<{ kind: CatalogKind, id: string }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const { user } = useAuth()
const { refs, load: loadRefs, name } = useCatalogRefs()
const can = (p: string) => user.value?.permissions.includes(p) ?? false
const canWrite = computed(() => can('products.write'))
const canPrice = computed(() => can('pricing.write'))
const canInventory = computed(() => can('inventory.write'))
const isNew = computed(() => props.id === 'new')
await loadRefs()

// ---- Form ---------------------------------------------------------------------------------------
const blankTr = (): CatalogTranslation => ({
  name: '', slug: '', subtitle: '', short_description: '', description: '', highlights: [], included: [], not_included: [], what_to_bring: [],
  requirements: '', important_info: '', seo_title: '', seo_description: '', og_media_id: null,
})
const DEFAULT_DETAILS: Record<CatalogKind, Record<string, unknown>> = {
  stays: { accommodation_kind: 'nomad_tent', inventory_mode: 'unit', max_guests: 2, max_adults: null, max_children: null, standard_occupancy: 2, bed_configuration: [], surface_m2: null, min_nights: 1, max_nights: null, check_in_from: refs.value?.defaults.check_in_from ?? '14:00', check_in_until: null, check_out_until: '11:00', pool_capacity: 10 },
  activities: { location_type: 'on_site', scheduling_mode: 'fixed_slots', duration_minutes: 60, difficulty: null, min_participants: 1, max_participants: null, min_age: null, is_guided: false, guide_languages: [], meeting_place_id: null, booking_cutoff_hours: 12, pickup_available: false, standalone_bookable: true },
  packages: { duration_days: 2, duration_nights: 1, pricing_mode: 'fixed', discount_percent: null },
  extras: { applies_to: 'accommodation', max_quantity: null, requires_date: false, stock_quantity: null },
}
interface Form {
  sku: string
  booking_mode: CatalogProduct['booking_mode']
  is_featured: boolean
  place_id: string | null
  cover_media_id: string | null
  video_media_id: string | null
  gallery_media_ids: string[]
  translations: Record<CatalogLocale, CatalogTranslation>
  category_ids: string[]
  primary_category_id: string | null
  tag_ids: string[]
  amenity_ids: string[]
  related_ids: string[]
  extras: { extra_product_id: string, is_mandatory: boolean }[]
  details: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  itinerary: ItineraryStep[]
  items: PackageItem[]
  prices: PriceRule[]
  tax_ids: string[]
}
const product = ref<CatalogProduct | null>(null)
const form = ref<Form>(fresh(null))
const saved = ref('')
const itemInfo = ref<Record<string, PackageItem>>({})
const sampleDate = ref<string | undefined>(undefined)
const allowedUnits = ref<string[]>([])

function fresh(p: CatalogProduct | null): Form {
  return {
    sku: p?.sku ?? '',
    booking_mode: p?.booking_mode ?? (props.kind === 'activities' ? 'instant' : 'instant'),
    is_featured: p?.is_featured ?? false,
    place_id: p?.place_id ?? null,
    cover_media_id: p?.cover_media_id ?? null,
    video_media_id: p?.video_media_id ?? null,
    gallery_media_ids: p?.gallery_media_ids ?? [],
    translations: Object.fromEntries(CATALOG_LOCALES.map(l => [l, { ...blankTr(), ...(p?.translations[l] ?? {}) }])) as Record<CatalogLocale, CatalogTranslation>,
    // The primary category first (the picker's order decides it).
    category_ids: p ? [...(p.primary_category_id ? [p.primary_category_id] : []), ...p.category_ids.filter(c => c !== p.primary_category_id)] : [],
    primary_category_id: p?.primary_category_id ?? null,
    tag_ids: p?.tag_ids ?? [],
    amenity_ids: p?.amenity_ids ?? [],
    related_ids: p?.related_ids ?? [],
    extras: p?.extras ?? [],
    details: { ...DEFAULT_DETAILS[props.kind], ...(p?.details ?? {}) },
    itinerary: [],
    items: [],
    prices: [],
    tax_ids: p?.tax_ids ?? [],
  }
}
const snapshot = () => JSON.stringify(form.value)
const dirty = computed(() => snapshot() !== saved.value)

async function load() {
  if (isNew.value) {
    form.value = fresh(null)
    saved.value = snapshot()
    return
  }
  const p = await api.catalog.get(props.kind, props.id)
  product.value = p
  const f = fresh(p)
  const tasks: Promise<unknown>[] = []
  if (props.kind === 'activities' || props.kind === 'packages') {
    tasks.push(api.catalog.itinerary(props.kind, props.id).then((r) => { f.itinerary = r.data.map(({ id: _, ...s }) => ({ ...s, translations: s.translations ?? {} })) }))
  }
  if (props.kind === 'packages') {
    tasks.push(api.catalog.items(props.id).then((r) => {
      sampleDate.value = r.date
      itemInfo.value = Object.fromEntries(r.data.map(i => [i.item_product_id, i]))
      f.items = r.data.map(i => ({ item_product_id: i.item_product_id, quantity: i.quantity, day_number: i.day_number, is_optional: i.is_optional, kind: i.kind }))
    }))
  }
  tasks.push(api.catalog.prices(props.kind, props.id).then((r) => {
    allowedUnits.value = r.allowed_units
    f.prices = r.data
  }))
  await Promise.all(tasks)
  form.value = f
  saved.value = snapshot()
  await refreshChecklist()
}

const checklist = ref<Checklist | null>(null)
async function refreshChecklist() {
  if (!isNew.value) checklist.value = await api.catalog.checklist(props.kind, props.id).catch(() => null)
}

// ---- Errors -------------------------------------------------------------------------------------
const errors = ref<Record<string, string>>({})
const errorLocales = computed(() => [...new Set(Object.keys(errors.value).map(localeOfPath).filter(Boolean))] as CatalogLocale[])
const err = (path: string) => (errors.value[path] ? t(`admin.catalog.errors.${errors.value[path]}`) : undefined)
const stale = ref(false)

// ---- Save ---------------------------------------------------------------------------------------
const saving = ref(false)
function body(): ProductSave {
  const f = form.value
  const before = product.value
  const out: ProductSave = {
    updated_at: before?.updated_at, sku: f.sku || null, booking_mode: f.booking_mode, is_featured: f.is_featured, place_id: f.place_id,
    cover_media_id: f.cover_media_id, video_media_id: f.video_media_id, gallery_media_ids: f.gallery_media_ids,
    translations: f.translations, category_ids: f.category_ids, primary_category_id: f.category_ids[0] ?? null, tag_ids: f.tag_ids,
    amenity_ids: f.amenity_ids, related_ids: f.related_ids, extras: f.extras, details: f.details,
  }
  // The edited tabs go with the same save (only when they changed, and only with the right to).
  const was = saved.value ? (JSON.parse(saved.value) as Form) : null
  if (!isNew.value && was) {
    if (JSON.stringify(was.itinerary) !== JSON.stringify(f.itinerary)) out.itinerary = f.itinerary
    if (JSON.stringify(was.items) !== JSON.stringify(f.items)) out.items = f.items.map(({ item_product_id, quantity, day_number, is_optional }) => ({ item_product_id, quantity, day_number, is_optional }))
    if (canPrice.value && JSON.stringify(was.prices) !== JSON.stringify(f.prices)) out.prices = f.prices.map(({ ambiguous_with: _, ...r }) => r)
    if (canPrice.value && JSON.stringify(was.tax_ids) !== JSON.stringify(f.tax_ids)) (out as ProductSave & { tax_ids: string[] }).tax_ids = f.tax_ids
  }
  return out
}
async function save() {
  saving.value = true
  errors.value = {}
  try {
    if (isNew.value) {
      const p = await api.catalog.create(props.kind, body())
      saved.value = snapshot()
      toast.add({ title: t('admin.catalog.created'), color: 'success' })
      await navigateTo(`/admin/catalog/${props.kind}/${p.id}`, { replace: true })
      return
    }
    const p = await api.catalog.save(props.kind, props.id, body())
    if (p.save_report?.slots?.kept_booked.length) toast.add({ title: t('admin.catalog.schedules.keptBooked', { n: p.save_report.slots.kept_booked.length }), color: 'warning' })
    toast.add({ title: t('admin.catalog.saved'), color: 'success' })
    await load()
  }
  catch (e) {
    const er = apiError(e)
    if (er.code === 'stale') stale.value = true
    else if (er.code === 'invalid_fields') {
      errors.value = er.details?.fields ?? {}
      toast.add({ title: t('admin.catalog.errors.invalid_fields'), color: 'error' })
    }
    else if (er.code === 'publish_blocked') {
      checklist.value = er.details?.checklist ?? checklist.value
      toast.add({ title: t('admin.catalog.errors.publish_blocked'), color: 'error' })
    }
    else toast.add({ title: er.code ? t(`admin.catalog.errors.${er.code}`) : t('shop.errors.generic'), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
async function reload() {
  stale.value = false
  await load()
}
function discard() {
  form.value = JSON.parse(saved.value) as Form
  errors.value = {}
}

// ---- Status -------------------------------------------------------------------------------------
const busy = ref(false)
const blockedBy = ref<{ packages: { id: string, name: string }[], mandatory_extra_of: { id: string, name: string, segment: CatalogKind | null }[] } | null>(null)
async function status(action: 'publish' | 'unpublish' | 'archive') {
  if (dirty.value) {
    toast.add({ title: t('admin.catalog.saveFirst'), color: 'warning' })
    return
  }
  busy.value = true
  blockedBy.value = null
  try {
    product.value = await api.catalog.setStatus(props.kind, props.id, action)
    toast.add({ title: t(`admin.catalog.statusDone.${action}`), color: 'success' })
    await refreshChecklist()
  }
  catch (e) {
    const er = apiError(e)
    if (er.code === 'in_use') blockedBy.value = er.details as unknown as typeof blockedBy.value
    else if (er.code === 'publish_blocked') checklist.value = er.details?.checklist ?? checklist.value
    toast.add({ title: t(`admin.catalog.errors.${er.code ?? 'generic'}`), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
const deleting = ref(false)
const confirmName = ref('')
const needsName = computed(() => (form.value.prices.length > 0) || props.kind === 'stays' || props.kind === 'activities')
async function remove() {
  try {
    await api.catalog.remove(props.kind, props.id, needsName.value ? confirmName.value : undefined)
    saved.value = snapshot()
    toast.add({ title: t('admin.catalog.deleted'), color: 'success' })
    await navigateTo(`/admin/catalog/${props.kind}`)
  }
  catch (e) {
    toast.add({ title: t(`admin.catalog.errors.${apiError(e).code ?? 'generic'}`), color: 'error' })
  }
}
async function duplicate() {
  try {
    const out = await api.catalog.duplicate(props.kind, props.id)
    toast.add({ title: t('admin.catalog.duplicated'), color: 'success' })
    await navigateTo(`/admin/catalog/${props.kind}/${out.id}`)
  }
  catch {
    toast.add({ title: t('shop.errors.generic'), color: 'error' })
  }
}

await load()

// ---- Tabs ---------------------------------------------------------------------------------------
const locale = ref<CatalogLocale>('fr')
const missing = computed(() => CATALOG_LOCALES.filter(l => !form.value.translations[l].name.trim()))
const slots = ref<CatalogSlot[]>([])
const maxParticipants = ref<number | null>(null)
const unitsOfStay = ref<Awaited<ReturnType<typeof api.catalog.units>>['data']>([])
async function loadUnits() {
  if (props.kind === 'stays' && !isNew.value) unitsOfStay.value = (await api.catalog.units(props.id)).data
}
await loadUnits()
const tabs = computed(() => {
  const k = props.kind
  const saved_ = !isNew.value
  return [
    { label: t('admin.catalog.tabs.general'), slot: 'general' as const, value: 'general', badge: errorLocales.value.length ? '!' : undefined },
    { label: t('admin.catalog.tabs.details'), slot: 'details' as const, value: 'details' },
    { label: t('admin.catalog.tabs.media'), slot: 'media' as const, value: 'media' },
    ...(saved_ && k === 'stays' ? [{ label: t('admin.catalog.tabs.units'), slot: 'units' as const, value: 'units' }, { label: t('admin.catalog.tabs.calendar'), slot: 'calendar' as const, value: 'calendar' }] : []),
    ...(saved_ && k === 'packages' ? [{ label: t('admin.catalog.tabs.content'), slot: 'content' as const, value: 'content' }] : []),
    ...(saved_ && (k === 'activities' || k === 'packages') ? [{ label: t('admin.catalog.tabs.programme'), slot: 'programme' as const, value: 'programme' }] : []),
    ...(saved_ && k === 'activities' && form.value.details.scheduling_mode === 'fixed_slots'
      ? [{ label: t('admin.catalog.tabs.schedules'), slot: 'schedules' as const, value: 'schedules' }, { label: t('admin.catalog.tabs.departures'), slot: 'departures' as const, value: 'departures' }]
      : []),
    ...(saved_ && k === 'activities' ? [{ label: t('admin.catalog.tabs.resources'), slot: 'resources' as const, value: 'resources' }] : []),
    ...(saved_ ? [{ label: t('admin.catalog.tabs.pricing'), slot: 'pricing' as const, value: 'pricing' }] : []),
    { label: t('admin.catalog.tabs.seo'), slot: 'seo' as const, value: 'seo' },
    { label: t('admin.catalog.tabs.related'), slot: 'related' as const, value: 'related' },
  ]
})
const route = useRoute()
const tab = computed({
  get: () => (typeof route.query.tab === 'string' ? route.query.tab : 'general'),
  set: v => navigateTo({ query: { ...route.query, tab: v } }, { replace: true }),
})

// Options.
const ACC_KINDS = ['tent_pitch', 'campervan_pitch', 'caravan_pitch', 'furnished_tent', 'nomad_tent', 'bivouac', 'bungalow', 'room', 'dormitory_bed', 'other']
const BOOKING_MODES = ['instant', 'on_request', 'not_bookable'] as const
const onRequestForced = computed(() => props.kind === 'activities' && form.value.details.scheduling_mode === 'on_request')
watch(onRequestForced, (forced) => { if (forced && form.value.booking_mode === 'instant') form.value.booking_mode = 'on_request' })
const pathPrefix = (l: CatalogLocale) => `${l === 'fr' ? '' : `/${l}`}/${PUBLIC_SEGMENT[props.kind] ?? ''}`
const title = computed(() => form.value.translations.fr.name || t(`admin.catalog.new.${props.kind}`))
const breadcrumbs = computed(() => [{ label: t('admin.catalog.title') }, { label: t(`admin.catalog.nav.${props.kind}`), to: `/admin/catalog/${props.kind}` }, { label: title.value }])
const textGen = useTranslationGenerate()
const generateTexts = () => textGen.generate(
  Object.fromEntries(['name', 'subtitle', 'short_description', 'requirements', 'important_info'].map(k => [k, String(form.value.translations.fr[k as keyof CatalogTranslation] ?? '')])),
  form.value.translations as unknown as Record<string, Record<string, string>>,
)
const taxSuggestion = computed(() => (props.kind === 'stays' ? refs.value?.taxes.find(x => x.calc_type === 'fixed_per_person_per_night') : undefined))
const extrasPicked = computed({
  get: () => form.value.extras.map(e => e.extra_product_id),
  set: (ids: string[]) => { form.value.extras = ids.map(id => form.value.extras.find(e => e.extra_product_id === id) ?? { extra_product_id: id, is_mandatory: false }) },
})
const mediaKnown = computed(() => product.value?.media ?? {})
const altIds = computed(() => [form.value.cover_media_id, ...form.value.gallery_media_ids].filter((x): x is string => !!x))
function onAltSaved(id: string, alt: Partial<Record<CatalogLocale, string>>) {
  if (product.value) product.value.media[id] = { ...(product.value.media[id] ?? { url: null, kind: 'image' }), alt }
  refreshChecklist()
}
</script>

<template>
  <MzEditorShell :title="title" :breadcrumbs="breadcrumbs" :dirty="dirty" :saving="saving" :read-only="!canWrite" @save="save" @discard="discard">
    <template #actions>
      <UButton v-if="product && PUBLIC_SEGMENT[props.kind] && product.paths.fr" :to="product.paths.fr" target="_blank" :label="t('admin.catalog.view')" icon="i-lucide-external-link" color="neutral" variant="ghost" />
      <UButton v-if="!isNew && canWrite" :label="t('admin.catalog.duplicate')" icon="i-lucide-copy" color="neutral" variant="outline" data-testid="duplicate" @click="duplicate" />
      <UButton v-if="canWrite" :label="t('common.save')" icon="i-lucide-save" :loading="saving" data-testid="save-top" @click="save" />
    </template>
    <template #banner>
      <UAlert v-if="stale" color="warning" variant="soft" icon="i-lucide-refresh-cw" :title="t('admin.catalog.stale')" data-testid="stale">
        <template #actions><UButton :label="t('admin.catalog.reload')" size="sm" @click="reload" /></template>
      </UAlert>
      <UAlert v-if="blockedBy" color="warning" variant="soft" :title="t('admin.catalog.errors.in_use')">
        <template #description>
          <ul class="mt-1 text-small">
            <li v-for="p in blockedBy.packages" :key="p.id"><ULink :to="`/admin/catalog/packages/${p.id}`" class="underline">{{ p.name }}</ULink></li>
            <li v-for="p in blockedBy.mandatory_extra_of" :key="p.id"><ULink :to="p.segment ? `/admin/catalog/${p.segment}/${p.id}` : undefined" class="underline">{{ p.name }}</ULink></li>
          </ul>
        </template>
      </UAlert>
    </template>

    <UTabs v-model="tab" :items="tabs" variant="link" class="w-full" :unmount-on-hide="false">
      <template #general>
        <div class="flex flex-col gap-4 pt-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <p class="max-w-2xl text-small text-muted">{{ t('admin.catalog.generalIntro') }}</p>
            <MzGenerateButton v-if="canWrite" :generating="textGen.generating.value" :error="textGen.error.value" :disabled="!form.translations.fr.name.trim()" @click="generateTexts" />
          </div>
          <MzLocaleTabs v-model="locale" :missing="missing" :errors="errorLocales">
            <template #default="{ locale: l }">
              <div class="grid gap-4">
                <UFormField :label="t('admin.catalog.fields.name')" :name="`name-${l}`" :required="l === 'fr'" :error="err(`translations.${l}.name`)">
                  <UInput v-model="form.translations[l].name" class="w-full" :data-testid="`name-${l}`" />
                </UFormField>
                <UFormField :label="t('admin.catalog.fields.subtitle')" :name="`subtitle-${l}`">
                  <UInput :model-value="form.translations[l].subtitle ?? ''" class="w-full" @update:model-value="v => (form.translations[l].subtitle = String(v))" />
                </UFormField>
                <UFormField :label="t('admin.catalog.fields.shortDescription')" :name="`short-${l}`" :required="l === 'fr'" :hint="`${(form.translations[l].short_description ?? '').length} / 300`">
                  <UTextarea :model-value="form.translations[l].short_description ?? ''" :rows="2" class="w-full" :data-testid="`short-${l}`" @update:model-value="v => (form.translations[l].short_description = String(v))" />
                </UFormField>
                <MzRichTextField :model-value="form.translations[l].description ?? ''" :label="t('admin.catalog.fields.description')" @update:model-value="v => (form.translations[l].description = v ?? null)" />
                <div class="grid gap-4 md:grid-cols-2">
                  <MzStringList v-model="form.translations[l].highlights" :label="t('admin.catalog.fields.highlights')" />
                  <MzStringList v-model="form.translations[l].included" :label="t('admin.catalog.fields.included')" />
                  <MzStringList v-model="form.translations[l].not_included" :label="t('admin.catalog.fields.notIncluded')" />
                  <MzStringList v-model="form.translations[l].what_to_bring" :label="t('admin.catalog.fields.whatToBring')" />
                </div>
                <UFormField :label="t('admin.catalog.fields.requirements')" :name="`req-${l}`">
                  <UTextarea :model-value="form.translations[l].requirements ?? ''" :rows="2" class="w-full" @update:model-value="v => (form.translations[l].requirements = String(v))" />
                </UFormField>
                <UFormField :label="t('admin.catalog.fields.importantInfo')" :name="`info-${l}`">
                  <UTextarea :model-value="form.translations[l].important_info ?? ''" :rows="2" class="w-full" @update:model-value="v => (form.translations[l].important_info = String(v))" />
                </UFormField>
              </div>
            </template>
          </MzLocaleTabs>
        </div>
      </template>

      <template #details>
        <div class="grid max-w-3xl gap-4 pt-4 sm:grid-cols-2" data-testid="details">
          <template v-if="props.kind === 'stays'">
            <UFormField :label="t('admin.catalog.stay.kind')" name="acc-kind">
              <USelect v-model="form.details.accommodation_kind" :items="ACC_KINDS.map(k => ({ value: k, label: t(`admin.catalog.stay.kinds.${k}`) }))" class="w-full" />
            </UFormField>
            <UFormField v-if="isNew" :label="t('admin.catalog.units.mode')" name="acc-mode">
              <USelect v-model="form.details.inventory_mode" :items="[{ value: 'unit', label: t('admin.catalog.units.modeUnit') }, { value: 'pool', label: t('admin.catalog.units.modePool') }]" class="w-full" />
            </UFormField>
            <UFormField v-if="isNew && form.details.inventory_mode === 'pool'" :label="t('admin.catalog.units.poolCapacity')" name="acc-pool"><UInputNumber v-model="form.details.pool_capacity" :min="0" class="w-full" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.maxGuests')" name="max-guests" :error="err('details.max_guests')"><UInputNumber v-model="form.details.max_guests" :min="1" class="w-full" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.standardOccupancy')" name="std-occ" :help="t('admin.catalog.stay.standardOccupancyHint', { n: form.details.standard_occupancy })" :error="err('details.standard_occupancy')">
              <UInputNumber v-model="form.details.standard_occupancy" :min="1" :max="form.details.max_guests" class="w-full" />
            </UFormField>
            <UFormField :label="t('admin.catalog.stay.maxAdults')" name="max-adults" :error="err('details.max_adults')"><UInputNumber :model-value="form.details.max_adults ?? undefined" :min="1" class="w-full" @update:model-value="v => (form.details.max_adults = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.maxChildren')" name="max-children" :error="err('details.max_children')"><UInputNumber :model-value="form.details.max_children ?? undefined" :min="0" class="w-full" @update:model-value="v => (form.details.max_children = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.minNights')" name="min-nights" :error="err('details.min_nights')"><UInputNumber v-model="form.details.min_nights" :min="1" class="w-full" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.maxNights')" name="max-nights" :error="err('details.max_nights')"><UInputNumber :model-value="form.details.max_nights ?? undefined" :min="form.details.min_nights" class="w-full" @update:model-value="v => (form.details.max_nights = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.surface')" name="surface" :error="err('details.surface_m2')"><UInput :model-value="form.details.surface_m2 ?? ''" inputmode="decimal" class="w-full" @update:model-value="v => (form.details.surface_m2 = String(v) || null)" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.checkInFrom')" name="ci-from"><UInput :model-value="(form.details.check_in_from ?? '').slice(0, 5)" type="time" class="w-full" @update:model-value="v => (form.details.check_in_from = (v as string) || null)" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.checkInUntil')" name="ci-until" :error="err('details.check_in_until')"><UInput :model-value="(form.details.check_in_until ?? '').slice(0, 5)" type="time" class="w-full" @update:model-value="v => (form.details.check_in_until = (v as string) || null)" /></UFormField>
            <UFormField :label="t('admin.catalog.stay.checkOutUntil')" name="co-until"><UInput :model-value="(form.details.check_out_until ?? '').slice(0, 5)" type="time" class="w-full" @update:model-value="v => (form.details.check_out_until = (v as string) || null)" /></UFormField>
            <fieldset class="flex flex-col gap-2 sm:col-span-2">
              <legend class="text-small font-medium">{{ t('admin.catalog.stay.beds') }}</legend>
              <div v-for="(b, i) in form.details.bed_configuration" :key="i" class="flex items-center gap-2">
                <USelect v-model="b.type" :items="['single', 'double', 'bunk', 'sofa_bed', 'mattress'].map(x => ({ value: x, label: t(`admin.catalog.stay.bedTypes.${x}`) }))" size="sm" class="w-40" :aria-label="t('admin.catalog.stay.bedType')" />
                <UInputNumber v-model="b.count" :min="1" size="sm" class="w-24" :aria-label="t('admin.catalog.stay.bedCount')" />
                <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="form.details.bed_configuration.splice(i, 1)" />
              </div>
              <UButton :label="t('admin.catalog.stay.addBed')" icon="i-lucide-plus" size="xs" color="neutral" variant="link" class="self-start" @click="form.details.bed_configuration.push({ type: 'double', count: 1 })" />
            </fieldset>
          </template>
          <template v-else-if="props.kind === 'activities'">
            <UFormField :label="t('admin.catalog.activity.location')" name="loc"><USelect v-model="form.details.location_type" :items="['on_site', 'off_site'].map(x => ({ value: x, label: t(`admin.catalog.activity.locations.${x}`) }))" class="w-full" /></UFormField>
            <UFormField :label="t('admin.catalog.activity.scheduling')" name="sched" class="sm:col-span-2">
              <URadioGroup v-model="form.details.scheduling_mode" :items="['fixed_slots', 'on_request', 'anytime'].map(x => ({ value: x, label: t(`admin.catalog.activity.modes.${x}`), description: t(`admin.catalog.activity.modeHints.${x}`) }))" />
            </UFormField>
            <UFormField :label="t('admin.catalog.activity.duration')" name="dur" :error="err('details.duration_minutes')"><UInputNumber :model-value="form.details.duration_minutes ?? undefined" :min="1" class="w-full" @update:model-value="v => (form.details.duration_minutes = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.activity.difficulty')" name="diff"><USelect :model-value="form.details.difficulty ?? undefined" :items="[{ value: undefined, label: '—' }, ...['easy', 'moderate', 'challenging', 'extreme'].map(x => ({ value: x, label: t(`admin.catalog.activity.difficulties.${x}`) }))]" class="w-full" @update:model-value="v => (form.details.difficulty = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.activity.minParticipants')" name="minp"><UInputNumber v-model="form.details.min_participants" :min="1" class="w-full" /></UFormField>
            <UFormField :label="t('admin.catalog.activity.maxParticipants')" name="maxp" :error="err('details.max_participants')"><UInputNumber :model-value="form.details.max_participants ?? undefined" :min="form.details.min_participants" class="w-full" @update:model-value="v => (form.details.max_participants = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.activity.minAge')" name="age"><UInputNumber :model-value="form.details.min_age ?? undefined" :min="0" class="w-full" @update:model-value="v => (form.details.min_age = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.activity.cutoff')" name="cutoff" :help="t('admin.catalog.activity.cutoffHint')"><UInputNumber v-model="form.details.booking_cutoff_hours" :min="0" class="w-full" /></UFormField>
            <UFormField :label="t('admin.catalog.activity.languages')" name="langs" :help="t('admin.catalog.activity.languagesHint')">
              <UInputTags v-model="form.details.guide_languages" class="w-full" />
            </UFormField>
            <div class="flex flex-col gap-2">
              <USwitch v-model="form.details.is_guided" :label="t('admin.catalog.activity.guided')" />
              <USwitch v-model="form.details.pickup_available" :label="t('admin.catalog.activity.pickup')" />
              <USwitch v-model="form.details.standalone_bookable" :label="t('admin.catalog.activity.standalone')" />
            </div>
            <div class="sm:col-span-2"><MzEntityPicker :model-value="form.details.meeting_place_id ?? undefined" kind="place" :label="t('admin.catalog.activity.meetingPlace')" @update:model-value="v => (form.details.meeting_place_id = v ?? null)" /></div>
          </template>
          <template v-else-if="props.kind === 'packages'">
            <UFormField :label="t('admin.catalog.package.days')" name="days" :error="err('details.duration_days')"><UInputNumber :model-value="form.details.duration_days ?? undefined" :min="1" class="w-full" @update:model-value="v => (form.details.duration_days = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.package.nights')" name="nights" :error="err('details.duration_nights')"><UInputNumber :model-value="form.details.duration_nights ?? undefined" :min="0" class="w-full" @update:model-value="v => (form.details.duration_nights = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.package.pricingMode')" name="pmode" class="sm:col-span-2">
              <URadioGroup v-model="form.details.pricing_mode" :items="['fixed', 'sum_of_items', 'sum_minus_discount'].map(x => ({ value: x, label: t(`admin.catalog.package.modes.${x}`), description: t(`admin.catalog.package.modeHints.${x}`) }))" />
            </UFormField>
            <UFormField v-if="form.details.pricing_mode === 'sum_minus_discount'" :label="t('admin.catalog.package.discount')" name="discount" required :error="err('details.discount_percent')">
              <UInput :model-value="form.details.discount_percent ?? ''" inputmode="decimal" class="w-full" data-testid="discount" @update:model-value="v => (form.details.discount_percent = String(v) || null)"><template #trailing>%</template></UInput>
            </UFormField>
          </template>
          <template v-else>
            <UFormField :label="t('admin.catalog.extra.appliesTo')" name="applies"><USelect v-model="form.details.applies_to" :items="['booking', 'accommodation', 'activity', 'any'].map(x => ({ value: x, label: t(`admin.catalog.extra.targets.${x}`) }))" class="w-full" /></UFormField>
            <UFormField :label="t('admin.catalog.extra.maxQuantity')" name="maxq"><UInputNumber :model-value="form.details.max_quantity ?? undefined" :min="1" class="w-full" @update:model-value="v => (form.details.max_quantity = v ?? null)" /></UFormField>
            <UFormField :label="t('admin.catalog.extra.stock')" name="stock" :help="t('admin.catalog.extra.stockHint')"><UInputNumber :model-value="form.details.stock_quantity ?? undefined" :min="0" class="w-full" @update:model-value="v => (form.details.stock_quantity = v ?? null)" /></UFormField>
            <USwitch v-model="form.details.requires_date" :label="t('admin.catalog.extra.requiresDate')" />
          </template>
        </div>
      </template>

      <template #media>
        <div class="flex max-w-3xl flex-col gap-4 pt-4">
          <MzMediaField :model-value="form.cover_media_id ?? undefined" purpose="cover" @update:model-value="v => (form.cover_media_id = (v as string) ?? null)" />
          <MzMediaField :model-value="form.video_media_id ?? undefined" :kinds="['video']" purpose="video" @update:model-value="v => (form.video_media_id = (v as string) ?? null)" />
          <MzMediaField v-model="form.gallery_media_ids" multiple purpose="gallery" />
          <MzMediaAlt v-if="!isNew" :ids="altIds" :known="mediaKnown" @saved="onAltSaved" />
          <p v-else class="text-small text-muted">{{ t('admin.catalog.altAfterSave') }}</p>
        </div>
      </template>

      <template #units>
        <div class="pt-4"><MzUnitsPanel :product-id="props.id" :can-write="canInventory" @changed="() => { loadUnits(); refreshChecklist() }" /></div>
      </template>
      <template #calendar>
        <div class="pt-4"><MzStayCalendar :product-id="props.id" :can-write="canInventory" :inventory-mode="form.details.inventory_mode" :units="unitsOfStay" /></div>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 pt-4">
          <MzPackageItems v-model="form.items" :duration-days="form.details.duration_days" :duration-nights="form.details.duration_nights" :known="itemInfo" :sample-date="sampleDate" :api-errors="errors" />
          <MzPackageCheck :product-id="props.id" />
        </div>
      </template>
      <template #programme>
        <div class="pt-4"><MzItineraryEditor v-model="form.itinerary" :max-day="props.kind === 'packages' ? form.details.duration_days : null" :errors="errors" /></div>
      </template>
      <template #schedules>
        <div class="pt-4"><MzSchedulesPanel :product-id="props.id" :can-write="canInventory" :max-participants="maxParticipants" @saved="refreshChecklist" /></div>
      </template>
      <template #departures>
        <div class="pt-4"><MzDeparturesPanel :product-id="props.id" :can-write="canInventory" @loaded="s => (slots = s)" /></div>
      </template>
      <template #resources>
        <div class="pt-4"><MzRequirementsPanel :product-id="props.id" :can-write="canInventory" @max="n => (maxParticipants = n)" /></div>
      </template>

      <template #pricing>
        <fieldset :disabled="!canPrice" class="flex flex-col gap-6 pt-4">
          <legend class="sr-only">{{ t('admin.catalog.tabs.pricing') }}</legend>
          <p v-if="!canPrice" class="text-small text-muted">{{ t('admin.catalog.readOnlyPricing') }}</p>
          <template v-if="props.kind === 'packages' && form.details.pricing_mode !== 'fixed'">
            <UAlert color="neutral" variant="soft" icon="i-lucide-sigma" :title="t('admin.catalog.package.computed')" :description="t('admin.catalog.package.computedHint')" />
          </template>
          <MzPriceRulesGrid v-else v-model="form.prices" :kind="props.kind" :allowed-units="allowedUnits" :refs="refs!" :read-only="!canPrice" :errors="errors" />
          <section class="flex flex-col gap-2" :aria-label="t('admin.catalog.taxes.title')">
            <h3 class="font-medium">{{ t('admin.catalog.taxes.title') }}</h3>
            <UCheckboxGroup v-model="form.tax_ids" :items="(refs?.taxes ?? []).filter(x => x.is_active).map(x => ({ value: x.id, label: name(x) }))" />
            <p v-if="taxSuggestion && !form.tax_ids.includes(taxSuggestion.id)" class="text-small text-muted">
              {{ t('admin.catalog.taxes.suggest', { name: name(taxSuggestion) }) }}
              <UButton :label="t('admin.catalog.taxes.add')" size="xs" variant="link" @click="form.tax_ids = [...form.tax_ids, taxSuggestion!.id]" />
            </p>
          </section>
          <p class="text-small text-muted">{{ t('admin.catalog.pricingSettings') }}
            <ULink to="/admin/catalog/pricing/seasons" class="underline">{{ t('admin.catalog.nav.seasons') }}</ULink> ·
            <ULink to="/admin/catalog/pricing/rate-plans" class="underline">{{ t('admin.catalog.nav.ratePlans') }}</ULink> ·
            <ULink to="/admin/catalog/pricing/guest-categories" class="underline">{{ t('admin.catalog.nav.guestCategories') }}</ULink> ·
            <ULink to="/admin/catalog/pricing/cancellation-policies" class="underline">{{ t('admin.catalog.nav.policies') }}</ULink>
          </p>
        </fieldset>
        <div class="pt-6"><MzPriceSimulator v-if="refs" :kind="props.kind" :product-id="props.id" :refs="refs" :slots="slots" /></div>
      </template>

      <template #seo>
        <div class="pt-4">
          <MzLocaleTabs v-model="locale" :missing="missing" :errors="errorLocales">
            <template #default="{ locale: l }">
              <MzSeoFields v-model="form.translations[l]" :locale="l" :saved-path="product?.paths[l]" :saved-slug="product?.translations[l]?.slug" :path-prefix="pathPrefix(l)" :errors="errors" />
            </template>
          </MzLocaleTabs>
        </div>
      </template>

      <template #related>
        <div class="flex max-w-3xl flex-col gap-6 pt-4">
          <MzEntityPicker v-model="form.related_ids" kind="product" :kinds="['accommodation', 'activity', 'package', 'extra']" multiple :label="t('admin.catalog.related.products')" />
          <section v-if="props.kind !== 'extras'" class="flex flex-col gap-2">
            <h3 class="font-medium">{{ t('admin.catalog.related.extras') }}</h3>
            <MzEntityPicker v-model="extrasPicked" kind="product" :kinds="['extra']" multiple :label="t('admin.catalog.related.extras')" />
            <div v-for="e in form.extras" :key="e.extra_product_id" class="flex items-center gap-2 text-small">
              <USwitch v-model="e.is_mandatory" :label="t('admin.catalog.related.mandatory')" />
            </div>
          </section>
          <p class="text-small text-muted">{{ t('admin.catalog.related.blocks') }}</p>
        </div>
      </template>
    </UTabs>

    <template #aside>
      <MzPublishPanel v-if="product" :product="product" :checklist="checklist" :can-write="canWrite" :busy="busy" @publish="status('publish')" @unpublish="status('unpublish')" @archive="status('archive')" @delete="deleting = true" />
      <section class="flex flex-col gap-3 rounded-md border border-default p-4" :aria-label="t('admin.catalog.organisation')">
        <h2 class="font-medium">{{ t('admin.catalog.organisation') }}</h2>
        <UFormField v-if="props.kind !== 'extras'" :label="t('admin.catalog.bookingMode')" name="booking-mode">
          <URadioGroup v-model="form.booking_mode" :disabled="!canWrite" :items="BOOKING_MODES.map(m => ({ value: m, label: t(`admin.catalog.bookingModes.${m}`), description: t(`admin.catalog.bookingModeHints.${m}`), disabled: m === 'instant' && onRequestForced }))" />
          <template v-if="onRequestForced" #help>{{ t('admin.catalog.onRequestForced') }}</template>
        </UFormField>
        <USwitch v-model="form.is_featured" :label="t('admin.catalog.featured')" :disabled="!canWrite" />
        <MzEntityPicker :model-value="form.place_id ?? undefined" kind="place" :label="t('admin.catalog.place')" @update:model-value="v => (form.place_id = (v as string) ?? null)" />
        <UFormField :label="t('admin.catalog.categories')" name="categories" :help="form.category_ids.length > 1 ? t('admin.catalog.primaryFirst') : undefined">
          <MzEntityPicker v-model="form.category_ids" kind="category" scope="product" multiple :label="t('admin.catalog.categories')" />
        </UFormField>
        <MzEntityPicker v-model="form.tag_ids" kind="tag" multiple :label="t('admin.catalog.tags')" />
        <MzEntityPicker v-model="form.amenity_ids" kind="amenity" multiple :label="t('admin.catalog.amenities')" />
        <UFormField :label="t('admin.catalog.sku')" name="sku" :error="err('sku')"><UInput v-model="form.sku" dir="ltr" class="w-full" :disabled="!canWrite" /></UFormField>
      </section>
    </template>
  </MzEditorShell>

  <MzConfirmDialog v-model:open="deleting" danger :title="t('admin.catalog.deleteTitle')" :description="t('admin.catalog.deleteHint')" :confirm-label="t('common.delete')" @confirm="remove">
    <UFormField v-if="needsName" :label="t('admin.catalog.typeName', { name: product?.translations.fr?.name ?? '' })" name="confirm-name">
      <UInput v-model="confirmName" class="w-full" data-testid="confirm-name" />
    </UFormField>
  </MzConfirmDialog>
</template>
