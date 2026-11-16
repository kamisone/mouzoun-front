import type { Media, MediaVisibility } from '~/utils/types'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Direct-to-storage upload:
 * 1. ask the API for a signed URL, 2. PUT the file straight to Google Cloud Storage,
 * 3. ask the API to verify and publish it.
 */
export function useMediaUpload() {
  const { media } = useAdminApi()
  const { t } = useI18n()
  const uploading = ref(false)
  const error = ref('')

  async function upload(file: File, visibility: MediaVisibility = 'public'): Promise<Media | null> {
    error.value = ''
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      error.value = t('forms.uploadType')
      return null
    }
    uploading.value = true
    try {
      const ticket = await media.createUpload({
        filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
        visibility,
      })
      // Plain fetch (default credentials): the session cookie is never sent to the storage bucket.
      let res: Response
      try {
        res = await fetch(ticket.upload.url, {
          method: ticket.upload.method,
          headers: ticket.upload.headers,
          body: file,
        })
      } catch (e) {
        // The browser blocked the request before any answer: usually the bucket's CORS rules
        // do not list this site's origin (see back/deploy/gcs-cors.json).
        console.error('storage upload blocked', e)
        error.value = t('forms.uploadBlocked')
        return null
      }
      if (!res.ok) {
        console.error('storage upload refused', res.status, await res.text().catch(() => ''))
        error.value = t('forms.uploadRefused', { status: res.status })
        return null
      }
      return await media.complete(ticket.media_id)
    } catch (e: unknown) {
      const details = (e as { data?: { error?: { details?: unknown } } }).data?.error?.details
      error.value = typeof details === 'string' ? details : t('forms.uploadFailed')
      return null
    } finally {
      uploading.value = false
    }
  }

  return { upload, uploading, error }
}
