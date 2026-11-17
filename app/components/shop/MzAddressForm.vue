<script setup lang="ts">
import type { Address } from '~/utils/shop-types'

/**
 * Delivery address adapted to the country (Morocco: 5-digit postal code, region optional).
 * Errors come from the parent (`errors[field]`), linked to their input with aria-describedby.
 */
const props = withDefaults(defineProps<{ countries: string[], errors?: Record<string, string> }>(), { errors: () => ({}) })
const model = defineModel<Address>({ required: true })
const { t, locale } = useI18n()
const regionNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'region' }))
const countryItems = computed(() => props.countries.map(c => ({ value: c, label: regionNames.value.of(c) ?? c })))
const isMorocco = computed(() => model.value.country_code === 'MA')

const fields = computed(() => [
  { name: 'first_name', label: t('shop.checkout.firstName'), autocomplete: 'given-name', half: true, required: true },
  { name: 'last_name', label: t('shop.checkout.lastName'), autocomplete: 'family-name', half: true, required: true },
  { name: 'line1', label: t('shop.checkout.address.line1'), autocomplete: 'address-line1', required: true },
  { name: 'line2', label: t('shop.checkout.address.line2'), autocomplete: 'address-line2' },
  { name: 'postal_code', label: t('shop.checkout.address.postal_code'), autocomplete: 'postal-code', half: true, inputmode: isMorocco.value ? 'numeric' : undefined },
  { name: 'city', label: t('shop.checkout.address.city'), autocomplete: 'address-level2', half: true, required: true },
  { name: 'region', label: t('shop.checkout.address.region'), autocomplete: 'address-level1' },
  { name: 'phone', label: t('shop.checkout.phone'), autocomplete: 'tel', type: 'tel', required: true },
  { name: 'delivery_notes', label: t('shop.checkout.address.notes') },
] as { name: keyof Address, label: string, autocomplete?: string, half?: boolean, required?: boolean, type?: string, inputmode?: string }[])
</script>

<template>
  <div class="grid grid-cols-2 gap-4" data-testid="address-form">
    <UFormField class="col-span-2" :label="t('shop.checkout.address.country')" name="country_code" :error="props.errors.country_code" required>
      <USelect v-model="model.country_code" :items="countryItems" class="w-full" autocomplete="country" :aria-invalid="!!props.errors.country_code" />
    </UFormField>
    <UFormField
      v-for="f in fields"
      :key="f.name"
      :class="f.half ? 'col-span-2 sm:col-span-1' : 'col-span-2'"
      :label="f.label"
      :name="f.name"
      :error="props.errors[f.name]"
      :required="f.required"
    >
      <UInput
        v-model="(model[f.name] as string)"
        class="w-full"
        :type="f.type ?? 'text'"
        :autocomplete="f.autocomplete"
        :inputmode="(f.inputmode as 'numeric' | undefined)"
        :aria-invalid="!!props.errors[f.name]"
        :dir="f.name === 'phone' ? 'ltr' : undefined"
      />
    </UFormField>
  </div>
</template>
