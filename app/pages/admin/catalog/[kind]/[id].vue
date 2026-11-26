<script setup lang="ts">
import { CATALOG_KINDS, type CatalogKind } from '~/utils/catalog-admin-api'

/** The editor of one stay, activity, package or extra (`new` creates one). */
definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
  i18n: false,
  title: 'admin.catalog.title',
  validate: route => CATALOG_KINDS.includes(route.params.kind as CatalogKind),
})
const route = useRoute()
const kind = computed(() => route.params.kind as CatalogKind)
const id = computed(() => String(route.params.id))
</script>

<template>
  <MzCatalogEditor :id="id" :key="`${kind}-${id}`" :kind="kind" />
</template>
