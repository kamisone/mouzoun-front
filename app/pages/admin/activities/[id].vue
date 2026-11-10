<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false })
const route = useRoute()
</script>

<template>
  <AdminActivityForm :id="String(route.params.id)" />
</template>
