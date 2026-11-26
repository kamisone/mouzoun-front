import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import MzPriceRulesGrid from '~/components/admin/catalog/MzPriceRulesGrid.vue'
import MzWeekdayChips from '~/components/admin/catalog/MzWeekdayChips.vue'
import type { PriceRule, References } from '~/utils/catalog-admin-api'
import { EVERY_DAY, hasDay, toggleDay } from '~/utils/catalog'

/** Price rules grid: weekdays as the Mon=1 … Sun=64 bitmask, euros typed → integer cents. */
mockNuxtImport('useAdminApi', () => () => ({ catalog: { references: vi.fn() }, lookup: vi.fn(async () => ({ options: [] })) }))

const refs: References = {
  seasons: [{ id: 's-high', code: 'high', color: null, priority: 10, names: { fr: 'Haute saison' } }],
  rate_plans: [{ id: 'p-flex', code: 'flex', is_public: true, is_active: true, names: { fr: 'Flexible' }, cancellation_policy_id: null, deposit_type: 'none', payment_mode: 'pay_on_site' }],
  guest_categories: [{ id: 'g-adult', code: 'adult', min_age: 18, max_age: null, is_active: true, counts_toward_capacity: true, names: { fr: 'Adulte' } }],
  cancellation_policies: [],
  taxes: [],
  locales: ['fr', 'en', 'ar'],
  defaults: { check_in_from: '14:00' },
}
const rule = (patch: Partial<PriceRule> = {}): PriceRule => ({
  id: 'r1', rate_plan_id: null, season_id: null, guest_category_id: null, pricing_unit: 'per_unit_per_night', amount_minor: 4500,
  extra_guest_amount_minor: null, min_quantity: 1, max_quantity: null, min_nights: null, days_of_week: 127, valid_from: null, valid_to: null,
  priority: 0, is_active: true, ambiguous_with: [], ...patch,
})

async function grid(rows: PriceRule[]) {
  const updates: PriceRule[][] = []
  const wrapper = await mountSuspended(MzPriceRulesGrid, {
    props: {
      kind: 'stays', allowedUnits: ['per_unit_per_night', 'per_person_per_night'], refs, modelValue: rows,
      'onUpdate:modelValue': async (v: PriceRule[]) => {
        updates.push(v)
        await wrapper.setProps({ modelValue: v })
      },
    },
  })
  return { wrapper, updates }
}

describe('weekday bitmask', () => {
  it('maps Monday to 1 and Sunday to 64, and never empties the mask', () => {
    expect(hasDay(1, 0)).toBe(true)
    expect(hasDay(64, 6)).toBe(true)
    expect(toggleDay(EVERY_DAY, 6)).toBe(63)
    expect(toggleDay(16 | 32, 4)).toBe(32)
    expect(toggleDay(32, 5)).toBe(32)
  })

  it('toggles chips into the bitmask', async () => {
    const updates: number[] = []
    const wrapper = await mountSuspended(MzWeekdayChips, {
      props: { 'modelValue': 127, 'onUpdate:modelValue': async (v: number) => { updates.push(v); await wrapper.setProps({ modelValue: v }) } },
    })
    await wrapper.find('[data-testid="weekday-6"]').trigger('click')
    await wrapper.find('[data-testid="weekday-0"]').trigger('click')
    expect(updates).toEqual([63, 62])
    expect(wrapper.find('[data-testid="weekday-6"]').attributes('aria-pressed')).toBe('false')
  })
})

describe('MzPriceRulesGrid', () => {
  it('shows cents as euros and stores what is typed as integer cents', async () => {
    const { wrapper, updates } = await grid([rule()])
    const amount = wrapper.find('[data-testid="amount-0"] input, input[data-testid="amount-0"]')
    expect((amount.element as HTMLInputElement).value).toBe('45,00')
    await amount.setValue('45,90')
    expect(updates.at(-1)![0]!.amount_minor).toBe(4590)
    await amount.setValue('0.1')
    expect(updates.at(-1)![0]!.amount_minor).toBe(10)
  })

  it('writes the weekday chips of a row into its bitmask', async () => {
    const { wrapper, updates } = await grid([rule()])
    await wrapper.find('[data-testid="price-row-0"] [data-testid="weekday-5"]').trigger('click')
    expect(updates.at(-1)![0]!.days_of_week).toBe(127 - 32)
  })

  it('flags the ambiguous rows the API reported', async () => {
    const { wrapper } = await grid([rule({ id: 'a', ambiguous_with: ['b'] }), rule({ id: 'b', ambiguous_with: ['a'] }), rule({ id: 'c', days_of_week: 96 })])
    expect(wrapper.findAll('[role="status"]').length).toBe(2)
    expect(wrapper.find('[data-testid="price-row-2"] [role="status"]').exists()).toBe(false)
  })

  it('adds a row with an allowed unit and duplicates one without its id', async () => {
    const { wrapper, updates } = await grid([rule()])
    await wrapper.find('[data-testid="add-price"]').trigger('click')
    expect(updates.at(-1)![1]).toMatchObject({ pricing_unit: 'per_unit_per_night', amount_minor: 0, days_of_week: 127 })
    await wrapper.find('[aria-label*="upliquer"], [aria-label*="uplicate"]').trigger('click')
    expect(updates.at(-1)![1]!.id).toBeUndefined()
    expect(updates.at(-1)![1]!.amount_minor).toBe(4500)
  })
})
