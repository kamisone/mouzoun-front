<script setup lang="ts">
import type { ShopVariant } from '~/utils/shop-types'

/**
 * Product page: gallery (switches with the variant), variant picker (`?variant=` in the URL),
 * price, compare-at, unit price, availability, quantity, food information, reviews, related.
 * JSON-LD `Product` with its offers for search engines.
 */
definePageMeta({ i18n: { paths: { fr: '/boutique/p/[slug]', en: '/shop/p/[slug]', ar: '/boutique/p/[slug]' } } })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const api = useShopApi()
const cart = useShopCart()
const shopPath = useShopPath()
const toast = useToast()
const { money } = useMoney()
const { date } = useDate()
const { data: config } = await useShopConfig()
if (config.value?.status === 'closed') throw createError({ statusCode: 404, statusMessage: 'Not found' })
const { data: product } = await useAsyncData(`shop-product-${route.params.slug}`, () => api.product(String(route.params.slug)))
if (!product.value) throw createError({ statusCode: 404, statusMessage: 'Not found' })
const p = computed(() => product.value!)
const canBuy = computed(() => config.value?.status === 'open')

const initial = p.value.variants.find(v => v.id === route.query.variant)
  ?? p.value.variants.find(v => v.is_default && v.availability !== 'out_of_stock')
  ?? p.value.variants.find(v => v.availability !== 'out_of_stock')
  ?? p.value.variants[0]
const variantId = ref<string | null>(initial?.id ?? null)
const variant = computed<ShopVariant | undefined>(() => p.value.variants.find(v => v.id === variantId.value))
watch(variantId, id => router.replace({ query: { ...route.query, variant: id ?? undefined } }))
const quantity = ref(1)
const maxQty = computed(() => Math.max(1, Math.min(variant.value?.max_quantity ?? 1, p.value.max_quantity)))
watch(variant, () => { quantity.value = Math.min(quantity.value, maxQty.value) })

const images = computed(() => {
  const own = variant.value?.media ?? []
  const gallery = p.value.gallery.map(g => ({ url: g.url }))
  return own.length ? [...own, ...gallery.filter(g => !own.some(o => o.url === g.url))] : gallery
})
const current = ref(0)
watch(variantId, () => { current.value = 0 })

const soldOut = computed(() => variant.value?.availability === 'out_of_stock')
const adding = ref(false)
async function addToCart() {
  if (!variant.value) return
  adding.value = true
  try {
    await cart.add(variant.value.id, quantity.value)
    toast.add({ title: t('shop.product.added'), color: 'success' })
  }
  catch {
    toast.add({ title: cart.error.value ?? t('shop.errors.generic'), color: 'error' })
  }
  finally {
    adding.value = false
  }
}

const notifyEmail = ref('')
const notified = ref(false)
async function notify() {
  if (!variant.value || !notifyEmail.value.includes('@')) return
  await api.notifyStock(variant.value.id, notifyEmail.value).catch(() => {})
  notified.value = true
}

const availabilityLabel = computed(() => {
  const v = variant.value
  if (!v) return ''
  return v.availability === 'low_stock' && v.quantity_left ? t('shop.availability.low_stock', { n: v.quantity_left }) : t(`shop.availability.${v.availability}`)
})

// Accueil › Boutique › (parents ›) primary category › product.
const localePath = useLocalePath()
const crumbs = computed(() => [
  { label: t('nav.home'), to: localePath('/') },
  { label: t('shop.title'), to: shopPath() },
  ...(p.value.breadcrumbs ?? p.value.categories.slice(0, 1)).map(c => ({ label: c.name, to: shopPath(c.slug) })),
  { label: p.value.name },
])

useSeo({
  title: () => `${p.value.seo.title || p.value.name} · ${t('shop.title')}`,
  description: () => p.value.seo.description || p.value.short_description || t('shop.description'),
  image: () => images.value[0]?.url,
})
const setI18nParams = useSetI18nParams()
setI18nParams(Object.fromEntries(Object.entries(p.value.slugs).map(([l, slug]) => [l, { slug }])))

// Structured data: Product + offers (price, currency, availability, sku, gtin) + rating.
const schemaAvailability = { in_stock: 'InStock', low_stock: 'LimitedAvailability', out_of_stock: 'OutOfStock', backorder: 'BackOrder' } as const
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: () => JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': p.value.name,
      'description': p.value.short_description ?? p.value.description ?? undefined,
      'image': images.value.map(i => i.url),
      'sku': variant.value?.sku,
      'gtin': variant.value?.barcode ?? undefined,
      'brand': { '@type': 'Brand', 'name': 'Mouzoun' },
      'offers': p.value.variants.map(v => ({
        '@type': 'Offer',
        'sku': v.sku,
        'gtin': v.barcode ?? undefined,
        'price': (v.price_minor / 100).toFixed(2),
        'priceCurrency': p.value.currency,
        'availability': `https://schema.org/${schemaAvailability[v.availability]}`,
      })),
      ...(p.value.reviews.count > 0 && p.value.reviews.average
        ? { aggregateRating: { '@type': 'AggregateRating', 'ratingValue': p.value.reviews.average.toFixed(1), 'reviewCount': p.value.reviews.count } }
        : {}),
    }),
  }],
})
</script>

<template>
  <MzContainer class="flex flex-col gap-16 py-12 pt-24">
    <MzShopBreadcrumbs :items="crumbs" />
    <div class="grid gap-12 lg:grid-cols-2">
      <section :aria-label="p.name" class="flex flex-col gap-3">
        <MzImage v-if="images[current]" :key="images[current]!.url" :src="images[current]!.url" :alt="p.name" ratio="4/5" priority sizes="xs:100vw lg:50vw" />
        <ul v-if="images.length > 1" class="flex gap-2 overflow-x-auto">
          <li v-for="(img, i) in images" :key="img.url">
            <button type="button" class="block w-20 rounded-sm focus-visible:outline-2 focus-visible:outline-primary" :class="i === current ? 'ring-2 ring-inverted' : 'opacity-80'" :aria-label="`${p.name} ${i + 1}/${images.length}`" :aria-pressed="i === current" @click="current = i">
              <MzImage :src="img.url" alt="" decorative ratio="1/1" sizes="xs:80px" />
            </button>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <h1 class="font-display text-h1 text-highlighted">{{ p.name }}</h1>
          <p v-if="p.subtitle" class="text-body text-muted">{{ p.subtitle }}</p>
          <div v-if="variant" class="flex flex-wrap items-baseline gap-3" data-testid="product-price">
            <MzPrice :cents="variant.price_minor" :currency="p.currency" size="lg" show-zero />
            <s v-if="variant.compare_at_price_minor" class="text-body text-muted">{{ money(variant.compare_at_price_minor, p.currency) }}</s>
            <UBadge v-if="variant.compare_at_price_minor" color="success" variant="soft" :label="t('shop.product.save', { amount: money(variant.compare_at_price_minor - variant.price_minor, p.currency) })" />
          </div>
          <!-- A reduction refers to the lowest price of the previous 30 days (Consumer Code L112-1-1). -->
          <p v-if="variant?.compare_at_price_minor && variant.reference_price_minor" class="text-caption text-muted" data-testid="reference-price">
            {{ t('shop.product.referencePrice', { price: money(variant.reference_price_minor, p.currency) }) }}
          </p>
          <p class="text-caption text-muted">{{ t('shop.product.ttc') }}<template v-if="variant?.country_of_origin"> · {{ t('shop.product.origin', { country: variant.country_of_origin }) }}</template></p>
          <p v-if="variant?.unit_price" class="text-small text-muted">
            {{ t('shop.product.unitPrice', { price: money(variant.unit_price.amount_minor, p.currency), unit: t(`shop.product.units.${variant.unit_price.unit}`) }) }}
          </p>
          <p v-if="variant" class="flex items-center gap-2 text-small" :class="soldOut ? 'text-error' : variant.availability === 'low_stock' ? 'text-warning' : 'text-success'" data-testid="product-availability">
            <UIcon :name="soldOut ? 'i-lucide-circle-x' : 'i-lucide-circle-check'" class="size-4" aria-hidden="true" />{{ availabilityLabel }}
          </p>
          <p v-if="p.season.from && p.season.until" class="text-small text-muted">{{ t('shop.product.season', { from: date(p.season.from), until: date(p.season.until) }) }}</p>
        </div>

        <MzVariantPicker v-if="p.options.length" v-model="variantId" :options="p.options" :variants="p.variants" />

        <template v-if="canBuy">
          <div v-if="!soldOut" class="flex flex-col gap-3">
            <MzQuantityStepper v-model="quantity" :label="t('shop.product.quantity')" :min="1" :max="maxQty" :max-reason="t('shop.product.maxReached', { n: maxQty })" />
            <UButton :label="t('shop.product.addToCart')" icon="i-lucide-shopping-basket" size="xl" block :loading="adding" data-testid="add-to-cart" @click="addToCart" />
          </div>
          <form v-else class="flex flex-col gap-2" @submit.prevent="notify">
            <p v-if="notified" class="text-body text-success" role="status">{{ t('shop.product.notifySent') }}</p>
            <template v-else>
              <UFormField :label="t('shop.product.notifyMe')" name="notify-email">
                <UInput v-model="notifyEmail" type="email" autocomplete="email" :placeholder="t('shop.product.notifyEmail')" class="w-full" />
              </UFormField>
              <UButton type="submit" :label="t('shop.product.notifyMe')" color="neutral" variant="outline" />
            </template>
          </form>
        </template>
        <p v-else class="rounded-md bg-elevated p-4 text-body text-muted">{{ t('shop.product.comingSoon') }}</p>

        <p v-if="p.short_description" class="text-body">{{ p.short_description }}</p>
        <MzFoodInfo :product="p" />
      </section>
    </div>

    <section v-if="p.reviews.count" class="flex flex-col gap-4" aria-labelledby="reviews-title">
      <h2 id="reviews-title" class="font-display text-h2 text-highlighted">{{ t('shop.product.reviews') }}</h2>
      <p class="text-small text-muted">★ {{ p.reviews.average?.toFixed(1) }} · {{ t('shop.product.reviewsCount', { n: p.reviews.count }, p.reviews.count) }}</p>
      <ul class="grid gap-4 md:grid-cols-2">
        <li v-for="(r, i) in p.reviews.latest" :key="i" class="flex flex-col gap-1 rounded-md border border-default p-4">
          <p class="font-medium text-highlighted">{{ '★'.repeat(r.rating) }} {{ r.title }}</p>
          <p class="text-body">{{ r.body }}</p>
          <p class="text-small text-muted">{{ r.author }}<template v-if="r.verified"> · {{ t('shop.product.verified') }}</template></p>
        </li>
      </ul>
    </section>

    <section v-if="p.related.length" class="flex flex-col gap-4" aria-labelledby="related-title">
      <h2 id="related-title" class="font-display text-h2 text-highlighted">{{ t('shop.product.related') }}</h2>
      <ul class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <li v-for="r in p.related" :key="r.id">
          <NuxtLink :to="shopPath(`p/${r.slug}`)" class="flex flex-col gap-2">
            <MzImage v-if="r.image_url" :src="r.image_url" :alt="r.name" ratio="4/5" sizes="xs:50vw md:25vw" />
            <span class="font-medium text-highlighted">{{ r.name }}</span>
            <MzPrice v-if="r.price_min_minor !== null" :cents="r.price_min_minor" :currency="p.currency" size="sm" show-zero />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </MzContainer>
</template>
