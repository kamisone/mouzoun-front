<script setup lang="ts">
import type { Address } from '~/utils/shop-types'

/** Shop orders (next to the stays) and saved delivery addresses. */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const api = useShopApi()
const shopPath = useShopPath()
const toast = useToast()
const { money } = useMoney()
const { date } = useDate()

const { data: orders, pending } = await useLazyAsyncData('account-shop-orders', () => api.account.orders(), { server: false })
const { data: addresses, refresh } = await useLazyAsyncData('account-shop-addresses', () => api.account.addresses(), { server: false })

const editing = ref(false)
const draft = ref<Address>({ first_name: '', last_name: '', line1: '', city: '', country_code: 'MA', phone: '' })
const errors = ref<Record<string, string>>({})
async function save() {
  try {
    await api.account.saveAddress({ ...draft.value, is_default: !addresses.value?.data.length })
    editing.value = false
    await refresh()
  }
  catch (e) {
    const fields = (e as { data?: { error?: { details?: { fields?: Record<string, string> } } } }).data?.error?.details?.fields ?? {}
    errors.value = Object.fromEntries(Object.entries(fields).map(([k]) => [k, t('shop.checkout.invalid')]))
  }
}
async function remove(id: string) {
  await api.account.deleteAddress(id).catch(() => toast.add({ title: t('shop.errors.generic'), color: 'error' }))
  await refresh()
}
</script>

<template>
  <MzAccountShell :title="t('shop.account.orders')">
    <section class="flex flex-col gap-4" aria-labelledby="orders-title">
      <h2 id="orders-title" class="font-display text-h3 text-highlighted">{{ t('shop.account.orders') }}</h2>
      <MzSkeleton v-if="pending" class="h-24" />
      <MzEmptyState v-else-if="!orders?.data.length" icon="i-lucide-shopping-basket" :title="t('shop.account.ordersEmpty')" description="">
        <UButton :to="shopPath()" :label="t('shop.title')" />
      </MzEmptyState>
      <ul v-else class="divide-y divide-default">
        <li v-for="o in orders.data" :key="o.number">
          <NuxtLink :to="shopPath(`orders/${o.number}`)" class="flex items-center gap-4 py-3 hover:bg-elevated">
            <MzImage v-if="o.image_url" :src="o.image_url" alt="" decorative ratio="1/1" class="w-14 shrink-0" sizes="xs:56px" />
            <div class="flex-1">
              <p class="font-medium text-highlighted">{{ o.number }}</p>
              <p class="text-small text-muted">{{ o.placed_at ? date(o.placed_at) : '' }} · {{ t(`shop.order.statuses.${o.status}`) }} · {{ t(`shop.order.fulfillment.${o.fulfillment_status}`) }}</p>
            </div>
            <span class="tabular-nums">{{ money(o.total_minor, o.currency) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
    <section class="mt-12 flex flex-col gap-4" aria-labelledby="addresses-title">
      <h2 id="addresses-title" class="font-display text-h3 text-highlighted">{{ t('shop.account.addresses') }}</h2>
      <ul class="grid gap-4 sm:grid-cols-2">
        <li v-for="a in addresses?.data ?? []" :key="a.id" class="flex flex-col gap-1 rounded-md border border-default p-4 text-small">
          <p class="font-medium text-highlighted">{{ a.first_name }} {{ a.last_name }} <UBadge v-if="a.is_default" size="sm" variant="soft" :label="t('shop.account.default')" /></p>
          <p>{{ a.line1 }}<template v-if="a.line2">, {{ a.line2 }}</template></p>
          <p>{{ a.postal_code }} {{ a.city }} · {{ a.country_code }}</p>
          <p dir="ltr" class="text-start">{{ a.phone }}</p>
          <UButton :label="t('common.delete')" color="neutral" variant="link" size="sm" class="self-start px-0" @click="remove(a.id)" />
        </li>
      </ul>
      <UButton v-if="!editing" :label="t('shop.account.addAddress')" icon="i-lucide-plus" color="neutral" variant="outline" class="self-start" @click="editing = true" />
      <form v-else class="flex flex-col gap-4" @submit.prevent="save">
        <MzAddressForm v-model="draft" :countries="['MA', 'FR', 'ES', 'BE', 'DE', 'IT', 'NL', 'PT']" :errors="errors" />
        <div class="flex gap-2">
          <UButton type="submit" :label="t('common.save')" />
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="editing = false" />
        </div>
      </form>
    </section>
  </MzAccountShell>
</template>
