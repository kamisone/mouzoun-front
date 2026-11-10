<script setup lang="ts">
const { user, logout } = useAuth()
const route = useRoute()

const nav = [
  { to: '/admin', label: 'Tableau de bord' },
  { to: '/admin/activities', label: 'Activités' },
  // Upcoming: camps, bookings, products, customers, settings
]

function isActive(to: string) {
  return to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)
}

async function onLogout() {
  logout()
  await navigateTo('/admin/login')
}

useHead({ title: 'Mouzoun Admin', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <aside class="w-60 shrink-0 bg-night-900 p-4 text-sand-100">
      <div class="mb-8 text-xl font-bold text-terracotta-500">Mouzoun</div>
      <nav class="flex flex-col gap-1">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="rounded-lg px-3 py-2 text-sm hover:bg-white/10"
          :class="{ 'bg-white/10': isActive(item.to) }"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </aside>
    <div class="flex flex-1 flex-col">
      <header class="flex items-center justify-end gap-4 border-b bg-white px-6 py-3 text-sm">
        <span>{{ user?.full_name }} · {{ user?.role }}</span>
        <button class="btn-ghost" @click="onLogout">Déconnexion</button>
      </header>
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
