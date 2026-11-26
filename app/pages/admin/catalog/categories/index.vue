<script setup lang="ts">
/** Admin › Catalogue › Catégories: stay and activity categories, one ordered list (`MzCategoriesScreen`). */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.catalog.nav.categories' })
</script>

<template>
  <MzCategoriesScreen scope="product" />
</template>
