<script setup lang="ts">
/** Returns: open ones first; each opens its order (approve, reject, receive with restock, refund). */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.nav.returns' })
const { t } = useI18n()
const admin = useAdminApi()
const { date } = useDate()
const { statusColor } = useShopAdmin()
const page = ref(1)
const { data } = await useAsyncData(() => `admin-shop-returns-${page.value}`, () => admin.shop.returns.list({ page: page.value, per_page: 50 }), { watch: [page] })
</script>

<template>
  <div class="flex flex-col gap-4">
    <MzPageHeader :title="t('admin.shop.nav.returns')" />
    <MzEmptyState v-if="!data?.data.length" icon="i-lucide-undo-2" :title="t('admin.shop.returns.none')" description="" />
    <table v-else class="w-full text-small">
      <thead class="text-muted"><tr><th class="p-2 text-start">{{ t('admin.shop.returns.return') }}</th><th class="p-2 text-start">{{ t('admin.shop.orders.number') }}</th><th class="p-2 text-start">{{ t('shop.order.returnRequest.reason') }}</th><th class="p-2 text-start">{{ t('admin.shop.orders.status') }}</th><th class="p-2 text-start">{{ t('admin.shop.orders.date') }}</th></tr></thead>
      <tbody>
        <tr v-for="r in data.data" :key="r.id" class="border-t border-default">
          <td class="p-2 font-medium">{{ r.number }} <span class="text-muted">· {{ r.item_count }}</span></td>
          <td class="p-2"><NuxtLink :to="`/admin/shop/orders/${r.order_id}`" class="underline">{{ r.order_number }}</NuxtLink></td>
          <td class="p-2">{{ t(`shop.order.returnRequest.reasons.${r.reason}`) }}</td>
          <td class="p-2"><UBadge :color="statusColor(r.status)" variant="soft" :label="t(`admin.shop.returns.statuses.${r.status}`)" /></td>
          <td class="p-2">{{ date(r.requested_at) }}</td>
        </tr>
      </tbody>
    </table>
    <UPagination v-if="(data?.total ?? 0) > 50" v-model:page="page" :total="data?.total ?? 0" :items-per-page="50" />
  </div>
</template>
