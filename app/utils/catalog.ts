/**
 * Pure helpers of the catalogue editors (stays, activities, packages, extras): weekday bitmasks,
 * calendar range selection, package content rules and error paths. The API checks everything
 * again; these only give immediate feedback.
 */
import type { CatalogKind, CatalogLocale, PackageItem } from '~/utils/catalog-admin-api'

/** Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64 (the database bitmask). */
export const WEEKDAY_BITS = [1, 2, 4, 8, 16, 32, 64] as const
export const EVERY_DAY = 127

export function hasDay(mask: number, index: number): boolean {
  return (mask & WEEKDAY_BITS[index]!) !== 0
}

/** Toggles one weekday; never leaves an empty mask (the database refuses 0). */
export function toggleDay(mask: number, index: number): number {
  const next = mask ^ WEEKDAY_BITS[index]!
  return next === 0 ? mask : next
}

/** Weekday index (Mon=0) of an ISO date. */
export function weekdayIndex(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`)
  return (d.getUTCDay() + 6) % 7
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Two clicks on the calendar (in any order) → `{from, to}` with `to` exclusive (the API's
 * ranges): clicking 10 then 7 selects the nights of the 7th to the 10th included.
 */
export function rangeFromClicks(a: string, b: string): { from: string, to: string } {
  const [first, last] = a <= b ? [a, b] : [b, a]
  return { from: first, to: addDays(last, 1) }
}

/** Nights of `[from, to)` whose weekday is in `mask`. */
export function nightsIn(from: string, to: string, mask = EVERY_DAY): string[] {
  const out: string[] = []
  for (let d = from; d < to; d = addDays(d, 1)) if (hasDay(mask, weekdayIndex(d))) out.push(d)
  return out
}

/** The 42 cells (6 weeks, Monday first) of a month grid; `null` outside the month. */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const lead = weekdayIndex(first)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: 42 }, (_, i) => {
    const day = i - lead + 1
    return day >= 1 && day <= days ? addDays(first, day - 1) : null
  })
}

export const PRODUCT_KIND: Record<CatalogKind, string> = {
  stays: 'accommodation',
  activities: 'activity',
  packages: 'package',
  extras: 'extra',
}

export const PUBLIC_SEGMENT: Partial<Record<CatalogKind, string>> = { stays: 'stays', activities: 'activities', packages: 'packages' }

/** Item kinds a package may contain. */
export const PACKAGE_ITEM_KINDS = ['accommodation', 'activity', 'extra']

/**
 * The package content rules (same as the API): no package or shop product inside, at most one
 * stay whose nights equal the package nights, days within the duration. Returns
 * `{"items[1].quantity": "nights_mismatch", ...}`.
 */
export function packageItemErrors(items: PackageItem[], durationDays: number | null, durationNights: number | null): Record<string, string> {
  const errors: Record<string, string> = {}
  let stays = 0
  items.forEach((it, i) => {
    if (it.kind === 'package') errors[`items[${i}].item_product_id`] = 'package_in_package'
    else if (it.kind && !PACKAGE_ITEM_KINDS.includes(it.kind)) errors[`items[${i}].item_product_id`] = 'not_bookable_kind'
    if (it.kind === 'accommodation') {
      stays++
      if (stays > 1) errors[`items[${i}].item_product_id`] = 'one_stay_only'
      else if (!durationNights) errors['details.duration_nights'] = 'required_with_stay'
      else if (it.quantity !== durationNights) errors[`items[${i}].quantity`] = 'nights_mismatch'
    }
    if (it.quantity < 1) errors[`items[${i}].quantity`] = 'min'
    if (it.day_number != null && (it.day_number < 1 || (durationDays != null && it.day_number > durationDays))) {
      errors[`items[${i}].day_number`] = 'range'
    }
  })
  return errors
}

/** `"translations.ar.slug"` → the locale whose tab must show the error. */
export function localeOfPath(path: string): CatalogLocale | null {
  const m = path.match(/^translations\.(fr|en|ar)\./)
  return (m?.[1] as CatalogLocale | undefined) ?? null
}

/** Google preview text: cut at `max` characters on a word boundary, with an ellipsis. */
export function clip(text: string, max: number): string {
  const s = text.trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Duration in minutes → "1 h 30". */
export function duration(minutes: number | null | undefined): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`
}
