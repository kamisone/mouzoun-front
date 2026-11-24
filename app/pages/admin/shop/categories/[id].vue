<script setup lang="ts">
import type { AdminCategoryRow, Json } from '~/utils/shop-admin-api'
import { slugify, uniqueSlug } from '~/utils/slug'

/**
 * A shop category: content on the left (names and descriptions per language, cover with alt
 * text, icon, SEO with slug, title, meta description and a search result preview, products in
 * manual order), status and organisation on the right (active, in menus, parent, default sort).
 * Sticky save bar; leaving with unsaved changes asks first. `new` creates one (`?parent=`).
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.categories' })

const LOCALES = ['fr', 'en', 'ar'] as const
type Locale = typeof LOCALES[number]
const ICONS = ['i-lucide-folder', 'i-lucide-palmtree', 'i-lucide-droplet', 'i-lucide-leaf', 'i-lucide-flame', 'i-lucide-wheat', 'i-lucide-coffee', 'i-lucide-cookie',
  'i-lucide-apple', 'i-lucide-flower', 'i-lucide-gift', 'i-lucide-package', 'i-lucide-shopping-basket', 'i-lucide-hand-heart', 'i-lucide-sparkles', 'i-lucide-sun',
  'i-lucide-moon', 'i-lucide-star', 'i-lucide-tent', 'i-lucide-mountain']
const SORTS = ['manual', 'best_selling', 'newest', 'price_asc', 'price_desc', 'name']
const SEO_TITLE_MAX = 60
const SEO_DESCRIPTION_MAX = 155

const { t } = useI18n()
const route = useRoute()
const admin = useAdminApi()
const toast = useToast()
const { can } = useShopAdmin()
const config = useRuntimeConfig()
const readOnly = computed(() => !can('shop.catalog'))
const isNew = route.params.id === 'new'
const id = String(route.params.id)

const { data: list } = await useAsyncData('admin-shop-categories', () => admin.shop.categories.list())
const { data: detail, refresh } = await useAsyncData(`admin-category-${id}`, () => (isNew ? Promise.resolve(null) : admin.shop.categories.get(id)))
if (!isNew && !detail.value) throw createError({ statusCode: 404, statusMessage: 'Not found' })

interface Tr { name: string, slug: string, description: string | undefined, seo_title: string, seo_description: string }
const blank = (): Tr => ({ name: '', slug: '', description: undefined, seo_title: '', seo_description: '' })
function fromDetail(d: Json | null | undefined) {
  return {
    is_active: d?.is_active ?? false,
    show_in_menu: d?.show_in_menu ?? true,
    parent_id: (d ? d.parent_id : (route.query.parent as string | undefined)) ?? null,
    default_sort: d?.default_sort ?? 'manual',
    icon: d?.icon ?? null,
    cover_media_id: d?.cover_media_id ?? undefined,
    alt: Object.fromEntries(LOCALES.map(l => [l, d?.cover?.alt?.[l] ?? ''])) as Record<Locale, string>,
    translations: Object.fromEntries(LOCALES.map((l) => {
      const tr = d?.translations?.[l]
      return [l, tr ? { name: tr.name ?? '', slug: tr.slug ?? '', description: tr.description ?? undefined, seo_title: tr.seo_title ?? '', seo_description: tr.seo_description ?? '' } : blank()]
    })) as Record<Locale, Tr>,
  }
}
const form = ref(fromDetail(detail.value))
const snapshot = ref(JSON.stringify(form.value))
const dirty = computed(() => JSON.stringify(form.value) !== snapshot.value)
const locale = ref<Locale>('fr')
const errors = ref<Record<string, string>>({})
const err = (field: string) => (errors.value[field] ? t(`admin.shop.categories.errors.${errors.value[field]}`) : undefined)

// ---- Slugs: from the name until edited by hand, locked once the category went live ------------
const published = computed(() => !!detail.value?.first_activated_at)
const touched = reactive<Record<Locale, boolean>>({ fr: !isNew, en: !isNew, ar: !isNew })
for (const l of LOCALES) if (!form.value.translations[l].slug) touched[l] = false
const unlocked = reactive<Record<Locale, boolean>>({ fr: false, en: false, ar: false })
const slugLocked = (l: Locale) => published.value && !!detail.value?.translations?.[l]?.slug && !unlocked[l]
const takenSlugs = (l: Locale) => ((list.value?.data ?? []) as AdminCategoryRow[]).filter(c => c.id !== id).map(c => c.translations[l]?.slug).filter(Boolean) as string[]
for (const l of LOCALES) {
  watch(() => form.value.translations[l].name, (name) => {
    if (touched[l] || slugLocked(l)) return
    form.value.translations[l].slug = uniqueSlug(slugify(name), takenSlugs(l))
  })
}
const slugChanged = (l: Locale) => !!detail.value?.translations?.[l]?.slug && form.value.translations[l].slug !== detail.value.translations[l].slug

// ---- Warnings and helpers -------------------------------------------------------------------------
const missing = (l: Locale) => !form.value.translations[l].name.trim()
const siblingClash = computed(() => {
  const name = form.value.translations.fr.name.trim().toLowerCase()
  if (!name) return false
  return ((list.value?.data ?? []) as AdminCategoryRow[]).some(c => c.id !== id && c.parent_id === form.value.parent_id && c.translations.fr?.name.trim().toLowerCase() === name)
})
const plain = (html: string | undefined) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const seoTitle = (l: Locale) => form.value.translations[l].seo_title || form.value.translations[l].name
const seoDescription = (l: Locale) => form.value.translations[l].seo_description || plain(form.value.translations[l].description).slice(0, SEO_DESCRIPTION_MAX)
const siteBase = computed(() => String((config.public.i18n as { baseUrl?: string })?.baseUrl || 'https://mouzoun.com').replace(/\/$/, ''))
const pathOf = (l: Locale) => `${l === 'fr' ? '' : `/${l}`}/${l === 'en' ? 'shop' : 'boutique'}/${form.value.translations[l].slug}`

// ---- Save -----------------------------------------------------------------------------------------
const saving = ref(false)
async function save() {
  if (readOnly.value) return
  errors.value = {}
  saving.value = true
  try {
    const f = form.value
    // Cover alt text lives on the media (media library texts).
    if (f.cover_media_id && LOCALES.some(l => f.alt[l] !== (detail.value?.cover?.alt?.[l] ?? '') || f.cover_media_id !== detail.value?.cover_media_id)) {
      if (!f.alt.fr.trim()) {
        errors.value = { 'cover.alt': 'required' }
        return
      }
      await admin.media.texts(f.cover_media_id, Object.fromEntries(LOCALES.map(l => [l, { alt_text: f.alt[l].trim() }])))
    }
    const translations: Json = {}
    for (const l of LOCALES) {
      const tr = f.translations[l]
      // Languages never filled stay absent; a language emptied is removed (except French).
      if (!tr.name.trim() && !detail.value?.translations?.[l]) continue
      translations[l] = { name: tr.name, slug: tr.slug || undefined, description: tr.description ?? null, seo_title: tr.seo_title || null, seo_description: tr.seo_description || null }
    }
    const body = { is_active: f.is_active, show_in_menu: f.show_in_menu, parent_id: f.parent_id, default_sort: f.default_sort, icon: f.icon, cover_media_id: f.cover_media_id ?? null, translations }
    const out = await admin.shop.categories.save(body, isNew ? undefined : id)
    toast.add({ title: t('admin.shop.categories.saved'), color: 'success' })
    snapshot.value = JSON.stringify(form.value)
    await refreshNuxtData('admin-shop-categories')
    if (isNew) await navigateTo(`/admin/shop/categories/${out.id}`, { replace: true })
    else {
      await refresh()
      form.value = fromDetail(detail.value)
      snapshot.value = JSON.stringify(form.value)
    }
  }
  catch (e) {
    const error = (e as { data?: { error?: { code?: string, details?: { fields?: Record<string, string> } } } }).data?.error
    if (error?.details?.fields) {
      errors.value = error.details.fields
      const first = Object.keys(error.details.fields).find(k => k.startsWith('translations.'))
      if (first) locale.value = first.split('.')[1] as Locale
      toast.add({ title: t('admin.shop.categories.fixErrors'), color: 'error' })
    }
    else {
      const key = error?.code ? `admin.shop.errors.${error.code}` : 'shop.errors.generic'
      toast.add({ title: t(key) !== key ? t(key) : t('shop.errors.generic'), color: 'error' })
    }
  }
  finally {
    saving.value = false
  }
}
function discard() {
  form.value = JSON.parse(snapshot.value)
  errors.value = {}
}

// ---- Leaving with unsaved changes -------------------------------------------------------------
onBeforeRouteLeave(() => {
  if (dirty.value && !saving.value && !window.confirm(t('admin.shop.categories.unsaved'))) return false
})
useEventListener(import.meta.client ? window : null, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
})

const deleteOpen = ref(false)
const { date } = useDate()
const title = computed(() => form.value.translations.fr.name || t('admin.shop.categories.new'))
</script>

<template>
  <div class="flex flex-col gap-6 pb-24">
    <MzPageHeader :title="title" :breadcrumbs="[{ label: t('admin.shop.nav.categories'), to: '/admin/shop/categories' }, { label: title }]">
      <template #actions>
        <UButton v-if="!isNew && detail?.is_active && detail?.paths?.fr" :label="t('admin.shop.categories.viewOnSite')" :to="detail.paths.fr" target="_blank" icon="i-lucide-external-link" color="neutral" variant="outline" />
        <UButton v-if="!isNew && !readOnly" :label="t('common.delete')" icon="i-lucide-trash-2" color="error" variant="ghost" @click="deleteOpen = true" />
      </template>
    </MzPageHeader>

    <fieldset :disabled="readOnly" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="flex min-w-0 flex-col gap-6">
        <!-- Général -->
        <section class="flex flex-col gap-4 rounded-md border border-default p-4" aria-labelledby="general">
          <h2 id="general" class="font-medium">{{ t('admin.shop.categories.general') }}</h2>
          <div class="flex flex-wrap gap-1" role="tablist" :aria-label="t('admin.shop.categories.languages')">
            <UButton
              v-for="l in LOCALES"
              :key="l"
              role="tab"
              :aria-selected="locale === l"
              :color="locale === l ? 'primary' : 'neutral'"
              :variant="locale === l ? 'soft' : 'ghost'"
              size="sm"
              :data-testid="`locale-tab-${l}`"
              @click="locale = l"
            >
              {{ l.toUpperCase() }}
              <UBadge v-if="missing(l)" color="warning" variant="soft" size="sm" :label="t('admin.shop.products.missing')" />
            </UButton>
          </div>
          <div v-for="l in LOCALES" v-show="locale === l" :key="l" class="flex flex-col gap-4" :dir="l === 'ar' ? 'rtl' : 'ltr'" :lang="l">
            <UFormField :label="t('admin.shop.categories.name')" :name="`name-${l}`" :required="l === 'fr'" :error="err(`translations.${l}.name`)">
              <UInput v-model="form.translations[l].name" class="w-full" :data-testid="`name-${l}`" />
            </UFormField>
            <p v-if="l === 'fr' && siblingClash" class="text-caption text-warning">{{ t('admin.shop.categories.siblingClash') }}</p>
            <MzRichTextField v-model="form.translations[l].description" :label="t('admin.shop.categories.description')" :dir="l === 'ar' ? 'rtl' : 'ltr'" :lang="l" />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-3">
              <MzMediaField v-model="form.cover_media_id" :label="t('admin.shop.categories.cover')" />
              <template v-if="form.cover_media_id">
                <UFormField v-for="l in LOCALES" :key="l" :label="`${t('admin.shop.categories.alt')} (${l.toUpperCase()})`" :name="`alt-${l}`" :required="l === 'fr'" :error="l === 'fr' ? err('cover.alt') : undefined">
                  <UInput v-model="form.alt[l]" class="w-full" :dir="l === 'ar' ? 'rtl' : 'ltr'" />
                </UFormField>
              </template>
            </div>
            <UFormField :label="t('admin.shop.categories.icon')" name="icon" :error="err('icon')">
              <USelectMenu
                v-model="form.icon"
                :items="[{ value: null, label: t('admin.shop.categories.noIcon'), icon: undefined }, ...ICONS.map(i => ({ value: i, label: i.replace('i-lucide-', ''), icon: i }))]"
                value-key="value"
                :icon="form.icon ?? undefined"
                class="w-full"
              />
            </UFormField>
          </div>
        </section>

        <!-- SEO -->
        <section class="flex flex-col gap-4 rounded-md border border-default p-4" aria-labelledby="seo">
          <h2 id="seo" class="font-medium">{{ t('admin.shop.categories.seo') }} · {{ locale.toUpperCase() }}</h2>
          <div v-for="l in LOCALES" v-show="locale === l" :key="l" class="flex flex-col gap-4">
            <UFormField :label="t('admin.shop.categories.slug')" :name="`slug-${l}`" :error="err(`translations.${l}.slug`)" :help="slugChanged(l) ? t('admin.shop.categories.slugRedirect') : undefined">
              <div class="flex gap-2">
                <UInput
                  v-model="form.translations[l].slug"
                  class="w-full"
                  dir="ltr"
                  :disabled="slugLocked(l)"
                  :data-testid="`slug-${l}`"
                  @update:model-value="touched[l] = true"
                />
                <UButton
                  v-if="slugLocked(l)"
                  icon="i-lucide-lock"
                  color="neutral"
                  variant="outline"
                  :label="t('common.edit')"
                  :aria-label="t('admin.shop.categories.unlockSlug')"
                  @click="unlocked[l] = true; touched[l] = true"
                />
              </div>
            </UFormField>
            <UFormField :label="t('admin.shop.categories.seoTitle')" :name="`seo-title-${l}`" :hint="`${form.translations[l].seo_title.length} / ${SEO_TITLE_MAX}`" :error="err(`translations.${l}.seo_title`)">
              <UInput v-model="form.translations[l].seo_title" class="w-full" :placeholder="form.translations[l].name" :dir="l === 'ar' ? 'rtl' : 'ltr'" :color="form.translations[l].seo_title.length > SEO_TITLE_MAX ? 'warning' : undefined" />
            </UFormField>
            <UFormField :label="t('admin.shop.categories.seoDescription')" :name="`seo-desc-${l}`" :hint="`${form.translations[l].seo_description.length} / ${SEO_DESCRIPTION_MAX}`" :error="err(`translations.${l}.seo_description`)">
              <UTextarea v-model="form.translations[l].seo_description" :rows="3" class="w-full" :dir="l === 'ar' ? 'rtl' : 'ltr'" :color="form.translations[l].seo_description.length > SEO_DESCRIPTION_MAX ? 'warning' : undefined" />
            </UFormField>
            <!-- Search result preview. -->
            <div class="flex flex-col gap-1 rounded-md bg-elevated p-3" :dir="l === 'ar' ? 'rtl' : 'ltr'" :aria-label="t('admin.shop.categories.preview')" role="group">
              <span class="truncate text-caption text-muted" dir="ltr">{{ siteBase }}{{ pathOf(l) }}</span>
              <span class="truncate text-body-lg text-info">{{ seoTitle(l) || '—' }} · Mouzoun</span>
              <span class="line-clamp-2 text-small text-muted">{{ seoDescription(l) || t('admin.shop.categories.previewEmpty') }}</span>
            </div>
          </div>
        </section>

        <!-- Produits -->
        <section class="flex flex-col gap-4 rounded-md border border-default p-4" aria-labelledby="products">
          <h2 id="products" class="font-medium">{{ t('admin.shop.nav.products') }}</h2>
          <p v-if="isNew" class="text-small text-muted">{{ t('admin.shop.categories.productsAfterCreate') }}</p>
          <MzCategoryProducts v-else :category-id="id" :default-sort="detail?.default_sort ?? 'manual'" :read-only="readOnly" />
        </section>
      </div>

      <!-- Organisation -->
      <aside class="flex flex-col gap-4">
        <section class="flex flex-col gap-4 rounded-md border border-default p-4" aria-labelledby="status">
          <h2 id="status" class="font-medium">{{ t('admin.shop.categories.statusTitle') }}</h2>
          <USwitch v-model="form.is_active" :label="t('admin.shop.categories.status.active')" :description="t('admin.shop.categories.activeHelp')" data-testid="is-active" />
          <USwitch v-model="form.show_in_menu" :label="t('admin.shop.categories.showInMenu')" :description="t('admin.shop.categories.showInMenuHelp')" />
          <p v-if="err('translations.fr.name') === t('admin.shop.categories.errors.required_to_activate')" class="text-caption text-error">{{ err('translations.fr.name') }}</p>
        </section>
        <section class="flex flex-col gap-4 rounded-md border border-default p-4" aria-labelledby="organisation">
          <h2 id="organisation" class="font-medium">{{ t('admin.shop.categories.organisation') }}</h2>
          <UFormField :label="t('admin.shop.categories.parent')" name="parent">
            <MzCategoryPicker v-model="form.parent_id" :parent-of="isNew ? '' : id" :none-label="t('admin.shop.categories.root')" :disabled="readOnly" />
          </UFormField>
          <UFormField :label="t('admin.shop.categories.defaultSort')" name="sort" :error="err('default_sort')">
            <USelect v-model="form.default_sort" :items="SORTS.map(s => ({ value: s, label: t(`admin.shop.categories.sorts.${s}`) }))" class="w-full" />
          </UFormField>
        </section>
        <section v-if="!isNew && detail" class="flex flex-col gap-1 rounded-md border border-default p-4 text-small text-muted">
          <p>{{ t('admin.shop.categories.created', { date: date(detail.created_at) }) }}</p>
          <p>{{ t('admin.shop.categories.updated', { date: date(detail.updated_at) }) }}<template v-if="detail.updated_by"> · {{ detail.updated_by }}</template></p>
        </section>
      </aside>
    </fieldset>

    <!-- Sticky save bar. -->
    <div v-if="!readOnly && (dirty || isNew)" class="sticky bottom-0 z-(--z-raised) -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-default bg-default/95 px-4 py-3 backdrop-blur" data-testid="save-bar">
      <p class="me-auto text-small text-muted" role="status">{{ dirty ? t('admin.shop.categories.unsavedShort') : '' }}</p>
      <UButton v-if="!isNew" :label="t('common.cancel')" color="neutral" variant="ghost" :disabled="saving" @click="discard" />
      <UButton :label="t('common.save')" icon="i-lucide-save" :loading="saving" data-testid="save-category" @click="save" />
    </div>

    <MzCategoryDeleteDialog
      v-if="!isNew"
      v-model:open="deleteOpen"
      :category-id="id"
      :category-name="detail?.translations?.fr?.name ?? ''"
      @deleted="snapshot = JSON.stringify(form); navigateTo('/admin/shop/categories')"
      @deactivate="form.is_active = false; save()"
    />
  </div>
</template>
