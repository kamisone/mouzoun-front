<script setup lang="ts">
import { CATALOG_LOCALES, type CatalogLocale } from '~/utils/catalog-admin-api'

/**
 * One tab per language with a "manquant" marker on the languages without a name, and an error
 * marker on those whose fields the API refused. `fr` is required. The slot renders one locale.
 */
const props = withDefaults(defineProps<{ missing?: CatalogLocale[], errors?: CatalogLocale[] }>(), { missing: () => [], errors: () => [] })
const active = defineModel<CatalogLocale>({ default: 'fr' })
const { t } = useI18n()
const items = computed(() => CATALOG_LOCALES.map(l => ({
  value: l,
  label: `${l.toUpperCase()}${l === 'fr' ? ' *' : ''}`,
  badge: props.errors.includes(l)
    ? { label: t('admin.catalog.error'), color: 'error' as const, variant: 'soft' as const }
    : props.missing.includes(l) ? { label: t('admin.catalog.missing'), color: 'warning' as const, variant: 'soft' as const } : undefined,
  slot: 'locale' as const,
})))
</script>

<template>
  <UTabs v-model="active" :items="items" variant="link" :content="false" class="w-full" data-testid="locale-tabs" />
  <div :dir="active === 'ar' ? 'rtl' : 'ltr'" :lang="active" class="pt-4">
    <slot :locale="active" />
  </div>
</template>
