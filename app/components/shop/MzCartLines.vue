<script setup lang="ts">
import type { Cart } from '~/utils/shop-types'

/** Cart lines with quantity steppers (optimistic, then replaced by the server) and issues. */
const props = withDefaults(defineProps<{ cart: Cart, compact?: boolean, editable?: boolean }>(), { compact: false, editable: true })
const { t } = useI18n()
const shopPath = useShopPath()
const store = useShopCart()
const { money } = useMoney()

function setQuantity(id: string, q: number) {
  store.setQuantity(id, q).catch(() => {})
}
</script>

<template>
  <ul class="flex flex-col divide-y divide-default" data-testid="cart-lines">
    <li v-for="item in props.cart.items" :key="item.id" class="flex gap-4 py-4" :data-testid="`cart-line-${item.sku}`">
      <NuxtLink :to="shopPath(`p/${item.slug}`)" class="w-20 shrink-0">
        <MzImage v-if="item.image_url" :src="item.image_url" :alt="item.name" ratio="1/1" sizes="xs:80px" />
        <div v-else class="aspect-square rounded-sm bg-accented" aria-hidden="true" />
      </NuxtLink>
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <NuxtLink :to="shopPath(`p/${item.slug}`)" class="font-medium text-highlighted hover:underline">{{ item.name }}</NuxtLink>
            <p v-if="item.options_label" class="text-small text-muted">{{ item.options_label }}</p>
          </div>
          <div class="text-end tabular-nums">
            <p class="font-medium text-highlighted">{{ money(item.total_minor, props.cart.currency) }}</p>
            <s v-if="item.discount_minor > 0" class="text-small text-muted">{{ money(item.subtotal_minor, props.cart.currency) }}</s>
          </div>
        </div>
        <MzShopIssue v-for="(issue, i) in item.issues" :key="i" :issue="issue" :currency="props.cart.currency" />
        <div v-if="props.editable" class="flex items-center gap-2">
          <UButton icon="i-lucide-minus" color="neutral" variant="outline" size="sm" square class="rounded-full" :aria-label="`${t('booking.decrease', { label: item.name })}`" :disabled="store.busy.value" @click="setQuantity(item.id, item.quantity - 1)" />
          <output class="w-8 text-center tabular-nums" aria-live="polite">{{ item.quantity }}</output>
          <UButton icon="i-lucide-plus" color="neutral" variant="outline" size="sm" square class="rounded-full" :aria-label="`${t('booking.increase', { label: item.name })}`" :disabled="store.busy.value" @click="setQuantity(item.id, item.quantity + 1)" />
          <UButton :label="props.compact ? undefined : t('common.delete')" icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" class="ms-auto" :aria-label="t('shop.cart.remove', { name: item.name })" @click="store.remove(item.id).catch(() => {})" />
        </div>
        <p v-else class="text-small text-muted">× {{ item.quantity }}</p>
      </div>
    </li>
  </ul>
</template>
