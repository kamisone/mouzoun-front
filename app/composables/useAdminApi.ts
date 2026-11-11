import type { Activity, ActivityInput, Media, MediaVisibility, Paginated, UploadTicket, User } from '~/utils/types'

export interface PageQuery {
  page?: number
  per_page?: number
}

/**
 * Typed client of the back-office API (`/v1/admin/...`): every admin endpoint is declared here,
 * nowhere else. Authentication is the HttpOnly session cookie (sent with `credentials: 'include'`);
 * an expired session sends the user back to the login page.
 */
export function useAdminApi() {
  const user = useState<User | null>('auth-user', () => null)

  const http = $fetch.create({
    baseURL: `${useRuntimeConfig().public.apiBase}/v1/admin`,
    credentials: 'include',
    async onResponseError({ response }) {
      if (response.status === 401) {
        user.value = null
        await navigateTo('/admin/login')
      }
    },
  })

  return {
    activities: {
      list: (query: PageQuery = {}) => http<Paginated<Activity>>('/activities', { query }),
      get: (id: string) => http<Activity>(`/activities/${id}`),
      create: (body: ActivityInput) => http<Activity>('/activities', { method: 'POST', body }),
      update: (id: string, body: ActivityInput) => http<Activity>(`/activities/${id}`, { method: 'PUT', body }),
      remove: (id: string) => http<void>(`/activities/${id}`, { method: 'DELETE' }),
    },
    media: {
      createUpload: (body: { filename: string; content_type: string; size_bytes: number; visibility: MediaVisibility }) =>
        http<UploadTicket>('/media/uploads', { method: 'POST', body }),
      complete: (id: string) => http<Media>(`/media/${id}/complete`, { method: 'POST' }),
    },
  }
}
