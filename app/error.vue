<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-sand-50 p-8 text-center">
    <h1 class="text-6xl font-bold text-terracotta-500">{{ error.statusCode }}</h1>
    <p>{{ error.statusMessage || error.message }}</p>
    <button class="rounded-full bg-night-900 px-6 py-2 text-white" @click="clearError({ redirect: '/' })">Mouzoun</button>
  </div>
</template>
