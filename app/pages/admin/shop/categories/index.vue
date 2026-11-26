<script setup lang="ts">
/** Admin › Boutique › Catégories: the shop categories tree (`MzCategoriesScreen`). */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.categories' })
</script>

<template>
  <MzCategoriesScreen scope="shop" />
</template>
