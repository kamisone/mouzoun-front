/** Profile returned by `/v1/auth/login` and `/v1/auth/me`. */
export interface User {
  id: string
  email: string
  full_name: string
  /** Only staff accounts may use the back office. */
  is_staff: boolean
  /** Role codes, e.g. `super_admin`, `manager`, `reception`. */
  roles: string[]
  /** Permission codes, e.g. `bookings.write`. */
  permissions: string[]
  created_at: string
}

/** The session token itself is an HttpOnly cookie: it never appears in a response body. */
export interface SessionResponse {
  user: User
  /** Session lifetime in seconds. */
  expires_in: number
}

export interface Paginated<T> {
  data: T[]
  page: number
  per_page: number
  total: number
}

export type MediaKind = 'image' | 'video' | 'document' | 'audio' | 'other'
export type MediaVisibility = 'public' | 'private'

export interface Media {
  id: string
  kind: MediaKind
  visibility: MediaVisibility
  mime_type: string
  size_bytes: number
  original_filename: string
  /** Public URL, or a short-lived signed URL for private media. */
  url: string
  width: number | null
  height: number | null
  created_at: string
}

export interface UploadTicket {
  media_id: string
  expires_at: string
  upload: {
    url: string
    method: 'PUT'
    /** Must be sent verbatim: they are part of the URL signature. */
    headers: Record<string, string>
    expires_at: string
  }
}
