<script setup lang="ts">
import type { ShopCard } from '~/utils/shop-types'

/**
 * The shop's product card, used everywhere a shop product is listed (shop listing, category pages,
 * the page-builder `shop_products` section): one link to the product page (photo and name inside),
 * price ("à partir de" when variants differ), compare-at, unit price, availability, badges, and a
 * button that follows the shop status:
 * - open, one variant in stock: "Ajouter au panier" (the cart drawer opens);
 * - open, several variants: "Choisir les options" (the product page);
 * - sold out: "Me prévenir" (the product page and its notify-me form);
 * - catalog only: no buying, "Bientôt disponible".
 * No wishlist heart: wishlists hold stays and activities.
 */
const props = withDefaults(defineProps<{
  product: ShopCard
  /** The shop takes orders (`shop.status = open`). */
  canBuy: boolean
  /** `catalog_only` shows "Bientôt disponible" instead of buttons. */
  catalogOnly?: boolean
  priority?: boolean
  /** No button at all: the card is a link only. */
  quickAdd?: boolean
  ratio?: 'square' | 'portrait' | 'adapt'
  showSecondaryImage?: boolean
  showUnitPrice?: boolean
  showRating?: boolean
  sizes?: string
}>(), { catalogOnly: false, priority: false, quickAdd: true, ratio: 'portrait', showSecondaryImage: false, showUnitPrice: false, showRating: false, sizes: '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw' }) // lint-tokens-ignore (native sizes)

const { t } = useI18n()
const cart = useShopCart()
const toast = useToast()
const { money } = useMoney()
const adding = ref(false)
const soldOut = computed(() => props.product.availability === 'out_of_stock')
const single = computed(() => !!props.product.default_variant_id)
const ratios = { square: '1/1', portrait: '4/5' } as const
const ratioValue = computed(() => (props.ratio === 'adapt' ? undefined : ratios[props.ratio]))
const priceMinor = computed(() => props.product.price_minor ?? props.product.price_min_minor)
const compareAt = computed(() => props.product.compare_at_price_minor ?? props.product.compare_at_minor)
const priceFrom = computed(() => props.product.price_is_from ?? props.product.price_max_minor > props.product.price_min_minor)
const badges = computed(() => (props.product.badges ?? []).filter(b => b !== 'sold_out'))
const unitLabel = computed(() => {
  const u = props.product.unit_price
  return u ? `${money(u.amount_minor, props.product.currency)} / ${t(`shop.product.units.${u.unit}`)}` : null
})

async function addToCart() {
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
    <NuxtLink :to="props.product.url" class="flex flex-col gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" data-testid="shop-card-link">
      <div class="relative">
        <MzMedia v-if="props.product.cover" :media="props.product.cover" :alt="props.product.cover.alt || props.product.name" :ratio="ratioValue" :priority="props.priority" :sizes="props.sizes" />
        <MzImage v-else-if="props.product.image_url" :src="props.product.image_url" :alt="props.product.name" :ratio="props.ratio === 'square' ? '1/1' : '4/5'" zoom :priority="props.priority" sizes="xs:50vw md:33vw lg:25vw" />
        <div v-else class="rounded-sm bg-accented" :class="props.ratio === 'square' ? 'aspect-square' : 'aspect-4/5'" aria-hidden="true" />
        <!-- Second photo on hover (pointer devices only). -->
        <div v-if="props.showSecondaryImage && props.product.secondary_image" class="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none md:block" aria-hidden="true">
          <MzMedia :media="props.product.secondary_image" decorative :ratio="ratioValue" :sizes="props.sizes" fill />
        </div>
        <ul v-if="badges.length || soldOut" class="absolute start-2 top-2 flex flex-wrap gap-1">
          <li v-if="soldOut"><UBadge color="neutral" variant="solid" size="sm" :label="t('shop.badges.sold_out')" /></li>
          <li v-for="b in badges" :key="b"><UBadge :color="b === 'sale' ? 'error' : 'neutral'" variant="solid" size="sm" :label="t(`shop.badges.${b}`)" /></li>
        </ul>
      </div>
      <div class="flex flex-col gap-1">
        <h3 class="font-display text-h4 text-highlighted">{{ props.product.name }}</h3>
        <p v-if="props.product.short_description" class="line-clamp-2 text-small text-muted">{{ props.product.short_description }}</p>
        <div class="flex flex-wrap items-baseline gap-2" data-testid="shop-card-price">
          <MzPrice :cents="priceMinor" :currency="props.product.currency" :from="priceFrom" show-zero />
          <s v-if="compareAt" class="text-small text-muted">{{ money(compareAt, props.product.currency) }}</s>
        </div>
        <span v-if="props.showUnitPrice && unitLabel" class="text-caption text-muted">{{ unitLabel }}</span>
        <span v-if="props.showRating && props.product.rating?.count" class="text-caption text-muted">
          {{ t('sections.rating', { average: props.product.rating.average.toLocaleString(), count: props.product.rating.count }) }}
        </span>
        <span class="text-small" :class="soldOut ? 'text-error' : props.product.availability === 'low_stock' ? 'text-warning' : 'text-muted'">
          {{ props.product.availability === 'low_stock' ? t('shop.availability.low_stock_generic') : t(`shop.availability.${props.product.availability}`) }}
        </span>
      </div>
    </NuxtLink>
    <template v-if="props.quickAdd">
      <p v-if="props.catalogOnly" class="text-caption text-muted" data-testid="shop-card-soon">{{ t('shop.card.soon') }}</p>
      <template v-else-if="props.canBuy">
        <UButton
          v-if="soldOut"
          :to="props.product.url"
          :label="t('shop.card.notify')"
          icon="i-lucide-bell"
          color="neutral"
          variant="ghost"
          block
          :aria-label="`${t('shop.card.notify')} · ${props.product.name}`"
          data-testid="shop-card-notify"
        />
        <UButton
          v-else-if="single"
          :label="t('shop.product.addToCart')"
          icon="i-lucide-shopping-basket"
          color="neutral"
          variant="outline"
          block
          :loading="adding"
          :aria-label="`${t('shop.product.addToCart')} · ${props.product.name}`"
          data-testid="shop-card-add"
          @click="addToCart"
        />
        <UButton
          v-else
          :to="props.product.url"
          :label="t('shop.card.options')"
          color="neutral"
          variant="outline"
          block
          :aria-label="`${t('shop.card.options')} · ${props.product.name}`"
          data-testid="shop-card-options"
        />
      </template>
    </template>
  </article>
</template>
