<script setup lang="ts">
import type { Json } from '~/utils/shop-admin-api'

/**
 * Shop product editor: General, Translations (per language, "missing" markers), Media (media
 * library), Options & variants (matrix generation, inline grid), Food, Shipping, SEO, Related.
 * `new` creates the product with its first variant.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.products' })

const LOCALES = ['fr', 'en', 'ar'] as const
const ALLERGENS = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs']
const { t } = useI18n()
const route = useRoute()
const admin = useAdminApi()
const { money } = useMoney()
const { can, act } = useShopAdmin()
const isNew = route.params.id === 'new'
const id = ref(isNew ? '' : String(route.params.id))
const readOnly = computed(() => !can('shop.catalog'))

const blankTr = () => ({ name: '', slug: '', subtitle: '', short_description: '', description: '', seo_title: '', seo_description: '' })
const blankShopTr = () => ({ ingredients: '', storage_instructions: '', usage_tips: '', origin_story: '', producer_name: '', legal_notice: '' })
const form = ref<Json>({
  status: 'draft', is_featured: false, sort_order: 0, cover_media_id: undefined, gallery_media_ids: [],
  translations: Object.fromEntries(LOCALES.map(l => [l, blankTr()])),
  shop: { product_type: 'food', shipping_profile_id: undefined, origin_place_id: null, farm_crop_id: null, is_perishable: false, tax_class_code: 'food_reduced', bundle_vat_split: null, withdrawal_exemption: 'none', track_lots: false,
    shelf_life_days: null, allergens: [], nutrition: null, max_per_order: null, available_from: null, available_until: null,
    translations: Object.fromEntries(LOCALES.map(l => [l, blankShopTr()])) },
  category_ids: [], related_ids: [], tax_ids: [], tag_ids: [],
  variant: { sku: '', price_minor: 0, weight_grams: 500 },
})
const product = ref<Json | null>(null)
// Filled by load() below (declared first: load() runs during setup).
const options = ref<Json[]>([])
const variants = ref<Json[]>([])
async function load() {
  if (!id.value) return
  const p = await admin.shop.products.get(id.value)
  product.value = p
  form.value = {
    ...form.value, status: p.status, is_featured: p.is_featured, sort_order: p.sort_order, cover_media_id: p.cover_media_id ?? undefined,
    gallery_media_ids: p.gallery_media_ids, category_ids: p.category_ids, related_ids: p.related_ids, tax_ids: p.tax_ids, tag_ids: p.tag_ids,
    translations: Object.fromEntries(LOCALES.map(l => [l, { ...blankTr(), ...(p.translations[l] ?? {}) }])),
    shop: { ...p.shop, translations: Object.fromEntries(LOCALES.map(l => [l, { ...blankShopTr(), ...(p.shop.translations[l] ?? {}) }])) },
  }
  options.value = p.options.map((o: Json) => ({
    attribute_id: o.attribute_id ?? null, code: o.code, names: { fr: '', en: '', ar: '', ...o.names }, display_type: o.display_type ?? 'button', default_value: o.default_value ?? 'none',
    values: o.values.map((v: Json) => ({ variation_value_id: v.variation_value_id ?? null, code: v.code, labels: { fr: '', en: '', ar: '', ...v.labels }, swatch_media_id: v.swatch_media_id ?? undefined,
                                         swatch_color: v.swatch_color ?? '', adjustment: v.price_adjustment_minor != null ? v.price_adjustment_minor / 100 : null })),
  }))
  variants.value = p.variants.map((v: Json) => ({ ...v, price: v.price_minor / 100, compare: v.compare_at_price_minor ? v.compare_at_price_minor / 100 : null, cost: v.cost_minor ? v.cost_minor / 100 : null }))
}
await load()
/** Gift box VAT split: share of food (reduced rate), the rest at the standard rate. */
const foodShare = computed({
  get: () => Number((form.value.shop.bundle_vat_split as Json[] | null)?.find(x => x.tax_class_code === 'food_reduced')?.share_percent ?? 100),
  set: (n: number) => {
    const food = Math.min(100, Math.max(0, Math.round(n ?? 100)))
    form.value.shop.bundle_vat_split = food >= 100
      ? null
      : [{ tax_class_code: 'food_reduced', share_percent: food }, { tax_class_code: 'standard', share_percent: 100 - food }]
  },
})

const [{ data: shipping }, { data: taxes }, { data: allProducts }] = await Promise.all([
  useAsyncData('admin-shop-shipping', () => admin.shop.shipping.get()),
  useAsyncData('admin-shop-taxes', () => admin.shop.taxes.list()),
  useAsyncData('admin-shop-all-products', () => admin.shop.products.list({ per_page: 100 })),
])
const missing = (l: string) => !form.value.translations[l].name?.trim()

// "Générer": French (default locale) → English and Arabic, one button per tab.
const textGen = useTranslationGenerate()
const foodGen = useTranslationGenerate()
const seoGen = useTranslationGenerate()
const FOOD_FIELDS = ['ingredients', 'storage_instructions', 'usage_tips', 'origin_story', 'producer_name', 'legal_notice'] as const
const pick = (o: Json, keys: readonly string[]) => Object.fromEntries(keys.map(k => [k, o[k] ?? '']))
const generateTexts = () => textGen.generate(pick(form.value.translations.fr, ['name', 'subtitle', 'short_description', 'description']), form.value.translations)
const generateFood = () => foodGen.generate(pick(form.value.shop.translations.fr, FOOD_FIELDS), form.value.shop.translations)
const generateSeo = () => seoGen.generate(pick(form.value.translations.fr, ['seo_title', 'seo_description']), form.value.translations)

const nutritionText = ref('')
watchEffect(() => { nutritionText.value = Object.entries(form.value.shop.nutrition ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n') })
function body() {
  const nutrition = Object.fromEntries(nutritionText.value.split('\n').map(l => l.split(':').map(s => s.trim())).filter(p => p.length === 2 && p[0]))
  return { ...form.value, shop: { ...form.value.shop, nutrition: Object.keys(nutrition).length ? nutrition : null }, variant: isNew ? { ...form.value.variant, price_minor: Math.round(Number(form.value.variant.price_minor) * 100) } : undefined }
}
const saving = ref(false)
async function save() {
  saving.value = true
  const out = await act(() => (id.value ? admin.shop.products.update(id.value, body()) : admin.shop.products.create(body())), t('admin.shop.products.saved'))
  saving.value = false
  if (out && !id.value) {
    await navigateTo(`/admin/shop/products/${out.id}`)
    return
  }
  if (out) await load()
}

// Options and variants.
const gen = reactive({ price: 10, weight: 500, prefix: '', reprice: false })
const blankValue = () => ({ variation_value_id: null, code: '', labels: { fr: '', en: '', ar: '' }, swatch_media_id: undefined, swatch_color: '', adjustment: null })
const addOption = () => options.value.push({ attribute_id: null, code: '', names: { fr: '', en: '', ar: '' }, display_type: 'button', default_value: 'none', values: [blankValue()] })

// Variation library (vitecamio's variant attributes): link a shared variation, pick its values.
const { data: library } = await useAsyncData('admin-shop-variations', () => admin.shop.variations.list())
const libraryOf = (attributeId: string | null) => (library.value?.data ?? []).find(a => a.id === attributeId)
const linkable = computed(() => (library.value?.data ?? [])
  .filter(a => a.is_active && !options.value.some(o => o.attribute_id === a.id))
  // Variations of the product's categories (or of none) first.
  .sort((a, b) => Number(!!a.category_id && !form.value.category_ids.includes(a.category_id)) - Number(!!b.category_id && !form.value.category_ids.includes(b.category_id)))
  .map(a => ({ value: a.id as string, label: `${a.names.fr ?? a.code}${a.admin_label ? ` (${a.admin_label})` : ''}` })))
const toLink = ref<string | undefined>(undefined)
const fromLibrary = (v: Json) => ({ variation_value_id: v.id, code: v.code, labels: { fr: '', en: '', ar: '', ...v.labels }, swatch_media_id: undefined, swatch_color: v.swatch_color ?? '',
                                            adjustment: v.price_adjustment_minor != null ? v.price_adjustment_minor / 100 : null })
function linkVariation() {
  const a = libraryOf(toLink.value ?? null)
  if (!a || options.value.length >= 3) return
  options.value.push({ attribute_id: a.id, code: a.code, names: { fr: '', en: '', ar: '', ...a.names }, display_type: a.display_type, default_value: 'none',
                       values: a.values.filter((v: Json) => v.is_active).map((v: Json) => fromLibrary(v)) })
  toLink.value = undefined
}
/** Library values offered on a linked option: the active ones and those already chosen. */
const libraryValues = (o: Json) => (libraryOf(o.attribute_id)?.values ?? []).filter((v: Json) => v.is_active || o.values.some((x: Json) => x.variation_value_id === v.id))
const isChosen = (o: Json, v: Json) => o.values.some((x: Json) => x.variation_value_id === v.id)
function toggleValue(o: Json, v: Json) {
  if (isChosen(o, v)) {
    o.values = o.values.filter((x: Json) => x.variation_value_id !== v.id)
    if (o.default_value === v.code) o.default_value = 'none'
  }
  else {
    // Keep the library order.
    const order = libraryValues(o).map((x: Json) => x.id)
    o.values = [...o.values, fromLibrary(v)].sort((a: Json, b: Json) => order.indexOf(a.variation_value_id) - order.indexOf(b.variation_value_id))
  }
}
const defaultItems = (o: Json) => [{ value: 'none', label: t('admin.shop.variations.none') }, ...o.values.filter((v: Json) => v.code).map((v: Json) => ({ value: v.code, label: v.labels.fr || v.code }))]
const adjustmentLabel = (euros: number | null) => euros ? `${euros > 0 ? '+' : '−'}${money(Math.round(Math.abs(euros) * 100))}` : ''

// Option names and value labels of the product's own options: flattened to `o0`, `o0v1`... for
// one request, then put back (library options are translated in the library).
const optionGen = useTranslationGenerate()
async function generateOptions() {
  const source: Record<string, string> = {}
  const target: Record<string, Record<string, string>> = Object.fromEntries(LOCALES.map(l => [l, {}]))
  options.value.forEach((o, i) => {
    if (o.attribute_id) return
    source[`o${i}`] = o.names.fr
    o.values.forEach((v: Json, j: number) => { source[`o${i}v${j}`] = v.labels.fr })
  })
  await optionGen.generate(source, target)
  for (const l of LOCALES) {
    if (l === 'fr') continue
    for (const [k, value] of Object.entries(target[l]!)) {
      const [, i, j] = k.match(/^o(\d+)(?:v(\d+))?$/) ?? []
      const o = options.value[Number(i)]
      if (!o || !value) continue
      if (j === undefined) o.names[l] = value
      else if (o.values[Number(j)]) o.values[Number(j)].labels[l] = value
    }
  }
}
async function saveOptions() {
  const body = options.value.map(o => ({
    attribute_id: o.attribute_id ?? undefined, code: o.code, names: o.attribute_id ? undefined : o.names, display_type: o.display_type,
    default_value: o.default_value === 'none' ? null : o.default_value,
    values: o.values.map((v: Json) => ({
      variation_value_id: v.variation_value_id ?? undefined, code: v.code, labels: o.attribute_id ? undefined : v.labels, swatch_media_id: v.swatch_media_id ?? null,
      swatch_color: o.attribute_id ? undefined : v.swatch_color || null, price_adjustment_minor: o.attribute_id || !v.adjustment ? undefined : Math.round(v.adjustment * 100),
    })),
  }))
  await act(() => admin.shop.products.setOptions(id.value, body), t('admin.shop.products.saved'))
  await load()
}
async function generate() {
  const out = await act(() => admin.shop.products.generate(id.value, { price_minor: Math.round(gen.price * 100), weight_grams: gen.weight, sku_prefix: gen.prefix || undefined, reprice: gen.reprice }))
  if (out) {
    const repriced = out.repriced ? ` · ${t('admin.shop.variations.generatedRepriced', { repriced: out.repriced })}` : ''
    useToast().add({ title: t('admin.shop.products.generated', { created: out.created, restored: out.restored, archived: out.archived }) + repriced, color: 'success' })
  }
  await load()
}
async function saveVariants() {
  const patches = variants.value.map(v => ({
    id: v.id, sku: v.sku, barcode: v.barcode || null, status: v.status, is_default: v.is_default, price_minor: Math.round(v.price * 100),
    compare_at_price_minor: v.compare ? Math.round(v.compare * 100) : null, cost_minor: v.cost ? Math.round(v.cost * 100) : null,
    weight_grams: Number(v.weight_grams), track_inventory: v.track_inventory, requires_shipping: v.requires_shipping,
    net_quantity: v.net_quantity || null, net_unit: v.net_quantity ? v.net_unit : null, low_stock_threshold: v.low_stock_threshold ?? null,
    country_of_origin: v.country_of_origin || null,
  }))
  await act(() => admin.shop.products.bulkVariants(id.value, patches), t('admin.shop.products.saved'))
  await load()
}
async function duplicate() {
  const out = await act(() => admin.shop.products.duplicate(id.value), t('admin.shop.products.duplicated'))
  if (out) await navigateTo(`/admin/shop/products/${out.id}`)
}
// Pages showing this product (page-builder sections that picked it), from content_block_refs.
const { data: usages } = await useAsyncData(`admin-product-usages-${id.value}`, () => (id.value ? admin.usages('product', id.value) : Promise.resolve({ usages: [] })))
const tabs = computed(() => [
  { label: t('admin.shop.products.tabs.general'), slot: 'general' as const },
  { label: t('admin.shop.products.tabs.translations'), slot: 'translations' as const, badge: LOCALES.filter(missing).length ? t('admin.shop.products.missing') : undefined },
  { label: t('admin.shop.products.tabs.media'), slot: 'media' as const },
  ...(id.value ? [{ label: t('admin.shop.products.tabs.variants'), slot: 'variants' as const }] : []),
  { label: t('admin.shop.products.tabs.food'), slot: 'food' as const },
  { label: t('admin.shop.products.tabs.seo'), slot: 'seo' as const },
  { label: t('admin.shop.products.tabs.related'), slot: 'related' as const },
])
</script>

<template>
  <div class="flex flex-col gap-6">
    <MzPageHeader :title="form.translations.fr.name || t('admin.shop.products.new')" :breadcrumbs="[{ label: t('admin.shop.nav.products'), to: '/admin/shop/products' }, { label: form.translations.fr.name || t('admin.shop.products.new') }]">
      <template #actions>
        <UButton v-if="id && !readOnly" :label="t('admin.shop.products.duplicate')" icon="i-lucide-copy" color="neutral" variant="outline" @click="duplicate" />
        <UButton v-if="!readOnly" :label="t('common.save')" icon="i-lucide-save" :loading="saving" data-testid="save-product" @click="save" />
      </template>
    </MzPageHeader>
    <section v-if="usages?.usages.length" class="flex flex-wrap items-center gap-2 text-small" data-testid="product-used-in">
      <span class="text-muted">{{ t('admin.shop.products.usedIn') }}</span>
      <UButton
v-for="u in usages.usages" :key="u.block_id" :to="u.page_id ? `/admin/pages/${u.page_id}/builder` : undefined" size="xs" color="neutral" variant="outline"
               :label="`${u.page_title ?? '—'}${u.live ? '' : ` (${t('admin.shop.products.draftOnly')})`}`" />
    </section>
    <fieldset :disabled="readOnly">
      <UTabs :items="tabs" variant="link" class="w-full">
        <template #general>
          <div class="grid max-w-3xl gap-4 pt-4 sm:grid-cols-2">
            <UFormField :label="t('admin.shop.orders.status')" name="status"><USelect v-model="form.status" :items="['draft', 'published', 'archived'].map(s => ({ value: s, label: t(`admin.shop.products.statuses.${s}`) }))" class="w-full" /></UFormField>
            <UFormField :label="t('shop.filters.type')" name="type"><USelect v-model="form.shop.product_type" :items="['food', 'drink', 'cosmetic', 'craft', 'gift_box', 'other'].map(v => ({ value: v, label: t(`shop.types.${v}`) }))" class="w-full" /></UFormField>
            <UFormField :label="t('shop.filters.category')" name="categories" class="sm:col-span-2" :hint="t('admin.shop.categories.primaryHint')">
              <MzCategoryPicker v-model="form.category_ids" multiple />
              <template #help>
                <UButton :label="t('admin.shop.categories.manage')" to="/admin/shop/categories" target="_blank" icon="i-lucide-external-link" trailing color="neutral" variant="link" size="xs" class="px-0" />
              </template>
            </UFormField>
            <UFormField :label="t('admin.shop.shipping.profile')" name="profile"><USelect v-model="form.shop.shipping_profile_id" :items="(shipping?.profiles ?? []).map((p: Json) => ({ value: p.id, label: p.name }))" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.taxes.title')" name="taxes"><USelectMenu v-model="form.tax_ids" multiple value-key="value" :items="(taxes?.data ?? []).map(x => ({ value: x.id, label: `${x.code} · ${x.rate_percent} %` }))" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.products.maxPerOrder')" name="max"><UInputNumber v-model="form.shop.max_per_order" :min="1" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.products.sortOrder')" name="sort"><UInputNumber v-model="form.sort_order" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.products.seasonFrom')" name="from"><UInput v-model="form.shop.available_from" type="datetime-local" class="w-full" /></UFormField>
            <UFormField :label="t('admin.shop.products.seasonUntil')" name="until"><UInput v-model="form.shop.available_until" type="datetime-local" class="w-full" /></UFormField>
            <USwitch v-model="form.is_featured" :label="t('shop.sort.featured')" />
            <template v-if="isNew">
              <p class="font-medium sm:col-span-2">{{ t('admin.shop.products.firstVariant') }}</p>
              <UFormField label="SKU" name="sku" required><UInput v-model="form.variant.sku" class="w-full" dir="ltr" /></UFormField>
              <UFormField :label="t('admin.shop.products.price')" name="price" required><UInputNumber v-model="form.variant.price_minor" :min="0" :step="0.01" class="w-full" /></UFormField>
              <UFormField :label="t('admin.shop.products.weight')" name="weight" required><UInputNumber v-model="form.variant.weight_grams" :min="1" class="w-full" /></UFormField>
            </template>
          </div>
        </template>
        <template #translations>
          <div class="flex flex-wrap items-start justify-between gap-3 pt-4">
            <p class="max-w-2xl text-small text-muted">{{ t('admin.translate.intro') }}</p>
            <MzGenerateButton :generating="textGen.generating.value" :error="textGen.error.value" :disabled="!form.translations.fr.name?.trim()" @click="generateTexts" />
          </div>
          <div class="grid gap-6 pt-4 lg:grid-cols-3">
            <div v-for="l in LOCALES" :key="l" class="flex flex-col gap-3" :dir="l === 'ar' ? 'rtl' : 'ltr'">
              <p class="font-medium uppercase">{{ l }} <UBadge v-if="missing(l)" color="warning" variant="soft" size="sm" :label="t('admin.shop.products.missing')" /></p>
              <UFormField :label="t('admin.shop.products.name')" :name="`name-${l}`"><UInput v-model="form.translations[l].name" class="w-full" /></UFormField>
              <UFormField :label="t('admin.shop.products.slug')" :name="`slug-${l}`" :help="product?.translations?.[l]?.slug && form.translations[l].slug !== product.translations[l].slug ? t('admin.shop.categories.slugRedirect') : undefined"><UInput v-model="form.translations[l].slug" class="w-full" dir="ltr" /></UFormField>
              <UFormField :label="t('admin.shop.products.subtitle')" :name="`subtitle-${l}`"><UInput v-model="form.translations[l].subtitle" class="w-full" /></UFormField>
              <UFormField :label="t('admin.shop.products.short')" :name="`short-${l}`"><UTextarea v-model="form.translations[l].short_description" :rows="2" class="w-full" /></UFormField>
              <UFormField :label="t('shop.product.tabs.description')" :name="`desc-${l}`"><UTextarea v-model="form.translations[l].description" :rows="6" class="w-full" /></UFormField>
            </div>
          </div>
        </template>
        <template #media>
          <div class="flex max-w-3xl flex-col gap-4 pt-4">
            <MzMediaField v-model="form.cover_media_id" purpose="shopCover" />
            <MzMediaField v-model="form.gallery_media_ids" multiple purpose="shopGallery" />
          </div>
        </template>
        <template #variants>
          <div class="flex flex-col gap-6 pt-4">
            <section class="flex flex-col gap-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-medium">{{ t('admin.shop.products.options') }}</h3>
                <UButton :label="t('admin.shop.variations.manage')" to="/admin/shop/variations" icon="i-lucide-library" color="neutral" variant="link" size="sm" />
              </div>
              <div v-for="(o, i) in options" :key="o.attribute_id ?? `custom-${i}`" class="flex flex-col gap-2 rounded-md border border-default p-3" data-testid="product-option">
                <!-- Linked to the library: names and labels come from there, the product picks values. -->
                <template v-if="o.attribute_id">
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge color="primary" variant="soft" icon="i-lucide-library" :label="t('admin.shop.variations.library')" />
                    <span class="font-medium">{{ o.names.fr || o.code }}</span>
                    <span class="text-small text-muted">{{ [o.names.en, o.names.ar].filter(Boolean).join(' · ') }}</span>
                    <UBadge color="neutral" variant="outline" :label="t(`admin.shop.variations.displays.${o.display_type}`)" />
                    <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" class="ms-auto" :aria-label="t('common.delete')" @click="options.splice(i, 1)" />
                  </div>
                  <p class="text-caption text-muted">{{ t('admin.shop.variations.fromLibrary') }}</p>
                  <div class="flex flex-wrap gap-2" role="group" :aria-label="t('admin.shop.variations.values')">
                    <UButton
                      v-for="v in libraryValues(o)"
                      :key="v.id"
                      size="sm"
                      :color="isChosen(o, v) ? 'primary' : 'neutral'"
                      :variant="isChosen(o, v) ? 'soft' : 'outline'"
                      :aria-pressed="isChosen(o, v)"
                      @click="toggleValue(o, v)"
                    >
                      <span v-if="v.swatch_color" class="size-3 rounded-full border border-default" :style="{ backgroundColor: v.swatch_color }" />
                      {{ v.labels.fr ?? v.code }}
                      <span v-if="v.price_adjustment_minor" class="text-muted tabular-nums">{{ adjustmentLabel(v.price_adjustment_minor / 100) }}</span>
                    </UButton>
                  </div>
                  <div v-if="o.display_type === 'swatch'" class="flex flex-wrap gap-3">
                    <MzMediaField v-for="v in o.values" :key="v.code" v-model="v.swatch_media_id" purpose="swatch" :label="`${t('admin.shop.variations.productImage')} · ${v.labels.fr || v.code}`" />
                  </div>
                </template>
                <!-- Product-specific option. -->
                <template v-else>
                  <div class="flex flex-wrap gap-2">
                    <UInput v-model="o.code" :placeholder="t('admin.shop.products.optionCode')" class="w-32" dir="ltr" :aria-label="t('admin.shop.products.optionCode')" />
                    <UInput v-for="l in LOCALES" :key="l" v-model="o.names[l]" :placeholder="`${t('admin.shop.products.name')} (${l})`" class="w-40" :aria-label="`${t('admin.shop.products.name')} (${l})`" />
                    <USelect v-model="o.display_type" :items="['button', 'swatch', 'dropdown'].map(d => ({ value: d, label: t(`admin.shop.variations.displays.${d}`) }))" class="w-44" :aria-label="t('admin.shop.variations.display')" />
                    <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="options.splice(i, 1)" />
                  </div>
                  <div v-for="(v, j) in o.values" :key="j" class="flex flex-wrap items-center gap-2 ps-4">
                    <UInput v-model="v.code" :placeholder="t('admin.shop.products.valueCode')" class="w-28" dir="ltr" :aria-label="t('admin.shop.products.valueCode')" />
                    <UInput v-for="l in LOCALES" :key="l" v-model="v.labels[l]" :placeholder="`${t('admin.shop.products.label')} (${l})`" class="w-36" :aria-label="`${t('admin.shop.products.label')} (${l})`" />
                    <UInputNumber v-model="v.adjustment" :step="0.5" size="sm" class="w-28" :placeholder="t('admin.shop.variations.adjustment')" :aria-label="t('admin.shop.variations.adjustment')" />
                    <template v-if="o.display_type === 'swatch'">
                      <input v-model="v.swatch_color" type="color" class="size-8 cursor-pointer rounded border border-default bg-default" :aria-label="`${t('admin.shop.variations.color')} ${v.labels.fr}`">
                      <MzMediaField v-model="v.swatch_media_id" purpose="swatch" />
                    </template>
                    <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :aria-label="t('common.delete')" @click="o.values.splice(j, 1)" />
                  </div>
                  <UButton :label="t('admin.shop.products.addValue')" icon="i-lucide-plus" size="xs" color="neutral" variant="link" class="self-start" @click="o.values.push(blankValue())" />
                </template>
                <UFormField :label="t('admin.shop.variations.default')" :name="`default-${i}`" class="w-56">
                  <USelect v-model="o.default_value" :items="defaultItems(o)" size="sm" class="w-full" />
                </UFormField>
              </div>
              <div v-if="options.length < 3" class="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-default p-3">
                <UFormField :label="t('admin.shop.variations.link')" :help="t('admin.shop.variations.linkHint')" name="link-variation">
                  <USelect v-model="toLink" :items="linkable" :placeholder="t('admin.shop.variations.pick')" class="w-64" />
                </UFormField>
                <UButton :label="t('admin.shop.variations.link')" icon="i-lucide-library" size="sm" :disabled="!toLink" @click="linkVariation" />
                <UButton :label="t('admin.shop.variations.custom')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="addOption" />
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton :label="t('admin.shop.products.saveOptions')" size="sm" @click="saveOptions" />
                <MzGenerateButton :generating="optionGen.generating.value" :error="optionGen.error.value" :disabled="!options.some(o => !o.attribute_id && o.names.fr?.trim())" @click="generateOptions" />
              </div>
              <div class="flex flex-wrap items-end gap-2">
                <UFormField :label="t('admin.shop.variations.priceBase')" :help="t('admin.shop.variations.adjustmentHint')" name="gen-price"><UInputNumber v-model="gen.price" :min="0" :step="0.01" size="sm" /></UFormField>
                <UFormField :label="t('admin.shop.products.weight')" name="gen-weight"><UInputNumber v-model="gen.weight" :min="1" size="sm" /></UFormField>
                <UFormField :label="t('admin.shop.products.skuPrefix')" name="gen-prefix"><UInput v-model="gen.prefix" size="sm" dir="ltr" /></UFormField>
                <UCheckbox v-model="gen.reprice" :label="t('admin.shop.variations.reprice')" class="mb-2" />
                <UButton :label="t('admin.shop.products.generate')" icon="i-lucide-grid-3x3" size="sm" color="neutral" variant="outline" @click="generate" />
              </div>
            </section>
            <section class="flex flex-col gap-2 overflow-x-auto">
              <h3 class="font-medium">{{ t('admin.shop.products.variantsTitle') }}</h3>
              <table class="min-w-[60rem] text-small">
                <thead><tr class="text-start text-muted"><th class="p-1 text-start">{{ t('admin.shop.products.options') }}</th><th class="p-1">SKU</th><th class="p-1">EAN</th><th class="p-1">{{ t('admin.shop.products.price') }}</th><th class="p-1">{{ t('admin.shop.products.compareAt') }}</th><th class="p-1">{{ t('admin.shop.products.lowest30') }}</th><th v-if="can('shop.pricing')" class="p-1">{{ t('admin.shop.products.cost') }}</th><th class="p-1">{{ t('admin.shop.products.weight') }}</th><th class="p-1">{{ t('admin.shop.products.net') }}</th><th class="p-1">{{ t('admin.shop.products.originCountry') }}</th><th class="p-1">{{ t('admin.shop.products.stock') }}</th><th class="p-1">{{ t('admin.shop.orders.status') }}</th><th class="p-1">{{ t('admin.shop.products.default') }}</th></tr></thead>
                <tbody>
                  <tr v-for="v in variants" :key="v.id" class="border-t border-default" :class="v.status === 'archived' && 'opacity-60'">
                    <td class="p-1">{{ Object.values(v.options).join(' · ') || '—' }}</td>
                    <td class="p-1"><UInput v-model="v.sku" size="xs" dir="ltr" class="w-36" :aria-label="`SKU ${v.sku}`" /></td>
                    <td class="p-1"><UInput v-model="v.barcode" size="xs" dir="ltr" class="w-32" :aria-label="`EAN ${v.sku}`" /></td>
                    <td class="p-1"><UInputNumber v-model="v.price" :min="0" :step="0.01" size="xs" class="w-24" :aria-label="`${t('admin.shop.products.price')} ${v.sku}`" /></td>
                    <td class="p-1"><UInputNumber v-model="v.compare" :min="0" :step="0.01" size="xs" class="w-24" :aria-label="`${t('admin.shop.products.compareAt')} ${v.sku}`" /></td>
                    <td class="p-1 text-muted tabular-nums" :title="t('admin.shop.products.lowest30Hint')">
                      {{ v.lowest_30d_minor != null ? money(v.lowest_30d_minor) : '—' }}
                      <span v-if="v.reference_price_minor != null" class="block text-caption">{{ t('admin.shop.products.referenceMax', { price: money(v.reference_price_minor) }) }}</span>
                    </td>
                    <td v-if="can('shop.pricing')" class="p-1"><UInputNumber v-model="v.cost" :min="0" :step="0.01" size="xs" class="w-24" :aria-label="`${t('admin.shop.products.cost')} ${v.sku}`" /></td>
                    <td class="p-1"><UInputNumber v-model="v.weight_grams" :min="1" size="xs" class="w-24" :aria-label="`${t('admin.shop.products.weight')} ${v.sku}`" /></td>
                    <td class="p-1"><div class="flex gap-1"><UInput v-model="v.net_quantity" size="xs" class="w-16" :aria-label="`${t('admin.shop.products.net')} ${v.sku}`" /><USelect v-model="v.net_unit" :items="['g', 'kg', 'ml', 'l', 'piece']" size="xs" class="w-20" /></div></td>
                    <td class="p-1"><UInput v-model="v.country_of_origin" size="xs" maxlength="2" dir="ltr" class="w-14 uppercase" :aria-label="`${t('admin.shop.products.originCountry')} ${v.sku}`" /></td>
                    <td class="p-1 tabular-nums">{{ v.on_hand }}<span v-if="v.reserved" class="text-muted"> ({{ v.reserved }})</span></td>
                    <td class="p-1"><USelect v-model="v.status" :items="['active', 'archived']" size="xs" class="w-24" /></td>
                    <td class="p-1"><URadioGroup :model-value="v.is_default ? v.id : ''" :items="[{ value: v.id, label: '' }]" :aria-label="t('admin.shop.products.default')" @update:model-value="() => variants.forEach(x => (x.is_default = x.id === v.id))" /></td>
                  </tr>
                </tbody>
              </table>
              <UButton :label="t('admin.shop.products.saveVariants')" class="self-start" size="sm" @click="saveVariants" />
              <p class="text-small text-muted">{{ t('admin.shop.products.priceHint', { example: money(1200) }) }}</p>
            </section>
          </div>
        </template>
        <template #food>
          <div class="flex max-w-4xl flex-col gap-4 pt-4">
            <div class="flex flex-wrap gap-6">
              <USwitch v-model="form.shop.is_perishable" :label="t('admin.shop.products.perishable')" />
              <UFormField :label="t('admin.shop.products.taxClass')" name="tax_class">
                <USelect v-model="form.shop.tax_class_code" :items="['food_reduced', 'standard', 'zero'].map(c => ({ value: c, label: t(`admin.shop.taxClasses.${c}`) }))" class="w-full" />
              </UFormField>
              <UFormField :label="t('admin.shop.products.withdrawal')" name="withdrawal" :help="form.shop.is_perishable ? t('admin.shop.products.perishableExempt') : undefined">
                <USelect v-model="form.shop.withdrawal_exemption" :disabled="form.shop.is_perishable" :items="['none', 'unsealed_hygiene', 'personalised', 'perishable'].map(c => ({ value: c, label: t(`admin.shop.exemptions.${c}`) }))" class="w-full" />
              </UFormField>
              <UFormField v-if="form.shop.product_type === 'gift_box'" :label="t('admin.shop.products.bundleSplit')" :help="t('admin.shop.products.bundleSplitHint')" name="split">
                <UInputNumber v-model="foodShare" :min="0" :max="100" :step="5" class="w-40" />
              </UFormField>
              <USwitch v-model="form.shop.track_lots" :label="t('admin.shop.products.trackLots')" />
            </div>
            <UFormField :label="t('admin.shop.products.shelfLife')" name="shelf"><UInputNumber v-model="form.shop.shelf_life_days" :min="1" /></UFormField>
            <fieldset><legend class="mb-2 text-small font-medium">{{ t('shop.product.tabs.allergens') }}</legend>
              <UCheckboxGroup v-model="form.shop.allergens" :items="ALLERGENS.map(a => ({ value: a, label: t(`shop.product.allergenNames.${a}`) }))" orientation="horizontal" class="flex-wrap" />
            </fieldset>
            <UFormField :label="t('admin.shop.products.nutrition')" :help="t('admin.shop.products.nutritionHint')" name="nutrition"><UTextarea v-model="nutritionText" :rows="4" class="w-full font-mono" /></UFormField>
            <MzGenerateButton :generating="foodGen.generating.value" :error="foodGen.error.value" :disabled="!FOOD_FIELDS.some(f => form.shop.translations.fr[f]?.trim())" @click="generateFood" />
            <div class="grid gap-6 lg:grid-cols-3">
              <div v-for="l in LOCALES" :key="l" class="flex flex-col gap-2" :dir="l === 'ar' ? 'rtl' : 'ltr'">
                <p class="font-medium uppercase">{{ l }}</p>
                <UTextarea v-for="f in FOOD_FIELDS" :key="f" v-model="form.shop.translations[l][f]" :rows="2" :placeholder="t(`admin.shop.products.food.${f}`)" :aria-label="`${t(`admin.shop.products.food.${f}`)} (${l})`" />
              </div>
            </div>
          </div>
        </template>
        <template #seo>
          <div class="pt-4">
            <MzGenerateButton :generating="seoGen.generating.value" :error="seoGen.error.value" :disabled="!form.translations.fr.seo_title?.trim() && !form.translations.fr.seo_description?.trim()" @click="generateSeo" />
          </div>
          <div class="grid gap-6 pt-4 lg:grid-cols-3">
            <div v-for="l in LOCALES" :key="l" class="flex flex-col gap-2" :dir="l === 'ar' ? 'rtl' : 'ltr'">
              <p class="font-medium uppercase">{{ l }}</p>
              <UInput v-model="form.translations[l].seo_title" :placeholder="t('admin.shop.products.seoTitle')" :aria-label="`${t('admin.shop.products.seoTitle')} (${l})`" />
              <UTextarea v-model="form.translations[l].seo_description" :rows="3" :placeholder="t('admin.shop.products.seoDescription')" :aria-label="`${t('admin.shop.products.seoDescription')} (${l})`" />
            </div>
          </div>
        </template>
        <template #related>
          <div class="max-w-3xl pt-4">
            <USelectMenu v-model="form.related_ids" multiple value-key="value" :items="(allProducts?.data ?? []).filter(p => p.id !== id).map(p => ({ value: p.id, label: p.name }))" class="w-full" :aria-label="t('admin.shop.products.tabs.related')" />
          </div>
        </template>
      </UTabs>
    </fieldset>
  </div>
</template>
