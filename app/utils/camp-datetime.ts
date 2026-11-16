import { fromDate, parseDateTime, toCalendarDateTime, toZoned } from '@internationalized/date'

/** The camp's time zone: every schedule is entered and shown in it, whatever the browser's zone. */
export const CAMP_TZ = 'Africa/Casablanca'

/** ISO instant → "YYYY-MM-DDTHH:mm" in camp time (for <input type="datetime-local">). */
export function toCampLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return toCalendarDateTime(fromDate(new Date(iso), CAMP_TZ)).toString().slice(0, 16)
}

/** "YYYY-MM-DDTHH:mm" in camp time → ISO instant (null when empty or invalid). */
export function fromCampLocal(local: string | null | undefined): string | null {
  if (!local) return null
  try {
    return toZoned(parseDateTime(local), CAMP_TZ).toAbsoluteString()
  }
  catch {
    return null
  }
}
