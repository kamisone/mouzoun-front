import type { Media, MediaVisibility } from '~/utils/types'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm']
/** The API's defaults (MEDIA_MAX_UPLOAD_BYTES, MEDIA_MAX_VIDEO_BYTES); the API decides. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024

export type UploadKind = 'image' | 'video' | 'document'

export function acceptedTypes(kinds: readonly string[]): string[] {
  return [...(kinds.includes('image') ? ACCEPTED_IMAGE_TYPES : []), ...(kinds.includes('video') ? ACCEPTED_VIDEO_TYPES : [])]
}

/** A QuickTime video (what iPhones record): refused, with a request for an MP4 export. */
export function isQuicktime(file: File): boolean {
  return file.type === 'video/quicktime' || /\.mov$/i.test(file.name)
}

/**
 * Sends the file to the API (multipart). The API checks it and writes it to Google Cloud Storage
 * with its ACL (public photo or private file): the browser never talks to the bucket, so the
 * bucket needs no CORS rule. `kinds` limits what is accepted (images by default).
 */
export function useMediaUpload(kinds: () => readonly string[] = () => ['image']) {
  const { media } = useAdminApi()
  const { t } = useI18n()
  const uploading = ref(false)
  const error = ref('')
  const mb = (bytes: number) => Math.round(bytes / (1024 * 1024))

  async function upload(file: File, visibility: MediaVisibility = 'public'): Promise<Media | null> {
    error.value = ''
    const allowed = acceptedTypes(kinds())
    if (isQuicktime(file)) {
      error.value = t('forms.uploadMov')
      return null
    }
    if (!allowed.includes(file.type)) {
      error.value = t('forms.uploadTypeOf', { formats: formatList(kinds(), t) })
      return null
    }
    const video = ACCEPTED_VIDEO_TYPES.includes(file.type)
    const max = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (file.size > max) {
      error.value = t('forms.uploadTooLargeMax', { max: mb(max) })
      return null
    }
    uploading.value = true
    try {
      return await media.upload(file, visibility)
    }
    catch (e: unknown) {
      const err = e as { statusCode?: number, data?: { error?: { code?: string, details?: unknown } } }
      const code = err.data?.error?.code
      const details = err.data?.error?.details
      if (code === 'video_mov') error.value = t('forms.uploadMov')
      else if (code === 'unsupported_type') error.value = t('forms.uploadTypeOf', { formats: formatList(kinds(), t) })
      else if (err.statusCode === 413) {
        const limit = (details as { max_bytes?: number } | undefined)?.max_bytes
        error.value = limit ? t('forms.uploadTooLargeMax', { max: mb(limit) }) : t('forms.uploadTooLarge')
      }
      else error.value = typeof details === 'string' ? details : t('forms.uploadFailed')
      return null
    }
    finally {
      uploading.value = false
    }
  }

  return { upload, uploading, error }
}

/** "JPEG, PNG, WebP ou AVIF · 15 Mo max" (per kind, translated). */
export function formatList(kinds: readonly string[], t: (key: string, params?: Record<string, unknown>) => string): string {
  return [
    kinds.includes('image') ? t('forms.media.imageFormats', { max: Math.round(MAX_IMAGE_BYTES / 1048576) }) : null,
    kinds.includes('video') ? t('forms.media.videoFormats', { max: Math.round(MAX_VIDEO_BYTES / 1048576) }) : null,
  ].filter(Boolean).join(' · ')
}
