<script setup lang="ts">
/** Shop dashboard: what needs doing today (to confirm, to fulfil, pickups, stock, lots) and sales. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.title' })

const { t } = useI18n()
const admin = useAdminApi()
const { money } = useMoney()
const { data, refresh, pending } = await useAsyncData('admin-shop-dashboard', () => admin.shop.dashboard().catch(() => null))
useIntervalFn(() => refresh(), 60_000)

const tiles = computed(() => data.value
  ? [
      { label: t('admin.shop.dash.toConfirm'), value: data.value.to_confirm, icon: 'i-lucide-phone', to: '/admin/shop/orders?view=to_confirm' },
      { label: t('admin.shop.dash.toFulfil'), value: data.value.to_fulfil, icon: 'i-lucide-package', to: '/admin/shop/orders?view=to_fulfil' },
      { label: t('admin.shop.dash.readyForPickup'), value: data.value.ready_for_pickup, icon: 'i-lucide-store', to: '/admin/shop/orders?view=ready_for_pickup' },
      { label: t('admin.shop.dash.atRisk'), value: data.value.at_risk, icon: 'i-lucide-shield-alert', to: '/admin/shop/orders?risk_level=review' },
      { label: t('admin.shop.dash.returns'), value: data.value.returns_open, icon: 'i-lucide-undo-2', to: '/admin/shop/returns' },
      { label: t('admin.shop.dash.lowStock'), value: data.value.low_stock, icon: 'i-lucide-triangle-alert', to: '/admin/shop/inventory?low_only=1' },
      { label: t('admin.shop.dash.lotsExpiring'), value: data.value.lots_expiring, icon: 'i-lucide-calendar-clock', to: '/admin/shop/inventory?tab=lots' },
    ]
  : [])
</script>

<template>
  <div class="flex flex-col gap-6">
    <MzPageHeader :title="t('admin.shop.title')" :description="data ? t(`admin.shop.status.${data.shop_status}`) : undefined">
      <template #actions>
        <UButton to="/admin/shop/orders/new" icon="i-lucide-plus" :label="t('admin.shop.orders.newDraft')" />
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="pending" :aria-label="t('admin.refresh')" @click="refresh()" />
      </template>
    </MzPageHeader>
    <UAlert v-if="data?.stripe.warning" color="error" variant="subtle" icon="i-lucide-credit-card" :title="t('admin.shop.dash.stripeWarning')" :actions="[{ label: t('admin.shop.nav.settings'), to: '/admin/shop/settings', color: 'neutral', variant: 'outline' }]" />
    <div v-if="data" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MzStatCard :label="t('admin.shop.dash.salesToday')" :value="money(data.sales_today_minor, data.currency)" icon="i-lucide-banknote" />
      <MzStatCard :label="t('admin.shop.dash.ordersToday')" :value="data.orders_today" icon="i-lucide-receipt" />
      <NuxtLink v-for="tile in tiles" :key="tile.label" :to="tile.to" class="rounded-md focus-visible:outline-2 focus-visible:outline-primary">
        <MzStatCard :label="tile.label" :value="tile.value" :icon="tile.icon" />
      </NuxtLink>
    </div>
  </div>
</template>
