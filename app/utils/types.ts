export type Role = 'admin' | 'staff' | 'customer'

export interface User {
  id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: User
}

export interface Paginated<T> {
  data: T[]
  page: number
  per_page: number
  total: number
}

export interface Activity {
  id: string
  slug: string
  title_fr: string
  title_en: string
  description_fr: string
  description_en: string
  price_mad: number
  duration_minutes: number
  cover_media_id: string | null
  /** Resolved public URL of the cover (read-only, computed by the API). */
  cover_image_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

export type ActivityInput = Omit<Activity, 'id' | 'cover_image_url' | 'created_at' | 'updated_at'>

export type MediaStatus = 'pending' | 'ready'
export type MediaVisibility = 'public' | 'private'

export interface Media {
  id: string
  status: MediaStatus
  visibility: MediaVisibility
  content_type: string
  size_bytes: number
  original_filename: string
  url: string | null
  created_at: string
  completed_at: string | null
}

export interface UploadTicket {
  media: Media
  upload: {
    url: string
    method: 'PUT'
    /** Must be sent verbatim: they are part of the URL signature. */
    headers: Record<string, string>
    expires_at: string
  }
}
