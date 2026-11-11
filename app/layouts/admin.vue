<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

/**
 * Back office: collapsible sidebar (Nuxt UI dashboard), top bar with the page title and the
 * user menu, compact density, follows the system theme unless the user chose one.
 */
provideDensity('compact')
const { t } = useI18n()
const route = useRoute()
const { user, logout } = useAuth()
const { applyDefault } = useThemePreference()
onMounted(() => applyDefault('system'))

const navigation = computed<NavigationMenuItem[]>(() => [
  { label: t('admin.dashboard'), icon: 'i-lucide-layout-dashboard', to: '/admin', exact: true },
  { label: t('admin.bookings'), icon: 'i-lucide-calendar-check', disabled: true, badge: t('admin.upcoming') },
  { label: t('admin.products'), icon: 'i-lucide-tent', disabled: true, badge: t('admin.upcoming') },
  { label: t('admin.customers'), icon: 'i-lucide-users', disabled: true, badge: t('admin.upcoming') },
  { label: t('admin.content'), icon: 'i-lucide-file-text', disabled: true, badge: t('admin.upcoming') },
  { label: t('admin.media'), icon: 'i-lucide-images', disabled: true, badge: t('admin.upcoming') },
  { label: t('admin.settings'), icon: 'i-lucide-settings', disabled: true, badge: t('admin.upcoming') },
])
const footerNavigation = computed<NavigationMenuItem[]>(() => [
  { label: t('admin.styleguide'), icon: 'i-lucide-palette', to: '/_styleguide' },
])

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [{ label: t('auth.backToSite'), icon: 'i-lucide-globe', to: '/' }],
  [{ label: t('auth.logout'), icon: 'i-lucide-log-out', color: 'error', onSelect: onLogout }],
])

async function onLogout() {
  await logout()
  await navigateTo('/admin/login')
}

const title = computed(() => (typeof route.meta.title === 'string' ? t(route.meta.title) : t('admin.title')))
useHead({ title, meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <UDashboardGroup unit="rem" storage="local" storage-key="mz-admin">
    <UDashboardSidebar collapsible resizable :default-size="16" :ui="{ footer: 'border-t border-default' }">
      <template #header="{ collapsed }">
        <MzLogo size="sm" to="/admin" :icon-only="collapsed" />
      </template>
      <template #default="{ collapsed }">
        <UNavigationMenu :items="navigation" orientation="vertical" :collapsed="collapsed" tooltip />
      </template>
      <template #footer="{ collapsed }">
        <UNavigationMenu :items="footerNavigation" orientation="vertical" :collapsed="collapsed" tooltip class="w-full" />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <!-- The page itself owns the single <h1> (MzPageHeader): the bar title is a paragraph. -->
        <UDashboardNavbar :title="title" :as="{ title: 'p' }">
          <template #leading>
            <UDashboardSidebarCollapse :aria-label="t('admin.collapse')" />
          </template>
          <template #right>
            <MzLocaleSwitcher mode="state" size="sm" />
            <MzThemeToggle size="sm" />
            <UDropdownMenu :items="userMenu" :content="{ align: 'end' }">
              <UButton color="neutral" variant="ghost" size="sm" :aria-label="t('admin.userMenu')">
                <UAvatar :alt="user?.full_name" size="xs" />
                <span class="hidden sm:inline">{{ user?.full_name }}</span>
              </UButton>
            </UDropdownMenu>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
