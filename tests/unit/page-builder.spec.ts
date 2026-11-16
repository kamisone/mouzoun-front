import { describe, expect, it } from 'vitest'
import { fromCampLocal, toCampLocal } from '../../app/utils/camp-datetime'
import { blockFromPreset, blurhashColor, cloneBlock, interpolate, resolveNode, uuidv7 } from '../../app/utils/page-builder'
import type { SectionType } from '../../app/utils/page-types'

describe('page builder helpers', () => {
  it('generates time-ordered UUIDv7', () => {
    const a = uuidv7(1_800_000_000_000)
    const b = uuidv7(1_800_000_000_001)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a < b).toBe(true)
  })

  it('fills {opening_date} in the page language, drops it when unset', () => {
    expect(interpolate('Ouverture le {opening_date}', { opening_date: '2027-03-20' }, 'fr')).toBe('Ouverture le 20 mars 2027')
    expect(interpolate('Opening on {opening_date}', { opening_date: '2027-03-20' }, 'en')).toBe('Opening on March 20, 2027')
    expect(interpolate('Ouverture le {opening_date}', { opening_date: '' }, 'fr')).toBe('Ouverture le')
    expect(interpolate('{unknown} stays', {}, 'fr')).toBe('{unknown} stays')
  })

  it('reads the average colour of a blurhash', () => {
    expect(blurhashColor('LEHV6nWB2yk8pyo0adR*.7kCMdnj')).toMatch(/^rgb\(\d+ \d+ \d+\)$/)
    expect(blurhashColor(null)).toBeUndefined()
  })

  // Asserted against Intl in Africa/Casablanca rather than a fixed offset: Morocco's offset
  // changed in 2026 (tzdata 2026c) and the runtime's tz data may lag behind.
  const campClock = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Casablanca', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)).replace(' ', 'T')

  it('converts schedules from and to camp time', () => {
    const iso = fromCampLocal('2027-07-01T08:00')!
    expect(campClock(iso)).toBe('2027-07-01T08:00')
    expect(toCampLocal(iso)).toBe('2027-07-01T08:00')
    expect(toCampLocal('2027-01-10T12:00:00Z')).toBe(campClock('2027-01-10T12:00:00Z'))
    expect(fromCampLocal('')).toBeNull()
  })

  it('resolves $ref with the node keywords on top', () => {
    const root = { $defs: { media_id: { 'type': 'string', 'x-widget': 'media' } } }
    expect(resolveNode(root, { '$ref': '#/$defs/media_id', 'title': 'Image' })).toEqual({ 'type': 'string', 'x-widget': 'media', 'title': 'Image' })
  })

  it('builds a section from a preset and duplicates with fresh ids', () => {
    const type = {
      code: 'stats',
      settings_schema: { type: 'object', properties: { columns: { type: 'integer', default: 4 }, animate: { type: 'boolean', default: true } } },
      preset: { settings: { columns: 3 }, content: { fr: { title: 'Chiffres' } }, items: [{ settings: { number: 45 }, content: { fr: { label: 'km' } } }] },
    } as unknown as SectionType
    const block = blockFromPreset(type)
    expect(block.settings).toEqual({ columns: 3, animate: true })
    expect(block.items[0]!.settings).toEqual({ number: 45 })
    const copy = cloneBlock({ ...block, anchor_id: 'stats' })
    expect(copy.id).not.toBe(block.id)
    expect(copy.items[0]!.id).not.toBe(block.items[0]!.id)
    expect(copy.anchor_id).toBeNull()
  })
})
