<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false })

const { user } = useAuth()
</script>

<template>
  <h1 class="mb-6 text-2xl font-bold">Tableau de bord</h1>
  <p class="text-gray-600">Bienvenue{{ user ? `, ${user.full_name}` : '' }}.</p>
</template>
