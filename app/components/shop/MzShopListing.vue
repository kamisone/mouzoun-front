<script setup lang="ts">
import type { ShopCategory, ShopList } from '~/utils/shop-types'

/**
 * Product listing shared by the shop home and the category pages. Filters, sort and page live
 * in the URL (shareable, rendered on the server); "Load more" appends the next page while a
 * real `?page=` link stays in the markup for crawlers.
 */
/** In a category with no sort chosen, the API applies its default sort (pinned products first). */
const props = defineProps<{ category?: ShopCategory | null }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const api = useShopApi()
const shopPath = useShopPath()
const { data: config } = await useShopConfig()
const canBuy = computed(() => config.value?.status === 'open')

const query = computed(() => ({
  category: props.category?.id,
  q: (route.query.q as string) || undefined,
  sort: (route.query.sort as string) || (props.category ? undefined : 'featured'),
  in_stock: route.query.in_stock === '1' || undefined,
  product_type: (route.query.type as string) || undefined,
  min_price: route.query.min ? Number(route.query.min) * 100 : undefined,
  max_price: route.query.max ? Number(route.query.max) * 100 : undefined,
  options: (route.query.options as string) || undefined,
  page: Number(route.query.page ?? 1) || 1,
  per_page: 24,
}))

const { data, pending } = await useAsyncData(
  () => `shop-list-${JSON.stringify(query.value)}`,
  () => api.products(query.value),
  { watch: [query] },
)
const extra = ref<ShopList['data']>([])
watch(query, () => { extra.value = [] })
const cards = computed(() => [...(data.value?.data ?? []), ...extra.value])
const nextPage = ref<number | null>(null)
watchEffect(() => {
  const d = data.value
  nextPage.value = d && d.page * d.per_page < d.total ? d.page + 1 + Math.floor(extra.value.length / d.per_page) : null
})
const loadingMore = ref(false)
async function loadMore() {
  if (!nextPage.value) return
  loadingMore.value = true
  try {
    const more = await api.products({ ...query.value, page: nextPage.value })
    extra.value.push(...more.data)
    nextPage.value = more.page * more.per_page < more.total ? more.page + 1 : null
  }
  finally {
    loadingMore.value = false
  }
}

function update(patch: Record<string, string | undefined>) {
  const merged: Record<string, unknown> = { ...route.query, ...patch, page: undefined }
  const next = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>
  router.replace({ query: next })
}
const sortItems = computed(() => [
  ...(props.category ? [{ value: 'default', label: t('shop.sort.default') }] : []),
  ...['featured', 'newest', 'price_asc', 'price_desc', 'best_selling', 'name'].map(v => ({ value: v, label: t(`shop.sort.${v}`) })),
])
const sortValue = computed(() => (route.query.sort as string) || (props.category ? 'default' : 'featured'))
const typeItems = computed(() => [{ value: 'all', label: t('shop.filters.all') }, ...['food', 'craft', 'gift_box', 'cosmetic', 'drink'].map(v => ({ value: v, label: t(`shop.types.${v}`) }))])
const categories = computed(() => data.value?.facets.categories ?? [])
const priceMin = ref((route.query.min as string) ?? '')
const priceMax = ref((route.query.max as string) ?? '')
watchDebounced([priceMin, priceMax], ([a, b]) => update({ min: a || undefined, max: b || undefined }), { debounce: 500 })
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[16rem_1fr]">
    <aside class="flex flex-col gap-6" :aria-label="t('shop.filters.title')">
      <nav :aria-label="t('shop.filters.category')">
        <h2 class="mb-2 text-small font-medium uppercase tracking-wide text-muted">{{ t('shop.filters.category') }}</h2>
        <ul class="flex flex-col gap-1">
          <li>
            <NuxtLink :to="shopPath()" class="block rounded-sm px-2 py-2 text-body hover:bg-elevated" :class="!props.category && 'font-medium text-highlighted'" :aria-current="!props.category ? 'page' : undefined">
              {{ t('shop.filters.all') }}
            </NuxtLink>
          </li>
          <li v-for="c in categories.filter(c => !c.parent_id)" :key="c.id">
            <NuxtLink :to="shopPath(c.slug)" class="flex justify-between rounded-sm px-2 py-2 text-body hover:bg-elevated" :class="props.category?.id === c.id && 'font-medium text-highlighted'" :aria-current="props.category?.id === c.id ? 'page' : undefined">
              <span>{{ c.name }}</span><span class="text-small text-muted tabular-nums">{{ c.count }}</span>
            </NuxtLink>
            <ul v-if="categories.some(s => s.parent_id === c.id)" class="ms-3 flex flex-col">
              <li v-for="s in categories.filter(s => s.parent_id === c.id)" :key="s.id">
                <NuxtLink :to="shopPath(s.slug)" class="flex justify-between rounded-sm px-2 py-1 text-small hover:bg-elevated" :class="props.category?.id === s.id && 'font-medium text-highlighted'" :aria-current="props.category?.id === s.id ? 'page' : undefined">
                  <span>{{ s.name }}</span><span class="text-muted tabular-nums">{{ s.count }}</span>
                </NuxtLink>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
      <UFormField :label="t('shop.filters.type')" name="type">
        <USelect :model-value="(route.query.type as string) || 'all'" :items="typeItems" class="w-full" @update:model-value="v => update({ type: v === 'all' ? undefined : v })" />
      </UFormField>
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-small font-medium text-highlighted">{{ t('shop.filters.price') }}</legend>
        <div class="flex gap-2">
          <UInput v-model="priceMin" type="number" min="0" inputmode="numeric" :aria-label="t('shop.filters.priceMin')" :placeholder="t('shop.filters.priceMin')" />
          <UInput v-model="priceMax" type="number" min="0" inputmode="numeric" :aria-label="t('shop.filters.priceMax')" :placeholder="t('shop.filters.priceMax')" />
        </div>
      </fieldset>
      <USwitch :model-value="route.query.in_stock === '1'" :label="t('shop.filters.inStock')" @update:model-value="v => update({ in_stock: v ? '1' : undefined })" />
      <UButton v-if="Object.keys(route.query).length" :label="t('shop.filters.clear')" color="neutral" variant="link" class="self-start px-0" @click="router.replace({ query: {} })" />
    </aside>

    <section class="flex flex-col gap-6" :aria-busy="pending">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-small text-muted" aria-live="polite">{{ t('shop.results', { n: data?.total ?? 0 }, data?.total ?? 0) }}</p>
        <USelect :model-value="sortValue" :items="sortItems" :aria-label="t('shop.filters.sort')" class="w-56" @update:model-value="v => update({ sort: v === 'default' || (!props.category && v === 'featured') ? undefined : v })" />
      </div>
      <MzEmptyState v-if="!pending && !cards.length" icon="i-lucide-search-x" :title="t('shop.empty')" description="" />
      <ul v-else class="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
        <li v-for="(p, i) in cards" :key="p.id">
          <MzShopCard :product="p" :can-buy="canBuy" :priority="i < 4" />
        </li>
      </ul>
      <div v-if="nextPage" class="flex justify-center">
        <UButton :to="{ query: { ...route.query, page: nextPage } }" :label="t('shop.loadMore')" color="neutral" variant="outline" size="lg" :loading="loadingMore" @click.prevent="loadMore" />
      </div>
    </section>
  </div>
</template>
