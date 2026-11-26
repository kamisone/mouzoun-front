import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MzStayCalendar from '~/components/admin/catalog/MzStayCalendar.vue'
import MzSchedulesPanel from '~/components/admin/catalog/MzSchedulesPanel.vue'
import MzPackageItems from '~/components/admin/catalog/MzPackageItems.vue'
import { addDays, monthCells, nightsIn, packageItemErrors, rangeFromClicks } from '~/utils/catalog'
import type { PackageItem } from '~/utils/catalog-admin-api'

/** Calendar range selection, schedule preview and the package content rules. */
const api = vi.hoisted(() => ({
  calendar: vi.fn(async (_id: string, from: string) => ({
    inventory_mode: 'pool',
    nights: Array.from({ length: 28 }, (_, i) => ({ day: `${from.slice(0, 8)}${String(i + 1).padStart(2, '0')}`, capacity: 20, reserved: i === 2 ? 5 : 0, available: i === 2 ? 15 : 20, stop_sell: false, min_nights_override: null, closed_to_arrival: false, closed_to_departure: false, season_id: null, closed: false })),
    seasons: [],
  })),
  patchCalendar: vi.fn(async () => ({ nights: 3 })),
  closures: vi.fn(async () => ({ data: [] })),
  schedules: vi.fn(async () => ({ data: [] })),
  previewSchedules: vi.fn(async () => ({ data: [{ starts_at: '2027-01-02T09:00:00Z', local: '2027-01-02 09:00', capacity: 8 }, { starts_at: '2027-01-02T16:00:00Z', local: '2027-01-02 16:00', capacity: 8 }] })),
}))
mockNuxtImport('useAdminApi', () => () => ({ catalog: api, lookup: vi.fn(async () => ({ options: [] })) }))
afterEach(() => vi.clearAllMocks())

describe('calendar range selection', () => {
  it('turns two clicks in any order into a half-open range of nights', () => {
    expect(rangeFromClicks('2027-03-10', '2027-03-07')).toEqual({ from: '2027-03-07', to: '2027-03-11' })
    expect(rangeFromClicks('2027-03-07', '2027-03-07')).toEqual({ from: '2027-03-07', to: '2027-03-08' })
    expect(nightsIn('2027-03-01', '2027-03-15', 32 | 64)).toEqual(['2027-03-06', '2027-03-07', '2027-03-13', '2027-03-14'])
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01')
  })

  it('lays a month out from Monday', () => {
    const cells = monthCells(2027, 3)
    expect(cells[0]).toBe('2027-03-01') // a Monday
    expect(cells.filter(Boolean)).toHaveLength(31)
  })

  it('selects a range on the grid and sends it with the chosen weekdays', async () => {
    const wrapper = await mountSuspended(MzStayCalendar, { props: { productId: 'p1', canWrite: true, inventoryMode: 'pool' } })
    await flushPromises()
    const month = String(api.calendar.mock.calls[0]![1]).slice(0, 8)
    await wrapper.find(`[data-testid="night-${month}05"]`).trigger('click')
    await wrapper.find(`[data-testid="night-${month}03"]`).trigger('click')
    expect(wrapper.find(`[data-testid="night-${month}04"]`).attributes('aria-pressed')).toBe('true')
    expect(wrapper.find(`[data-testid="night-${month}06"]`).attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="calendar-range"]').text()).toMatch(/3/)
    await wrapper.find('[data-testid="apply-calendar"]').trigger('click')
    await flushPromises()
    expect(api.patchCalendar).toHaveBeenCalledWith('p1', expect.objectContaining({ from: `${month}03`, to: `${month}06`, days_of_week: 127 }))
  })

  it('reads only without inventory.write', async () => {
    const wrapper = await mountSuspended(MzStayCalendar, { props: { productId: 'p1', canWrite: false, inventoryMode: 'pool' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="apply-calendar"]').exists()).toBe(false)
  })
})

describe('schedule preview', () => {
  it('previews the next departures of the schedules being edited', async () => {
    const wrapper = await mountSuspended(MzSchedulesPanel, { props: { productId: 'a1', canWrite: true } })
    await wrapper.find('[data-testid="add-schedule"]').trigger('click')
    await new Promise(r => setTimeout(r, 500))
    await flushPromises()
    expect(api.previewSchedules).toHaveBeenCalledWith('a1', [expect.objectContaining({ days_of_week: 127, start_time: '09:00' })])
    expect(wrapper.find('[data-testid="schedule-preview"]').text()).toContain('2027-01-02 16:00')
  })
})

describe('package content rules', () => {
  const stay = (patch: Partial<PackageItem> = {}): PackageItem => ({ item_product_id: 's1', quantity: 2, day_number: 1, is_optional: false, kind: 'accommodation', ...patch })
  it('refuses a package inside a package, two stays, wrong nights and days outside the duration', () => {
    expect(packageItemErrors([{ ...stay(), kind: 'package' }], 3, 2)).toEqual({ 'items[0].item_product_id': 'package_in_package' })
    expect(packageItemErrors([stay(), stay({ item_product_id: 's2' })], 3, 2)['items[1].item_product_id']).toBe('one_stay_only')
    expect(packageItemErrors([stay({ quantity: 3 })], 3, 2)['items[0].quantity']).toBe('nights_mismatch')
    expect(packageItemErrors([stay({ kind: 'activity', day_number: 4 })], 3, 2)['items[0].day_number']).toBe('range')
    expect(packageItemErrors([stay()], 3, null)['details.duration_nights']).toBe('required_with_stay')
    expect(packageItemErrors([stay(), stay({ kind: 'activity', day_number: 2, quantity: 1 })], 3, 2)).toEqual({})
  })

  it('shows the rule next to the item as it is edited', async () => {
    const wrapper = await mountSuspended(MzPackageItems, {
      props: { durationDays: 3, durationNights: 2, known: {}, modelValue: [stay({ quantity: 3 }), stay({ item_product_id: 's2' })] },
    })
    expect(wrapper.find('[data-testid="item-0"]').text()).toMatch(/nuits|nights/i)
    expect(wrapper.find('[data-testid="item-1"] [role="alert"]').text()).toMatch(/seul hébergement|One stay/)
  })
})
