/**
 * Address slugs, the same rule as the API (`slugify` in back/src/modules/shop/admin/catalog.rs):
 * lowercase, French accents removed, anything that is not a letter or a digit becomes one hyphen,
 * Arabic letters kept as they are.
 */
const ACCENTS: Record<string, string> = {
  à: 'a', â: 'a', ä: 'a', á: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  î: 'i', ï: 'i', í: 'i',
  ô: 'o', ö: 'o', ó: 'o',
  ù: 'u', û: 'u', ü: 'u', ú: 'u',
  ç: 'c',
}

export function slugify(input: string): string {
  let out = ''
  let dash = false
  for (const raw of input.trim().toLowerCase()) {
    const c = ACCENTS[raw] ?? raw
    if (/[\p{Alphabetic}\p{N}]/u.test(c)) {
      out += c
      dash = false
    }
    else if (!dash && out) {
      out += '-'
      dash = true
    }
  }
  return out.replace(/-+$/, '')
}

/** `base`, or `base-2`, `base-3`... the first one not in `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!base || !used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
