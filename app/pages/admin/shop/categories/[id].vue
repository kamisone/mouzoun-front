<script setup lang="ts">
/** Admin › Boutique › Catégories › one shop category (`MzCategoryForm`); `new` creates one. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.categories' })
</script>

<template>
  <MzCategoryForm scope="shop" />
</template>
