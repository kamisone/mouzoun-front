<script setup lang="ts">
/** Side drawer opened after "add to cart" and from the header basket. */
const { t } = useI18n()
const store = useShopCart()
const shopPath = useShopPath()
const cart = store.cart
</script>

<template>
  <USlideover v-model:open="store.open.value" :title="t('shop.cart.title')" side="right" :ui="{ body: 'flex flex-col gap-4' }">
    <template #body>
      <MzEmptyState v-if="!cart || !cart.items.length" icon="i-lucide-shopping-basket" :title="t('shop.cart.empty')" />
      <template v-else>
        <MzCartLines :cart="cart" compact />
        <MzShopIssue v-for="(issue, i) in cart.issues.filter(x => x.code !== 'fulfillment_required' && x.code !== 'address_required')" :key="i" :issue="issue" :currency="cart.currency" />
        <MzCartSummary :cart="{ ...cart, shipping_known: !!cart.fulfillment_method }" />
      </template>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-2">
        <UButton v-if="cart?.items.length" :to="shopPath('checkout')" :label="t('shop.cart.checkout')" block size="lg" :disabled="!cart.items.length" @click="store.open.value = false" />
        <UButton :to="shopPath('cart')" :label="t('shop.cart.view')" color="neutral" variant="outline" block @click="store.open.value = false" />
      </div>
    </template>
  </USlideover>
</template>
