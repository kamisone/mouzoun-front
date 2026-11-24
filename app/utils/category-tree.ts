/**
 * Shop category tree, client side: build the tree from the flat admin list, and turn a move
 * (drag-and-drop or keyboard: up, down, indent, outdent) into the payload of
 * `PUT /admin/shop/categories/tree`. Both ways go through `place()`, so they send the same thing.
 * The API checks the same rules again (no cycle, at most `max_depth` levels).
 */

export interface CategoryRow {
  id: string
  parent_id: string | null
  sort_order: number
}

export interface TreeItem { id: string, parent_id: string | null, sort_order: number }
export interface Placement { parentId: string | null, index: number }
export type DropPosition = 'before' | 'after' | 'inside'
export type MoveKey = 'up' | 'down' | 'indent' | 'outdent'
export type Refusal = 'cycle' | 'too_deep'

export interface FlatNode<T> { row: T, depth: number, hasChildren: boolean }

/** Siblings under `parentId`, in order. */
export function childrenOf<T extends CategoryRow>(rows: T[], parentId: string | null): T[] {
  return rows
    .filter(r => r.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
}

/** Depth-first order with depth (1 = root). `collapsed` ids hide their subtrees. */
export function flatten<T extends CategoryRow>(rows: T[], collapsed: Set<string> = new Set()): FlatNode<T>[] {
  const out: FlatNode<T>[] = []
  const walk = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const row of childrenOf(rows, parentId)) {
      if (seen.has(row.id)) continue
      const kids = childrenOf(rows, row.id)
      out.push({ row, depth, hasChildren: kids.length > 0 })
      if (!collapsed.has(row.id)) walk(row.id, depth + 1, new Set([...seen, row.id]))
    }
  }
  walk(null, 1, new Set())
  return out
}

export function descendants(rows: CategoryRow[], id: string): Set<string> {
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const r of rows) {
      if (r.parent_id === cur && !out.has(r.id)) {
        out.add(r.id)
        stack.push(r.id)
      }
    }
  }
  return out
}

/** 1 for a root category. */
export function depthOf(rows: CategoryRow[], id: string | null): number {
  let depth = 0
  let cur = id
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    depth++
    cur = rows.find(r => r.id === cur)?.parent_id ?? null
  }
  return depth
}

/** Levels below `id` (0 for a leaf). */
export function heightOf(rows: CategoryRow[], id: string): number {
  const kids = rows.filter(r => r.parent_id === id)
  return kids.length ? 1 + Math.max(...kids.map(k => heightOf(rows, k.id))) : 0
}

/** Can `id` (with its subtree) go under `parentId`? */
export function canPlace(rows: CategoryRow[], id: string, parentId: string | null, maxDepth: number): Refusal | null {
  if (parentId === id || (parentId && descendants(rows, id).has(parentId))) return 'cycle'
  if (depthOf(rows, parentId) + 1 + heightOf(rows, id) > maxDepth) return 'too_deep'
  return null
}

/**
 * Moves `id` to `index` among the children of `parentId` (index counted without the moved row)
 * and returns the rows whose parent or order changed, numbered 0..n in each affected list.
 */
export function place(rows: CategoryRow[], id: string, target: Placement): TreeItem[] {
  const moved = rows.find(r => r.id === id)
  if (!moved) return []
  const oldParent = moved.parent_id
  const newSiblings = childrenOf(rows, target.parentId).filter(r => r.id !== id)
  const index = Math.max(0, Math.min(target.index, newSiblings.length))
  newSiblings.splice(index, 0, moved)
  const next = new Map<string, TreeItem>()
  newSiblings.forEach((r, i) => next.set(r.id, { id: r.id, parent_id: target.parentId, sort_order: i }))
  if (oldParent !== target.parentId) {
    childrenOf(rows, oldParent).filter(r => r.id !== id).forEach((r, i) => next.set(r.id, { id: r.id, parent_id: oldParent, sort_order: i }))
  }
  return [...next.values()].filter((item) => {
    const before = rows.find(r => r.id === item.id)!
    return before.parent_id !== item.parent_id || before.sort_order !== item.sort_order
  })
}

/** Applies a payload to the rows (optimistic update). */
export function applyItems<T extends CategoryRow>(rows: T[], items: TreeItem[]): T[] {
  const byId = new Map(items.map(i => [i.id, i]))
  return rows.map((r) => {
    const i = byId.get(r.id)
    return i ? { ...r, parent_id: i.parent_id, sort_order: i.sort_order } : r
  })
}

/** Where a drop lands: before/after a row (same parent) or inside it (last child). */
export function dropPlacement(rows: CategoryRow[], id: string, overId: string, position: DropPosition): Placement | null {
  if (id === overId) return null
  const over = rows.find(r => r.id === overId)
  if (!over) return null
  if (position === 'inside') return { parentId: over.id, index: childrenOf(rows, over.id).filter(r => r.id !== id).length }
  const siblings = childrenOf(rows, over.parent_id).filter(r => r.id !== id)
  const at = siblings.findIndex(r => r.id === overId)
  return { parentId: over.parent_id, index: position === 'before' ? at : at + 1 }
}

/** Keyboard and menu moves. `null` when the move is not possible (first row, no parent...). */
export function keyPlacement(rows: CategoryRow[], id: string, key: MoveKey): Placement | null {
  const row = rows.find(r => r.id === id)
  if (!row) return null
  const siblings = childrenOf(rows, row.parent_id)
  const at = siblings.findIndex(r => r.id === id)
  switch (key) {
    case 'up':
      return at > 0 ? { parentId: row.parent_id, index: at - 1 } : null
    case 'down':
      return at < siblings.length - 1 ? { parentId: row.parent_id, index: at + 1 } : null
    case 'indent': {
      const previous = siblings[at - 1]
      return previous ? { parentId: previous.id, index: childrenOf(rows, previous.id).length } : null
    }
    case 'outdent': {
      if (!row.parent_id) return null
      const parent = rows.find(r => r.id === row.parent_id)
      if (!parent) return null
      const parentAt = childrenOf(rows, parent.parent_id).findIndex(r => r.id === parent.id)
      return { parentId: parent.parent_id, index: parentAt + 1 }
    }
  }
}
