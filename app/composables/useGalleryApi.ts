import type { GalleryPage } from '~/utils/page-types'

/** Photos of a gallery section, page by page (`GET /v1/sections/{id}/gallery`). */
export function useGalleryApi() {
  const config = useRuntimeConfig()
  return {
    page: (sectionId: string, query: { locale: string, album?: string, cursor?: string, limit?: number, preview?: string }) =>
      $fetch<GalleryPage>(`/v1/sections/${sectionId}/gallery`, { baseURL: config.public.apiBase, query }),
  }
}
