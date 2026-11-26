import type { Names, References } from '~/utils/catalog-admin-api'

/** Seasons, rate plans, guest categories, policies and taxes for the catalogue editors (loaded once). */
export function useCatalogRefs() {
  const api = useAdminApi()
  const { locale } = useI18n()
  const refs = useState<References | null>('catalog-refs', () => null)
  async function load(force = false) {
    if (!refs.value || force) refs.value = await api.catalog.references()
    return refs.value
  }
  /** Name in the admin language, then French, then the code. */
  const name = (n: { names: Names, code: string } | undefined) => (n ? n.names[locale.value] || n.names.fr || n.code : '—')
  return { refs, load, name }
}
