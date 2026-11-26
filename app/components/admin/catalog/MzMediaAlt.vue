<script setup lang="ts">
import { CATALOG_LOCALES, type CatalogLocale } from '~/utils/catalog-admin-api'

/**
 * Alt text of the chosen images, per language, saved on the media asset itself (the media
 * library's texts endpoint). French is required on the cover and gallery images.
 */
const props = defineProps<{
  ids: string[]
  known: Record<string, { url: string | null, alt: Partial<Record<CatalogLocale, string>> }>
}>()
const emit = defineEmits<{ saved: [id: string, alt: Partial<Record<CatalogLocale, string>>] }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const drafts = ref<Record<string, Record<CatalogLocale, string>>>({})
watch(() => [props.ids, props.known] as const, () => {
  for (const id of props.ids) {
    if (!drafts.value[id]) drafts.value[id] = { fr: '', en: '', ar: '', ...(props.known[id]?.alt ?? {}) } as Record<CatalogLocale, string>
  }
}, { immediate: true, deep: true })
const saving = ref<string | null>(null)
async function save(id: string) {
  saving.value = id
  try {
    const d = drafts.value[id]!
    await api.media.texts(id, Object.fromEntries(CATALOG_LOCALES.map(l => [l, { alt_text: d[l] ?? '' }])))
    emit('saved', id, { ...d })
    toast.add({ title: t('admin.catalog.altSaved'), color: 'success' })
  }
  catch {
    toast.add({ title: t('shop.errors.generic'), color: 'error' })
  }
  finally {
    saving.value = null
  }
}
</script>

<template>
  <div v-if="props.ids.length" class="flex flex-col gap-3">
    <p class="text-small font-medium">{{ t('admin.catalog.altTitle') }}</p>
    <div v-for="id in props.ids" :key="id" class="flex flex-wrap items-start gap-3 rounded-md border border-default p-3" :data-testid="`alt-${id}`">
      <img v-if="props.known[id]?.url" :src="props.known[id]!.url!" alt="" class="size-16 rounded-xs object-cover">
      <div class="grid flex-1 gap-2 sm:grid-cols-3">
        <UFormField v-for="l in CATALOG_LOCALES" :key="l" :label="`${t('admin.catalog.alt')} (${l})${l === 'fr' ? ' *' : ''}`" :name="`alt-${id}-${l}`" :error="l === 'fr' && !drafts[id]?.fr?.trim() ? t('admin.catalog.altRequired') : undefined">
          <UInput v-model="drafts[id]![l]" size="sm" class="w-full" :dir="l === 'ar' ? 'rtl' : 'ltr'" />
        </UFormField>
      </div>
      <UButton :label="t('admin.catalog.saveAlt')" size="sm" color="neutral" variant="outline" :loading="saving === id" @click="save(id)" />
    </div>
  </div>
</template>
