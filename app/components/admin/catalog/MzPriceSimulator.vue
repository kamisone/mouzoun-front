<script setup lang="ts">
import type { TripQuote } from '~/utils/booking-types'
import type { CatalogKind, References, SimulatorInput, CatalogSlot } from '~/utils/catalog-admin-api'
import { addDays } from '~/utils/catalog'
import { apiError } from '~/utils/catalog-admin-api'

/**
 * "Simulateur de prix": dates (or a departure), guests per category, rate plan, promo code. The
 * API answers with the booking funnel's own quote (same function), so what is shown here is
 * what a guest pays: lines with the rule used, taxes, deposit and cancellation steps.
 */
const props = defineProps<{ kind: CatalogKind, productId: string, refs: References, slots?: CatalogSlot[] }>()
const { t } = useI18n()
const { money } = useMoney()
const { date, dateTime } = useDate()
const { name } = useCatalogRefs()
const api = useAdminApi()
const today = new Date().toISOString().slice(0, 10)
const form = reactive<{ date: string, departure: string, slot_id: string | undefined, rate_plan_id: string | undefined, promo_code: string, quantity: number, guests: Record<string, number> }>({
  date: addDays(today, 30), departure: addDays(today, 32), slot_id: undefined, rate_plan_id: undefined, promo_code: '', quantity: 1,
  guests: Object.fromEntries(props.refs.guest_categories.filter(g => g.is_active).map(g => [g.id, g.code === 'adult' ? 2 : 0])),
})
const result = ref<{ quote: TripQuote, rules: Record<string, Record<string, unknown>> } | null>(null)
const error = ref('')
const loading = ref(false)
async function run() {
  loading.value = true
  error.value = ''
  try {
    const body: SimulatorInput = {
      date: form.slot_id ? undefined : form.date,
      departure: props.kind === 'stays' ? form.departure : undefined,
      slot_id: form.slot_id,
      guests: form.guests,
      quantity: form.quantity,
      rate_plan_id: form.rate_plan_id ?? null,
      promo_code: form.promo_code || null,
    }
    result.value = await api.catalog.quote(props.kind, props.productId, body)
  }
  catch (e) {
    result.value = null
    error.value = apiError(e).message ?? t('shop.errors.generic')
  }
  finally {
    loading.value = false
  }
}
const category = (id: string | null) => name(props.refs.guest_categories.find(g => g.id === id))
const season = (id: string | null) => (id ? name(props.refs.seasons.find(s => s.id === id)) : t('admin.catalog.prices.base'))
const deposit = computed(() => result.value?.quote.payment_options.find(p => p.option === 'deposit'))
</script>

<template>
  <section class="flex flex-col gap-4 rounded-md border border-default p-4" :aria-label="t('admin.catalog.simulator.title')" data-testid="price-simulator">
    <h3 class="font-medium">{{ t('admin.catalog.simulator.title') }}</h3>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <UFormField v-if="props.kind === 'activities' && props.slots?.length" :label="t('admin.catalog.simulator.departure')" name="sim-slot">
        <USelect v-model="form.slot_id" :items="[{ value: undefined, label: t('admin.catalog.simulator.byDate') }, ...props.slots.map(s => ({ value: s.id, label: s.local }))]" class="w-full" />
      </UFormField>
      <UFormField v-if="!form.slot_id" :label="props.kind === 'stays' ? t('admin.catalog.simulator.arrival') : t('admin.catalog.simulator.date')" name="sim-date">
        <UInput v-model="form.date" type="date" class="w-full" />
      </UFormField>
      <UFormField v-if="props.kind === 'stays'" :label="t('admin.catalog.simulator.departureDate')" name="sim-departure">
        <UInput v-model="form.departure" type="date" :min="addDays(form.date, 1)" class="w-full" />
      </UFormField>
      <UFormField :label="t('admin.catalog.simulator.quantity')" name="sim-qty">
        <UInputNumber v-model="form.quantity" :min="1" class="w-full" />
      </UFormField>
      <UFormField v-for="g in props.refs.guest_categories.filter(x => x.is_active)" :key="g.id" :label="name(g)" :name="`sim-${g.code}`">
        <UInputNumber v-model="form.guests[g.id]" :min="0" class="w-full" />
      </UFormField>
      <UFormField :label="t('admin.catalog.prices.ratePlan')" name="sim-plan">
        <USelect v-model="form.rate_plan_id" :items="[{ value: undefined, label: t('admin.catalog.simulator.defaultPlan') }, ...props.refs.rate_plans.filter(r => r.is_active).map(r => ({ value: r.id, label: name(r) }))]" class="w-full" />
      </UFormField>
      <UFormField :label="t('admin.catalog.simulator.promo')" name="sim-promo">
        <UInput v-model="form.promo_code" class="w-full" dir="ltr" />
      </UFormField>
    </div>
    <UButton :label="t('admin.catalog.simulator.run')" icon="i-lucide-calculator" :loading="loading" class="self-start" data-testid="simulate" @click="run" />
    <UAlert v-if="error" color="error" variant="soft" :title="error" />
    <div v-if="result" class="flex flex-col gap-3" data-testid="simulation">
      <div v-for="item in result.quote.items" :key="item.index" class="flex flex-col gap-1">
        <p class="font-medium">{{ item.name }}<span v-if="item.in_package" class="text-muted"> · {{ t('admin.catalog.simulator.inPackage') }}</span></p>
        <UAlert v-if="item.issue" color="warning" variant="soft" :title="item.issue.message" />
        <table v-if="item.lines.length" class="w-full text-small">
          <thead><tr class="text-muted"><th class="p-1 text-start">{{ t('admin.catalog.simulator.line') }}</th><th class="p-1 text-start">{{ t('admin.catalog.simulator.rule') }}</th><th class="p-1 text-end">{{ t('admin.catalog.simulator.amount') }}</th></tr></thead>
          <tbody>
            <tr v-for="(l, i) in item.lines" :key="i" class="border-t border-default">
              <td class="p-1">{{ date(l.date) }} · {{ l.quantity }} × {{ money(l.unit_amount_minor) }}<span v-if="l.guest_category_id"> · {{ category(l.guest_category_id) }}</span><span v-if="l.kind === 'extra_guest'"> · {{ t('admin.catalog.prices.extraGuest') }}</span></td>
              <td class="p-1 text-muted">{{ t(`admin.catalog.pricingUnits.${l.unit}`) }} · {{ season(l.season_id) }}<span v-if="result.rules[l.price_id]?.priority"> · P{{ result.rules[l.price_id]!.priority }}</span></td>
              <td class="p-1 text-end tabular-nums">{{ money(l.amount_minor) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-for="tax in item.taxes" :key="tax.tax_id" class="text-small text-muted">{{ tax.code }} : {{ money(tax.amount_minor) }}{{ tax.inclusive ? ` (${t('admin.catalog.simulator.included')})` : '' }}</p>
      </div>
      <dl class="grid grid-cols-2 gap-1 text-small">
        <dt>{{ t('admin.catalog.simulator.subtotal') }}</dt><dd class="text-end tabular-nums">{{ money(result.quote.subtotal_minor) }}</dd>
        <template v-if="result.quote.discount_minor"><dt>{{ t('admin.catalog.simulator.discount') }}</dt><dd class="text-end tabular-nums">−{{ money(result.quote.discount_minor) }}</dd></template>
        <dt>{{ t('admin.catalog.simulator.taxes') }}</dt><dd class="text-end tabular-nums">{{ money(result.quote.tax_minor) }}</dd>
        <dt class="font-medium">{{ t('admin.catalog.simulator.total') }}</dt><dd class="text-end font-medium tabular-nums" data-testid="simulated-total">{{ money(result.quote.total_minor) }}</dd>
        <template v-if="deposit"><dt>{{ t('admin.catalog.simulator.deposit') }}</dt><dd class="text-end tabular-nums">{{ money(deposit.due_now_minor) }}</dd></template>
      </dl>
      <div v-if="result.quote.cancellation.length" class="text-small">
        <p class="font-medium">{{ t('admin.catalog.simulator.cancellation') }}</p>
        <ul class="text-muted">
          <li v-for="(c, i) in result.quote.cancellation" :key="i">{{ c.until ? t('admin.catalog.simulator.refundUntil', { percent: c.refund_percent, date: dateTime(c.until) }) : t('admin.catalog.simulator.refundAfter', { percent: c.refund_percent }) }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>
