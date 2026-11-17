<script setup lang="ts">
import type { Address } from '~/utils/shop-types'
import type { Json } from '~/utils/shop-admin-api'

/** Draft order (phone / WhatsApp / camp sale): customer, delivery, products. Priced by the server. */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.shop.orders.newDraft' })

const { t } = useI18n()
const admin = useAdminApi()
const { act } = useShopAdmin()
const { data: grid } = await useAsyncData('admin-shop-draft-variants', () => admin.shop.inventory.grid({ per_page: 100 }))
const { data: locations } = await useAsyncData('admin-shop-draft-locations', () => admin.shop.locations.list())

const form = reactive({
  channel: 'phone', email: '', first_name: '', last_name: '', phone: '', locale: 'fr',
  fulfillment_method: 'pickup', pickup_location_id: undefined as string | undefined, note: '',
})
const address = ref<Address>({ first_name: '', last_name: '', line1: '', city: '', country_code: 'MA', phone: '' })
const lines = ref<{ variant_id: string, label: string, quantity: number }[]>([])
const pick = ref<string>()
watch(pick, (id) => {
  const v = (grid.value?.data ?? []).find((x: Json) => x.variant_id === id)
  if (v && !lines.value.some(l => l.variant_id === id)) lines.value.push({ variant_id: v.variant_id, label: `${v.name} ${v.options} (${v.sku})`, quantity: 1 })
  pick.value = undefined
})
const saving = ref(false)
async function create() {
  saving.value = true
  const out = await act(() => admin.shop.orders.createDraft({
    channel: form.channel, email: form.email, first_name: form.first_name || address.value.first_name, last_name: form.last_name || address.value.last_name,
    phone: form.phone || address.value.phone || null, locale: form.locale, fulfillment_method: form.fulfillment_method,
    shipping_address: form.fulfillment_method === 'shipping' ? address.value : null,
    pickup_location_id: form.fulfillment_method === 'pickup' ? (form.pickup_location_id ?? locations.value?.data.find((l: Json) => l.is_pickup_point)?.id) : null,
    lines: lines.value.map(l => ({ variant_id: l.variant_id, quantity: l.quantity })), note: form.note || null,
  }))
  saving.value = false
  if (out?.id) await navigateTo(`/admin/shop/orders/${out.id}`)
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <MzPageHeader :title="t('admin.shop.orders.newDraft')" :breadcrumbs="[{ label: t('admin.shop.nav.orders'), to: '/admin/shop/orders' }, { label: t('admin.shop.orders.newDraft') }]" />
    <form class="flex flex-col gap-6" @submit.prevent="create">
      <UCard>
        <template #header><h2 class="font-medium">{{ t('admin.shop.orders.customer') }}</h2></template>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('admin.shop.orders.channel')" name="channel"><USelect v-model="form.channel" :items="['phone', 'whatsapp', 'camp_pos', 'admin'].map(c => ({ value: c, label: t(`admin.shop.channels.${c}`) }))" class="w-full" /></UFormField>
          <UFormField :label="t('admin.shop.drafts.language')" name="locale"><USelect v-model="form.locale" :items="['fr', 'en', 'ar']" class="w-full" /></UFormField>
          <UFormField :label="t('shop.checkout.email')" name="email" required><UInput v-model="form.email" type="email" class="w-full" /></UFormField>
          <UFormField :label="t('shop.checkout.phone')" name="phone"><UInput v-model="form.phone" type="tel" dir="ltr" class="w-full" /></UFormField>
          <UFormField :label="t('shop.checkout.firstName')" name="first_name"><UInput v-model="form.first_name" class="w-full" /></UFormField>
          <UFormField :label="t('shop.checkout.lastName')" name="last_name"><UInput v-model="form.last_name" class="w-full" /></UFormField>
        </div>
      </UCard>
      <UCard>
        <template #header><h2 class="font-medium">{{ t('shop.checkout.fulfillment.title') }}</h2></template>
        <URadioGroup v-model="form.fulfillment_method" :items="['pickup', 'shipping', 'stay_delivery'].map(m => ({ value: m, label: t(`shop.checkout.fulfillment.${m}`) }))" orientation="horizontal" />
        <USelect v-if="form.fulfillment_method === 'pickup'" v-model="form.pickup_location_id" class="mt-3 w-full" :items="(locations?.data ?? []).filter((l: Json) => l.is_pickup_point).map((l: Json) => ({ value: l.id, label: l.code }))" :placeholder="t('shop.checkout.fulfillment.pickupPoint')" />
        <MzAddressForm v-if="form.fulfillment_method === 'shipping'" v-model="address" class="mt-3" :countries="['MA', 'FR', 'ES', 'BE', 'DE', 'IT', 'NL', 'PT']" />
      </UCard>
      <UCard>
        <template #header><h2 class="font-medium">{{ t('shop.order.items') }}</h2></template>
        <USelect v-model="pick" :items="(grid?.data ?? []).map((v: Json) => ({ value: v.variant_id, label: `${v.name} ${v.options} (${v.sku}) · ${v.available}` }))" :placeholder="t('admin.shop.orders.addProduct')" class="w-full" />
        <ul class="mt-3 flex flex-col gap-2">
          <li v-for="(l, i) in lines" :key="l.variant_id" class="flex items-center justify-between gap-2">
            <span class="text-small">{{ l.label }}</span>
            <div class="flex items-center gap-2">
              <UInputNumber v-model="l.quantity" :min="1" size="sm" class="w-28" :aria-label="l.label" />
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :aria-label="t('common.delete')" @click="lines.splice(i, 1)" />
            </div>
          </li>
        </ul>
        <UTextarea v-model="form.note" class="mt-3 w-full" :placeholder="t('shop.checkout.note')" :rows="2" />
      </UCard>
      <UButton type="submit" :label="t('admin.shop.drafts.create')" :loading="saving" :disabled="!lines.length || !form.email" class="self-start" />
    </form>
  </div>
</template>
