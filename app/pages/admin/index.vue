<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false })

const { activities } = useAdminApi()
const activitiesTotal = ref<number | null>(null)

onMounted(async () => {
  const res = await activities.list({ per_page: 1 })
  activitiesTotal.value = res.total
})
</script>

<template>
  <h1 class="mb-6 text-2xl font-bold">Tableau de bord</h1>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-xl bg-white p-5 shadow-sm">
      <div class="text-sm text-gray-500">Activités</div>
      <div class="mt-1 text-3xl font-bold">{{ activitiesTotal ?? '—' }}</div>
    </div>
    <div class="rounded-xl bg-white p-5 shadow-sm">
      <div class="text-sm text-gray-500">Réservations</div>
      <div class="mt-1 text-3xl font-bold text-gray-300">bientôt</div>
    </div>
  </div>
</template>
