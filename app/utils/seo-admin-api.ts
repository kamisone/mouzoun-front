/** Admin › SEO endpoints (`/v1/admin/seo`), declared through `useAdminApi().seo`. */
export interface AdminRedirect {
  id: string
  from_path: string
  to_path: string
  status_code: number
  source: 'auto' | 'manual'
  entity_type: string | null
  entity_id: string | null
  locale: string | null
  note: string | null
  hits: number
  last_hit_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotFoundRow {
  path: string
  hits: number
  first_seen_at: string
  last_seen_at: string
  last_referrer: string | null
  is_ignored: boolean
  suggestions: { path: string, score: number }[]
}

export interface UrlTest {
  input: string
  normalized: string
  normalization_redirect: boolean
  redirect: { id: string, to_path: string, status_code: number, source: string, is_active: boolean } | null
  content: {
    entity_type: string
    entity_id: string | null
    locale: string
    served: boolean
    indexability: { status: 'indexable' | 'not_indexable', reason?: string }
    canonical_path: string | null
    in_sitemap: boolean
  } | null
}

export interface SitemapStatus {
  sitemap_url: string
  built_at: string | null
  files: { name: string, url: string, lastmod: string | null, count: number, per_locale: Record<string, number> }[]
}

type Query = Record<string, string | number | boolean | undefined | null>

export function seoAdminApi(http: ReturnType<typeof $fetch.create>) {
  return {
    redirects: (query: Query) => http<{ data: AdminRedirect[], total: number, page: number, per_page: number, uses_307_308: boolean }>('/seo/redirects', { query }),
    createRedirect: (body: Partial<AdminRedirect>) => http<{ id: string, flattened: number }>('/seo/redirects', { method: 'POST', body }),
    updateRedirect: (id: string, body: Partial<AdminRedirect>) => http<{ id: string }>(`/seo/redirects/${id}`, { method: 'PATCH', body }),
    deleteRedirect: (id: string) => http(`/seo/redirects/${id}`, { method: 'DELETE' }),
    bulk: (ids: string[], action: 'activate' | 'deactivate' | 'delete') => http<{ count: number }>('/seo/redirects/bulk', { method: 'POST', body: { ids, action } }),
    notFound: (query: Query) => http<{ data: NotFoundRow[], total: number, page: number, per_page: number }>('/seo/not-found', { query }),
    ignoreNotFound: (path: string, is_ignored: boolean) => http(`/seo/not-found${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'PATCH', body: { is_ignored } }),
    clearNotFound: (paths: string[]) => http<{ count: number }>('/seo/not-found', { method: 'DELETE', body: { paths } }),
    test: (path: string) => http<UrlTest>('/seo/test', { query: { path } }),
    livePaths: (q: string) => http<{ data: { path: string, locale: string, entity_type: string }[] }>('/seo/live-paths', { query: { q } }),
    sitemapStatus: () => http<SitemapStatus>('/seo/sitemap/status'),
    rebuildSitemap: () => http('/seo/sitemap/rebuild', { method: 'POST' }),
  }
}
