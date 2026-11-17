<script setup lang="ts">
import type { ShopProduct } from '~/utils/shop-types'

/** Food information tabs: ingredients, allergens (highlighted), nutrition, storage, origin. */
const props = defineProps<{ product: ShopProduct }>()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const food = computed(() => props.product.food)
const months = computed(() => {
  const f = new Intl.DateTimeFormat(locale.value, { month: 'long' })
  return (props.product.crop?.harvest_months ?? []).map(m => f.format(new Date(2026, m - 1, 1))).join(', ')
})
const items = computed(() => [
  { label: t('shop.product.tabs.description'), slot: 'description' as const, show: !!props.product.description },
  { label: t('shop.product.tabs.ingredients'), slot: 'ingredients' as const, show: !!food.value.ingredients },
  { label: t('shop.product.tabs.allergens'), slot: 'allergens' as const, show: props.product.product_type === 'food' || food.value.allergens.length > 0 },
  { label: t('shop.product.tabs.nutrition'), slot: 'nutrition' as const, show: !!food.value.nutrition },
  { label: t('shop.product.tabs.storage'), slot: 'storage' as const, show: !!(food.value.storage_instructions || food.value.shelf_life_days || food.value.lot_tracked) },
  { label: t('shop.product.tabs.origin'), slot: 'origin' as const, show: !!(props.product.origin_place || props.product.crop || food.value.origin_story || food.value.producer_name) },
].filter(i => i.show))
</script>

<template>
  <UTabs v-if="items.length" :items="items" variant="link" class="w-full" data-testid="food-info">
    <template #description>
      <p class="whitespace-pre-line text-body">{{ props.product.description }}</p>
    </template>
    <template #ingredients>
      <p class="text-body">{{ food.ingredients }}</p>
    </template>
    <template #allergens>
      <p v-if="!food.allergens.length" class="text-body">{{ t('shop.product.allergensNone') }}</p>
      <p v-else class="text-body">
        {{ t('shop.product.allergensIntro') }}
        <strong v-for="(a, i) in food.allergens" :key="a" class="font-semibold text-highlighted">{{ t(`shop.product.allergenNames.${a}`) }}<template v-if="i < food.allergens.length - 1">, </template></strong>
      </p>
    </template>
    <template #nutrition>
      <table class="w-full text-body">
        <caption class="mb-2 text-start text-small text-muted">{{ t('shop.product.nutritionPer100g') }}</caption>
        <tbody>
          <tr v-for="(value, key) in food.nutrition ?? {}" :key="key" class="border-b border-default">
            <th scope="row" class="py-2 text-start font-normal text-muted">{{ key }}</th>
            <td class="py-2 text-end tabular-nums">{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </template>
    <template #storage>
      <div class="flex flex-col gap-2 text-body">
        <p v-if="food.storage_instructions">{{ food.storage_instructions }}</p>
        <p v-if="food.shelf_life_days">{{ t('shop.product.shelfLife', { days: food.shelf_life_days }) }}</p>
        <p v-if="food.lot_tracked">{{ t('shop.product.lotTracked') }}</p>
        <p v-if="food.is_perishable" class="text-warning">{{ t('shop.product.perishable') }}</p>
        <p v-else-if="food.withdrawal_exemption !== 'none'">{{ t(`shop.product.withdrawal.${food.withdrawal_exemption}`) }}</p>
      </div>
    </template>
    <template #origin>
      <div class="flex flex-col gap-2 text-body">
        <p v-if="props.product.origin_place">
          <template v-if="props.product.origin_place.slug">
            {{ t('shop.product.fromField', { place: '' }) }}<NuxtLink :to="`${localePath('/')}#farm`" class="underline">{{ props.product.origin_place.name }}</NuxtLink>
          </template>
          <template v-else>{{ t('shop.product.fromField', { place: props.product.origin_place.name }) }}</template>
        </p>
        <p v-if="props.product.crop && months">{{ props.product.crop.name }} · {{ t('shop.product.harvest', { months }) }}</p>
        <p v-if="food.producer_name">{{ t('shop.product.operator', { name: food.producer_name }) }}</p>
        <p v-if="food.origin_story" class="whitespace-pre-line">{{ food.origin_story }}</p>
        <p v-if="food.legal_notice" class="text-small text-muted">{{ food.legal_notice }}</p>
      </div>
    </template>
  </UTabs>
</template>
