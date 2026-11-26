<script setup lang="ts">
import type { CatalogLocale, CatalogTranslation } from '~/utils/catalog-admin-api'
import { clip } from '~/utils/catalog'
import { slugify } from '~/utils/slug'

/**
 * SEO of one language: slug (made from the name until typed, the API's rule), title and
 * description with counters (60 / 155), the Google preview and the share image. A slug change
 * on a page already online gets a 301 from the old address (route registry).
 */
const props = defineProps<{
  locale: CatalogLocale
  /** Public path of the saved version (`/stays/khaima`), `undefined` before the first save. */
  savedPath?: string
  savedSlug?: string
  /** `/stays`, `/en/stays`... */
  pathPrefix: string
  errors?: Record<string, string>
}>()
const model = defineModel<Partial<CatalogTranslation>>({ required: true })
const { t } = useI18n()
const base = (useRuntimeConfig().public.i18n as { baseUrl?: string } | undefined)?.baseUrl ?? ''
const host = computed(() => base.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'mouzoun.com')
const effectiveSlug = computed(() => model.value.slug?.trim() ? slugify(model.value.slug) : slugify(model.value.name ?? ''))
const changed = computed(() => !!props.savedSlug && effectiveSlug.value !== props.savedSlug)
const title = computed(() => model.value.seo_title?.trim() || model.value.name || '')
const description = computed(() => model.value.seo_description?.trim() || model.value.short_description || '')
const err = (field: string) => props.errors?.[`translations.${props.locale}.${field}`]
function set<K extends keyof CatalogTranslation>(key: K, value: CatalogTranslation[K]) {
  model.value = { ...model.value, [key]: value }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <UFormField
      :label="t('admin.catalog.fields.slug')"
      :name="`slug-${props.locale}`"
      :hint="model.slug ? undefined : t('admin.catalog.slugFromName')"
      :help="changed && props.savedPath ? t('admin.catalog.slugRedirect') : undefined"
      :error="err('slug') ? t(`admin.catalog.errors.${err('slug')}`) : undefined"
    >
      <UInput
        :model-value="model.slug ?? ''"
        :placeholder="effectiveSlug"
        :data-testid="`slug-${props.locale}`"
        dir="ltr"
        class="w-full"
        @update:model-value="v => set('slug', String(v))"
        @blur="model.slug && set('slug', slugify(model.slug))"
      />
    </UFormField>
    <UFormField :label="t('admin.catalog.fields.seoTitle')" :name="`seo-title-${props.locale}`" :hint="`${(model.seo_title ?? '').length} / 60`">
      <UInput :model-value="model.seo_title ?? ''" class="w-full" :color="(model.seo_title ?? '').length > 60 ? 'warning' : undefined" @update:model-value="v => set('seo_title', String(v))" />
    </UFormField>
    <UFormField :label="t('admin.catalog.fields.seoDescription')" :name="`seo-desc-${props.locale}`" :hint="`${(model.seo_description ?? '').length} / 155`">
      <UTextarea :model-value="model.seo_description ?? ''" :rows="3" class="w-full" :color="(model.seo_description ?? '').length > 155 ? 'warning' : undefined" @update:model-value="v => set('seo_description', String(v))" />
    </UFormField>
    <section class="rounded-md border border-default bg-default p-4" :aria-label="t('admin.catalog.googlePreview')" data-testid="google-preview">
      <p class="mb-2 text-caption text-muted">{{ t('admin.catalog.googlePreview') }}</p>
      <p class="truncate text-small text-muted" dir="ltr">{{ host }}{{ props.pathPrefix }}/{{ effectiveSlug }}</p>
      <p class="text-body-lg text-primary">{{ clip(title, 60) }}</p>
      <p class="text-small text-muted">{{ clip(description, 155) }}</p>
    </section>
    <MzMediaField :model-value="model.og_media_id ?? undefined" purpose="ogImage" @update:model-value="v => set('og_media_id', (v as string | undefined) ?? null)" />
  </div>
</template>
