import type { Media, MediaVisibility, UploadTicket } from '~/utils/types'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Direct-to-storage upload:
 * 1. ask the API for a signed URL, 2. PUT the file straight to Google Cloud Storage,
 * 3. ask the API to verify and publish it.
 */
export function useMediaUpload() {
  const api = useAdminApi()
  const uploading = ref(false)
  const error = ref('')

  async function upload(file: File, visibility: MediaVisibility = 'public'): Promise<Media | null> {
    error.value = ''
    uploading.value = true
    try {
      const ticket = await api<UploadTicket>('/v1/media/uploads', {
        method: 'POST',
        body: { filename: file.name, content_type: file.type, size_bytes: file.size, visibility },
      })
      // Plain fetch: the signed URL must not receive our API Authorization header.
      const res = await fetch(ticket.upload.url, {
        method: ticket.upload.method,
        headers: ticket.upload.headers,
        body: file,
      })
      if (!res.ok) throw new Error(`storage upload failed (${res.status})`)
      return await api<Media>(`/v1/media/${ticket.media.id}/complete`, { method: 'POST' })
    } catch (e: unknown) {
      const details = (e as { data?: { error?: { details?: unknown } } }).data?.error?.details
      error.value = typeof details === 'string' ? details : "Échec de l'envoi du fichier"
      return null
    } finally {
      uploading.value = false
    }
  }

  return { upload, uploading, error }
}
