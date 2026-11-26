<script setup lang="ts">
/** Admin › Catalogue › Catégories › one stay/activity category (`MzCategoryForm`); `new` creates one. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.catalog.nav.categories' })
</script>

<template>
  <MzCategoryForm scope="product" />
</template>
