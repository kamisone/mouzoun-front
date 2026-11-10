<script setup lang="ts">
import type { Activity, Paginated } from '~/utils/types'

definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false })

const api = useAdminApi()
const items = ref<Activity[]>([])
const page = ref(1)
const total = ref(0)
const perPage = 20
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await api<Paginated<Activity>>('/v1/activities/admin', {
      query: { page: page.value, per_page: perPage },
    })
    items.value = res.data
    total.value = res.total
  } finally {
    loading.value = false
  }
}

async function remove(a: Activity) {
  if (!confirm(`Supprimer « ${a.title_fr} » ?`)) return
  await api(`/v1/activities/id/${a.id}`, { method: 'DELETE' })
  await load()
}

function go(delta: number) {
  page.value += delta
  load()
}

onMounted(load)
</script>

<template>
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Activités</h1>
    <NuxtLink to="/admin/activities/new" class="btn">+ Nouvelle activité</NuxtLink>
  </div>

  <div class="overflow-hidden rounded-xl bg-white shadow-sm">
    <table class="w-full text-left text-sm">
      <thead class="bg-gray-50 text-gray-500">
        <tr>
          <th class="px-4 py-3">Titre</th>
          <th class="px-4 py-3">Prix (MAD)</th>
          <th class="px-4 py-3">Durée</th>
          <th class="px-4 py-3">Statut</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in items" :key="a.id" class="border-t">
          <td class="px-4 py-3 font-medium">{{ a.title_fr }}</td>
          <td class="px-4 py-3">{{ a.price_mad }}</td>
          <td class="px-4 py-3">{{ Math.round(a.duration_minutes / 60) }} h</td>
          <td class="px-4 py-3">
            <span
              class="rounded-full px-2 py-0.5 text-xs"
              :class="a.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
            >
              {{ a.is_published ? 'Publié' : 'Brouillon' }}
            </span>
          </td>
          <td class="space-x-2 px-4 py-3 text-right">
            <NuxtLink :to="`/admin/activities/${a.id}`" class="text-terracotta-600 hover:underline">Modifier</NuxtLink>
            <button class="text-red-600 hover:underline" @click="remove(a)">Supprimer</button>
          </td>
        </tr>
        <tr v-if="!loading && !items.length">
          <td colspan="5" class="px-4 py-8 text-center text-gray-400">Aucune activité</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="total > perPage" class="mt-4 flex gap-2">
    <button class="btn-ghost" :disabled="page === 1" @click="go(-1)">Précédent</button>
    <button class="btn-ghost" :disabled="page * perPage >= total" @click="go(1)">Suivant</button>
  </div>
</template>
