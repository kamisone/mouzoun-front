import { describe, expect, it } from 'vitest'
import { applyItems, canPlace, dropPlacement, flatten, keyPlacement, place } from '../../app/utils/category-tree'
import { slugify, uniqueSlug } from '../../app/utils/slug'

/**
 * Dattes (Medjool, Boufeggous), Huile, Épicerie (Ras el hanout › Mélanges). Moves made with the
 * mouse and with the keyboard must produce the same payload for the API.
 */
const rows = [
  { id: 'dates', parent_id: null, sort_order: 0 },
  { id: 'medjool', parent_id: 'dates', sort_order: 0 },
  { id: 'boufeggous', parent_id: 'dates', sort_order: 1 },
  { id: 'oil', parent_id: null, sort_order: 1 },
  { id: 'pantry', parent_id: null, sort_order: 2 },
  { id: 'ras', parent_id: 'pantry', sort_order: 0 },
  { id: 'blends', parent_id: 'ras', sort_order: 0 },
]

describe('category tree', () => {
  it('lists depth-first with depths, hiding collapsed branches', () => {
    expect(flatten(rows).map(n => `${n.row.id}:${n.depth}`)).toEqual(['dates:1', 'medjool:2', 'boufeggous:2', 'oil:1', 'pantry:1', 'ras:2', 'blends:3'])
    expect(flatten(rows, new Set(['pantry'])).map(n => n.row.id)).toEqual(['dates', 'medjool', 'boufeggous', 'oil', 'pantry'])
  })

  it('gives the same payload for a drop and for the equivalent keyboard moves', () => {
    // Oil dropped onto Dates (nested as its last child)...
    const byDrop = place(rows, 'oil', dropPlacement(rows, 'oil', 'dates', 'inside')!)
    // ...or "indent" on Oil (its previous sibling is Dates).
    const byKey = place(rows, 'oil', keyPlacement(rows, 'oil', 'indent')!)
    expect(byDrop).toEqual(byKey)
    expect(byDrop).toEqual([
      { id: 'oil', parent_id: 'dates', sort_order: 2 },
      { id: 'pantry', parent_id: null, sort_order: 1 },
    ])
    // Boufeggous dropped above Medjool = Boufeggous "up".
    expect(place(rows, 'boufeggous', dropPlacement(rows, 'boufeggous', 'medjool', 'before')!))
      .toEqual(place(rows, 'boufeggous', keyPlacement(rows, 'boufeggous', 'up')!))
    // Medjool dropped after Dates = Medjool "outdent".
    expect(place(rows, 'medjool', dropPlacement(rows, 'medjool', 'dates', 'after')!))
      .toEqual(place(rows, 'medjool', keyPlacement(rows, 'medjool', 'outdent')!))
  })

  it('renumbers only what changed and applies a payload', () => {
    const items = place(rows, 'pantry', { parentId: null, index: 0 })
    expect(items).toEqual([
      { id: 'pantry', parent_id: null, sort_order: 0 },
      { id: 'dates', parent_id: null, sort_order: 1 },
      { id: 'oil', parent_id: null, sort_order: 2 },
    ])
    expect(flatten(applyItems(rows, items)).filter(n => n.depth === 1).map(n => n.row.id)).toEqual(['pantry', 'dates', 'oil'])
  })

  it('refuses cycles and depth beyond the limit', () => {
    expect(canPlace(rows, 'pantry', 'blends', 3)).toBe('cycle')
    expect(canPlace(rows, 'dates', 'dates', 3)).toBe('cycle')
    // Pantry has two levels below it: under Dates it would reach depth 4.
    expect(canPlace(rows, 'pantry', 'dates', 3)).toBe('too_deep')
    expect(canPlace(rows, 'oil', 'medjool', 3)).toBeNull()
    expect(canPlace(rows, 'oil', 'blends', 3)).toBe('too_deep')
  })

  it('has no keyboard move where there is nothing to move to', () => {
    expect(keyPlacement(rows, 'dates', 'up')).toBeNull()
    expect(keyPlacement(rows, 'dates', 'outdent')).toBeNull()
    expect(keyPlacement(rows, 'medjool', 'indent')).toBeNull()
    expect(keyPlacement(rows, 'pantry', 'down')).toBeNull()
  })
})

describe('slugs', () => {
  it('follows the API rule: accents removed, separators to one hyphen, Arabic kept', () => {
    expect(slugify('  Huile d\'olive & olives ')).toBe('huile-d-olive-olives')
    expect(slugify('Épices & épicerie')).toBe('epices-epicerie')
    expect(slugify('Coffrets   cadeaux!!')).toBe('coffrets-cadeaux')
    expect(slugify('التمور الطازجة')).toBe('التمور-الطازجة')
    expect(slugify('Dattes 2026')).toBe('dattes-2026')
  })

  it('adds -2, -3 to taken slugs', () => {
    expect(uniqueSlug('miel', [])).toBe('miel')
    expect(uniqueSlug('miel', ['miel'])).toBe('miel-2')
    expect(uniqueSlug('miel', ['miel', 'miel-2'])).toBe('miel-3')
  })
})
