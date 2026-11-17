import type { Media, MediaVisibility } from '~/utils/types'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * Sends the file to the API (multipart). The API checks it and writes it to Google Cloud Storage
 * with its ACL (public photo or private file): the browser never talks to the bucket, so the
 * bucket needs no CORS rule.
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
      return await media.upload(file, visibility)
    } catch (e: unknown) {
      const err = e as { statusCode?: number, data?: { error?: { details?: unknown } } }
      const details = err.data?.error?.details
      error.value = err.statusCode === 413
        ? t('forms.uploadTooLarge')
        : typeof details === 'string' ? details : t('forms.uploadFailed')
      return null
    } finally {
      uploading.value = false
    }
  }

  return { upload, uploading, error }
}
