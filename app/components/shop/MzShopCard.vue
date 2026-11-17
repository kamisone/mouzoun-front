<script setup lang="ts">
import type { ShopCard } from '~/utils/shop-types'

/** A product of the shop listing: photo, name, price (range), availability, quick add. */
const props = defineProps<{ product: ShopCard, canBuy: boolean, priority?: boolean }>()
const { t } = useI18n()
const shopPath = useShopPath()
const cart = useShopCart()
const toast = useToast()
const { money } = useMoney()
const adding = ref(false)
const to = computed(() => shopPath(`p/${props.product.slug}`))
const soldOut = computed(() => props.product.availability === 'out_of_stock')

async function quickAdd() {
  if (!props.product.default_variant_id) return
  adding.value = true
  try {
    await cart.add(props.product.default_variant_id, 1)
  }
  catch {
    toast.add({ title: cart.error.value ?? t('shop.errors.generic'), color: 'error' })
  }
  finally {
    adding.value = false
  }
}
</script>

<template>
  <article class="group flex flex-col gap-3" data-testid="shop-card">
    <NuxtLink :to="to" class="flex flex-col gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <MzImage v-if="props.product.image_url" :src="props.product.image_url" :alt="props.product.name" ratio="4/5" zoom :priority="props.priority" sizes="xs:50vw md:33vw lg:25vw" />
      <div v-else class="aspect-4/5 rounded-sm bg-accented" aria-hidden="true" />
      <div class="flex flex-col gap-1">
        <h3 class="font-display text-h4 text-highlighted">{{ props.product.name }}</h3>
        <p v-if="props.product.short_description" class="line-clamp-2 text-small text-muted">{{ props.product.short_description }}</p>
        <div class="flex flex-wrap items-baseline gap-2">
          <MzPrice :cents="props.product.price_min_minor" :currency="props.product.currency" :from="props.product.price_max_minor > props.product.price_min_minor" show-zero />
          <s v-if="props.product.compare_at_minor" class="text-small text-muted">{{ money(props.product.compare_at_minor, props.product.currency) }}</s>
        </div>
        <span class="text-small" :class="soldOut ? 'text-error' : props.product.availability === 'low_stock' ? 'text-warning' : 'text-muted'">
          {{ props.product.availability === 'low_stock' ? t('shop.availability.low_stock_generic') : t(`shop.availability.${props.product.availability}`) }}
        </span>
      </div>
    </NuxtLink>
    <UButton
      v-if="props.canBuy && props.product.default_variant_id && !soldOut"
      :label="t('shop.product.addToCart')"
      icon="i-lucide-shopping-basket"
      color="neutral"
      variant="outline"
      block
      :loading="adding"
      :aria-label="`${t('shop.product.addToCart')} · ${props.product.name}`"
      @click="quickAdd"
    />
  </article>
</template>
