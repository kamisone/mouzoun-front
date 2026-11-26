<script setup lang="ts">
import { CATALOG_KINDS, type CatalogKind } from '~/utils/catalog-admin-api'

/** Catalogue › Hébergements / Activités / Formules / Extras: the list of one kind. */
definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
  i18n: false,
  title: 'admin.catalog.title',
  validate: route => CATALOG_KINDS.includes(route.params.kind as CatalogKind),
})
const route = useRoute()
const kind = computed(() => route.params.kind as CatalogKind)
</script>

<template>
  <MzCatalogList :key="kind" :kind="kind" />
</template>
