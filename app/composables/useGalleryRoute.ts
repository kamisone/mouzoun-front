/**
 * URL state of a gallery section's full-screen viewer, kept in the hash so a photo can be shared:
 * `#gallery-<anchor or section id>` (viewer open), `/album-<n>` (1-based album), `/photo-<media id>`
 * (lightbox). Opening the viewer and opening a photo each push a history entry, so the browser
 * back button closes the lightbox, then the viewer, and never leaves the page; switching album
 * replaces the entry.
 *
 * These entries are handled here, before Vue Router sees them (capture-phase `popstate`): the
 * router only ever knows the page URL, so it neither scrolls to the top when the hash goes away
 * nor looks for an element named after the hash.
 */
export interface GalleryRouteState {
  open: boolean
  /** 1-based position of the album in the section. */
  album: number | null
  photo: string | null
}

const CLOSED: GalleryRouteState = { open: false, album: null, photo: null }

export function galleryHash(key: string, state: Pick<GalleryRouteState, 'album' | 'photo'>): string {
  let hash = `#gallery-${key}`
  if (state.album) hash += `/album-${state.album}`
  if (state.photo) hash += `/photo-${state.photo}`
  return hash
}

export function parseGalleryHash(hash: string, key: string): GalleryRouteState | null {
  const prefix = `#gallery-${key}`
  let raw = hash
  try {
    raw = decodeURIComponent(hash)
  }
  catch { /* keep the raw hash */ }
  if (raw !== prefix && !raw.startsWith(`${prefix}/`)) return null
  const state: GalleryRouteState = { open: true, album: null, photo: null }
  for (const part of raw.slice(prefix.length).split('/')) {
    const album = /^album-(\d{1,3})$/.exec(part)
    if (album) state.album = Number(album[1]) || null
    const photo = /^photo-([0-9a-f-]{36})$/i.exec(part)
    if (photo) state.photo = photo[1]!.toLowerCase()
  }
  return state
}

interface Marker { mzGallery?: string, mzLevel?: number }

export function useGalleryRoute(key: () => string) {
  const state = ref<GalleryRouteState>({ ...CLOSED })
  const base = () => `${location.pathname}${location.search}`
  const marker = (): Marker => (history.state ?? {}) as Marker
  const ours = () => marker().mzGallery === key()

  function write(next: GalleryRouteState, mode: 'push' | 'replace', level: number) {
    const url = next.open ? `${base()}${galleryHash(key(), next)}` : base()
    const data = { ...(history.state ?? {}), mzGallery: next.open ? key() : undefined, mzLevel: next.open ? level : undefined }
    if (mode === 'push') history.pushState(data, '', url)
    else history.replaceState(data, '', url)
    state.value = next
  }

  /** Opens the viewer (on an album), or a photo directly (two entries: back shows the viewer). */
  function open(album: number | null, photo: string | null = null) {
    if (!state.value.open) write({ open: true, album, photo: null }, 'push', 1)
    else write({ ...state.value, album }, 'replace', marker().mzLevel ?? 1)
    if (photo) write({ open: true, album, photo }, 'push', 2)
  }
  function setAlbum(album: number | null) {
    if (!state.value.open || state.value.album === album) return
    write({ ...state.value, album }, 'replace', marker().mzLevel ?? 1)
  }
  function openPhoto(photo: string) {
    if (!state.value.open) return
    if (state.value.photo) write({ ...state.value, photo }, 'replace', 2)
    else write({ ...state.value, photo }, 'push', 2)
  }
  function closePhoto() {
    if (!state.value.photo) return
    if (ours() && marker().mzLevel === 2) history.back()
    else write({ ...state.value, photo: null }, 'replace', 1)
  }
  function close() {
    if (!state.value.open) return
    const level = ours() ? marker().mzLevel ?? 0 : 0
    if (level > 0) history.go(-level)
    else write({ ...CLOSED }, 'replace', 0)
  }

  let page = ''
  function onPopState(event: PopStateEvent) {
    const next = parseGalleryHash(location.hash, key())
    // Only steps between this gallery's entries and the page itself.
    if (base() !== page || (!next && !state.value.open)) return
    event.stopImmediatePropagation()
    state.value = next ?? { ...CLOSED }
  }

  onMounted(() => {
    page = base()
    window.addEventListener('popstate', onPopState, { capture: true })
    // A shared link: rebuild the history (page → viewer → photo) so back still closes it.
    const landed = parseGalleryHash(location.hash, key())
    if (landed) {
      history.replaceState({ ...(history.state ?? {}), mzGallery: undefined, mzLevel: undefined }, '', base())
      open(landed.album, landed.photo)
    }
  })
  onBeforeUnmount(() => window.removeEventListener('popstate', onPopState, { capture: true }))

  return { state: readonly(state), open, setAlbum, openPhoto, closePhoto, close }
}
