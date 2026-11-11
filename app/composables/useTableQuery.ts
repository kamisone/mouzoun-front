/**
 * Server-side table state kept in the URL (`?page=2&per_page=20&sort=created_at&dir=desc&q=...`):
 * shareable, survives reloads, and the page fetches with exactly what the table shows.
 *
 * const { query, apiParams } = useTableQuery({ sort: 'created_at', dir: 'desc' })
 * const { data } = await useAsyncData(() => api.bookings.list(apiParams.value), { watch: [apiParams] })
 */
export interface TableQuery {
  page: number
  perPage: number
  sort: string | null
  dir: 'asc' | 'desc'
  q: string
}

export function useTableQuery(defaults: Partial<TableQuery> = {}) {
  const route = useRoute()
  const router = useRouter()
  const base: TableQuery = { page: 1, perPage: 20, sort: null, dir: 'asc', q: '', ...defaults }

  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined
  const query = computed<TableQuery>(() => ({
    page: Math.max(1, Number(first(route.query.page)) || base.page),
    perPage: Math.min(100, Math.max(1, Number(first(route.query.per_page)) || base.perPage)),
    sort: first(route.query.sort) ?? base.sort,
    dir: first(route.query.dir) === 'desc' ? 'desc' : first(route.query.dir) === 'asc' ? 'asc' : base.dir,
    q: first(route.query.q) ?? base.q,
  }))

  function update(patch: Partial<TableQuery>) {
    const next = { ...query.value, ...patch }
    // Any change other than the page itself goes back to page 1.
    if (!('page' in patch)) next.page = 1
    router.replace({
      query: {
        ...route.query,
        page: next.page === base.page ? undefined : String(next.page),
        per_page: next.perPage === base.perPage ? undefined : String(next.perPage),
        sort: next.sort ?? undefined,
        dir: next.sort ? next.dir : undefined,
        q: next.q || undefined,
      },
    })
  }

  /** Parameters in the API's naming. */
  const apiParams = computed(() => ({
    page: query.value.page,
    per_page: query.value.perPage,
    ...(query.value.sort ? { sort: query.value.sort, dir: query.value.dir } : {}),
    ...(query.value.q ? { q: query.value.q } : {}),
  }))

  return { query, update, apiParams }
}
