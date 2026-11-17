<script setup lang="ts">
/** The cart page: lines, issues, promo code, shipping estimate by country, totals. */
definePageMeta({ i18n: { paths: { fr: '/boutique/cart', en: '/shop/cart', ar: '/boutique/cart' } } })

const { t, locale } = useI18n()
const shopPath = useShopPath()
const store = useShopCart()
const { money } = useMoney()
const { data: config } = await useShopConfig()
if (config.value?.status !== 'open') throw createError({ statusCode: 404, statusMessage: 'Not found' })
useHead({ meta: [{ name: 'robots', content: 'noindex' }] })
useSeo({ title: () => `${t('shop.cart.title')} · ${t('common.siteName')}`, description: () => t('shop.description') })
onMounted(() => store.load())
const cart = store.cart

const code = ref('')
async function applyCode() {
  if (!code.value.trim()) return
  await store.addCode(code.value.trim()).catch(() => {})
  code.value = ''
}
const regionNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'region' }))
const countries = computed(() => (config.value?.ships_to_countries ?? []).map(c => ({ value: c, label: regionNames.value.of(c) ?? c })))
const country = ref<string | undefined>(cart.value?.estimate_country ?? cart.value?.shipping_address?.country_code ?? undefined)
watch(country, (c) => {
  if (c) store.fulfillment({ method: 'shipping', estimate_country: c }).catch(() => {})
})
const generalIssues = computed(() => (cart.value?.issues ?? []).filter(i => !['fulfillment_required', 'address_required'].includes(i.code)))
</script>

<template>
  <MzContainer class="flex flex-col gap-8 py-12 pt-24">
    <MzPageHeader :title="t('shop.cart.title')" />
    <MzEmptyState v-if="!cart || !cart.items.length" icon="i-lucide-shopping-basket" :title="t('shop.cart.empty')" description="">
      <UButton :to="shopPath()" :label="t('shop.cart.continue')" />
    </MzEmptyState>
    <div v-else class="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <section class="flex flex-col gap-4" :aria-busy="store.busy.value">
        <MzCartLines :cart="cart" />
        <p v-if="store.error.value" class="text-small text-error" role="alert">{{ store.error.value }}</p>
        <UButton :to="shopPath()" :label="t('shop.cart.continue')" icon="i-lucide-arrow-left" color="neutral" variant="link" class="self-start px-0" />
      </section>
      <aside class="flex flex-col gap-6 rounded-md border border-default p-6" :aria-label="t('shop.checkout.summary')">
        <form class="flex flex-col gap-2" @submit.prevent="applyCode">
          <UFormField :label="t('shop.cart.promo.label')" name="promo">
            <div class="flex gap-2">
              <UInput v-model="code" class="flex-1" autocomplete="off" data-testid="promo-input" />
              <UButton type="submit" :label="t('shop.cart.promo.apply')" color="neutral" variant="outline" />
            </div>
          </UFormField>
          <ul class="flex flex-wrap gap-2">
            <li v-for="c in cart.promotion_codes" :key="c">
              <UBadge color="neutral" variant="soft" class="gap-1">
                {{ c }}
                <button type="button" :aria-label="t('shop.cart.promo.remove', { code: c })" @click="store.removeCode(c).catch(() => {})"><UIcon name="i-lucide-x" class="size-3" /></button>
              </UBadge>
            </li>
          </ul>
          <p v-for="p in cart.promotions.filter(p => p.code)" :key="p.promotion_id" class="text-small text-success">
            {{ t('shop.cart.promo.applied', { code: p.code, amount: money(p.amount_minor + p.shipping_amount_minor, cart.currency) }) }}
          </p>
        </form>
        <UFormField :label="t('shop.cart.estimate.label')" name="estimate-country">
          <USelect v-model="country" :items="countries" :placeholder="t('shop.cart.estimate.country')" class="w-full" />
        </UFormField>
        <MzShopIssue v-for="(issue, i) in generalIssues" :key="i" :issue="issue" :currency="cart.currency" />
        <MzCartSummary :cart="{ ...cart, shipping_known: !!country || !!cart.fulfillment_method }" />
        <UButton :to="shopPath('checkout')" :label="t('shop.cart.checkout')" size="xl" block :disabled="cart.items.some(i => i.issues.some(x => x.code !== 'promotion_not_applicable'))" data-testid="go-checkout" />
      </aside>
    </div>
  </MzContainer>
</template>
