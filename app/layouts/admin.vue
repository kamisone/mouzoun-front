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
  { label: t('admin.bookings.title'), icon: 'i-lucide-calendar-check', to: '/admin/bookings' },
  { label: t('admin.goLive.title'), icon: 'i-lucide-rocket', to: '/admin/go-live' },
  ...(user.value?.permissions.includes('products.read')
    ? [{
        label: t('admin.catalog.title'),
        icon: 'i-lucide-tent',
        to: '/admin/catalog/stays',
        defaultOpen: route.path.startsWith('/admin/catalog') && !route.path.startsWith('/admin/catalog/pricing'),
        children: [
          { label: t('admin.catalog.nav.stays'), to: '/admin/catalog/stays' },
          { label: t('admin.catalog.nav.activities'), to: '/admin/catalog/activities' },
          { label: t('admin.catalog.nav.packages'), to: '/admin/catalog/packages' },
          { label: t('admin.catalog.nav.extras'), to: '/admin/catalog/extras' },
          ...(user.value?.permissions.includes('inventory.read') ? [{ label: t('admin.catalog.nav.resources'), to: '/admin/catalog/resources' }] : []),
        ],
      } as NavigationMenuItem]
    : []),
  ...(user.value?.permissions.includes('pricing.read')
    ? [{
        label: t('admin.catalog.pricingTitle'),
        icon: 'i-lucide-badge-euro',
        to: '/admin/catalog/pricing/seasons',
        defaultOpen: route.path.startsWith('/admin/catalog/pricing'),
        children: [
          { label: t('admin.catalog.nav.seasons'), to: '/admin/catalog/pricing/seasons' },
          { label: t('admin.catalog.nav.ratePlans'), to: '/admin/catalog/pricing/rate-plans' },
          { label: t('admin.catalog.nav.guestCategories'), to: '/admin/catalog/pricing/guest-categories' },
          { label: t('admin.catalog.nav.policies'), to: '/admin/catalog/pricing/cancellation-policies' },
        ],
      } as NavigationMenuItem]
    : []),
  ...(user.value?.permissions.includes('shop.read')
    ? [{
        label: t('admin.shop.title'),
        icon: 'i-lucide-shopping-basket',
        to: '/admin/shop',
        defaultOpen: route.path.startsWith('/admin/shop'),
        children: [
          { label: t('admin.shop.nav.dashboard'), to: '/admin/shop', exact: true },
          { label: t('admin.shop.nav.orders'), to: '/admin/shop/orders' },
          { label: t('admin.shop.nav.products'), to: '/admin/shop/products' },
          { label: t('admin.shop.nav.categories'), to: '/admin/shop/categories' },
          { label: t('admin.shop.nav.variations'), to: '/admin/shop/variations' },
          { label: t('admin.shop.nav.inventory'), to: '/admin/shop/inventory' },
          { label: t('admin.shop.nav.returns'), to: '/admin/shop/returns' },
          { label: t('admin.shop.nav.promotions'), to: '/admin/shop/promotions' },
          { label: t('admin.shop.nav.shipping'), to: '/admin/shop/shipping' },
          { label: t('admin.shop.nav.reports'), to: '/admin/shop/reports' },
          { label: t('admin.shop.nav.settings'), to: '/admin/shop/settings' },
          { label: t('admin.shop.nav.france'), to: '/admin/shop/france' },
        ],
      } as NavigationMenuItem]
    : []),
  { label: t('admin.customers'), icon: 'i-lucide-users', to: '/admin/customers' },
  { label: t('admin.scan.title'), icon: 'i-lucide-scan-qr-code', to: '/admin/scan' },
  { label: t('admin.content'), icon: 'i-lucide-file-text', to: '/admin/pages' },
  ...(user.value?.permissions.some(p => p === 'seo.manage' || p === 'content.read')
    ? [{ label: t('admin.seo.title'), icon: 'i-lucide-search-check', to: '/admin/seo' }]
    : []),
  { label: t('admin.media'), icon: 'i-lucide-images', disabled: true, badge: t('admin.upcoming') },
  ...(user.value?.permissions.includes('settings.write')
    ? [{
        label: t('admin.settings'),
        icon: 'i-lucide-settings',
        to: '/admin/settings',
        defaultOpen: route.path.startsWith('/admin/settings'),
        children: [
          { label: t('admin.settingsAccount'), to: '/admin/settings', exact: true },
          { label: t('admin.legalEntity.nav'), to: '/admin/settings/legal-entity' },
        ],
      } as NavigationMenuItem]
    : [{ label: t('admin.settings'), icon: 'i-lucide-settings', to: '/admin/settings' }]),
])
const footerNavigation = computed<NavigationMenuItem[]>(() => [
  { label: t('admin.styleguide'), icon: 'i-lucide-palette', to: '/_styleguide' },
])

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [
    { label: t('admin.account.menu'), icon: 'i-lucide-shield-check', to: '/admin/settings' },
    { label: t('auth.backToSite'), icon: 'i-lucide-globe', to: '/' },
  ],
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
        <UNavigationMenu :items="navigation" orientation="vertical" :collapsed="collapsed" color="neutral" tooltip />
      </template>
      <template #footer="{ collapsed }">
        <UNavigationMenu :items="footerNavigation" orientation="vertical" :collapsed="collapsed" color="neutral" tooltip class="w-full" />
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
              <UButton color="neutral" variant="ghost" size="sm" :aria-label="user?.full_name ? `${user.full_name}, ${t('admin.userMenu')}` : t('admin.userMenu')">
                <UAvatar icon="i-lucide-user-round" size="xs" aria-hidden="true" />
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
