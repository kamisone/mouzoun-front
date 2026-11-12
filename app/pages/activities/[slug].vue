<script setup lang="ts">
/** Product page: everything to decide, and the booking box beside it. */
const route = useRoute()
const product = await useProductPage(() => String(route.params.slug))
</script>

<template>
  <MzProductView v-if="product" :product="product" />
</template>
