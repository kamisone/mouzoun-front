<script setup lang="ts">
import type { Cart } from '~/utils/shop-types'

/** Totals of a cart or order: subtotal, discount, shipping, COD fee, total, VAT included. */
const props = defineProps<{ cart: Pick<Cart, 'totals' | 'currency' | 'promotions'> & { shipping_known?: boolean } }>()
const { t } = useI18n()
const { money } = useMoney()
const t_ = computed(() => props.cart.totals)
const shippingNet = computed(() => t_.value.shipping_minor - t_.value.shipping_discount_minor)
</script>

<template>
  <dl class="flex flex-col gap-2 text-body" data-testid="cart-summary">
    <div class="flex justify-between gap-4">
      <dt class="text-muted">{{ t('shop.cart.subtotal') }}</dt>
      <dd class="tabular-nums">{{ money(t_.subtotal_minor, props.cart.currency) }}</dd>
    </div>
    <div v-if="t_.discount_minor > 0" class="flex justify-between gap-4 text-success">
      <dt>{{ t('shop.cart.discount') }}</dt>
      <dd class="tabular-nums">−{{ money(t_.discount_minor, props.cart.currency) }}</dd>
    </div>
    <div class="flex justify-between gap-4">
      <dt class="text-muted">{{ t('shop.cart.shipping') }}</dt>
      <dd class="tabular-nums">
        <template v-if="props.cart.shipping_known === false">{{ t('shop.cart.shippingLater') }}</template>
        <template v-else-if="shippingNet === 0">{{ t('shop.cart.shippingFree') }}</template>
        <template v-else>{{ money(shippingNet, props.cart.currency) }}</template>
      </dd>
    </div>
    <div v-if="t_.cod_fee_minor > 0" class="flex justify-between gap-4">
      <dt class="text-muted">{{ t('shop.cart.codFee') }}</dt>
      <dd class="tabular-nums">{{ money(t_.cod_fee_minor, props.cart.currency) }}</dd>
    </div>
    <div v-if="!t_.taxes_included && t_.tax_minor > 0" class="flex justify-between gap-4">
      <dt class="text-muted">{{ t('shop.cart.taxAdded') }}</dt>
      <dd class="tabular-nums">{{ money(t_.tax_minor, props.cart.currency) }}</dd>
    </div>
    <div class="flex justify-between gap-4 border-t border-default pt-3 text-h4 font-medium text-highlighted">
      <dt>{{ t('shop.cart.total') }}</dt>
      <dd class="tabular-nums" data-testid="cart-total">{{ money(t_.total_minor, props.cart.currency) }}</dd>
    </div>
    <p v-if="t_.taxes_included && t_.tax_minor > 0" class="text-end text-small text-muted">
      {{ t('shop.cart.taxIncluded', { amount: money(t_.tax_minor, props.cart.currency) }) }}
    </p>
  </dl>
</template>
