/**
 * Page builder types: the public page (`GET /v1/pages/...`) and the builder tree
 * (`/v1/admin/pages/{id}/builder`). Mirrors back/src/modules/pages/{model,public}.rs.
 */

// ---- Public page ------------------------------------------------------------------------------

export interface MediaView {
  id: string
  kind: string
  mime_type: string
  url: string
  width: number | null
  height: number | null
  srcset: { url: string, width: number }[]
  blurhash: string | null
  /** Tiny data-URI preview (blur-up). */
  placeholder: string | null
  /** CSS object-position from the focal point ("40% 60%"). */
  position: string | null
  alt: string | null
}

// ---- Gallery section ----------------------------------------------------------------------------

/** An album of a gallery section, as the page payload lists it (`data.albums`). */
export interface GalleryAlbum {
  id: string
  title: string
  description: string | null
  count: number
  cover_media_id: string | null
  hidden_in_preview: boolean
}

/** `data` of a gallery section: the preview only (the viewer loads the photos on demand). */
export interface GalleryData {
  total_count: number
  preview: { media_id: string, album_id: string }[]
  albums: GalleryAlbum[]
}

/** One photo of `GET /v1/sections/{id}/gallery`. */
export interface GalleryPhoto {
  media: MediaView
  caption: string | null
  album_id: string
}

/** A page of `GET /v1/sections/{id}/gallery` (albums on the first page only). */
export interface GalleryPage {
  albums?: { id: string, title: string, description: string | null, count: number, cover: MediaView | null }[]
  items: GalleryPhoto[]
  next_cursor: string | null
  total_count: number
}

/** A gallery of the media library (`/v1/admin/galleries/{id}`). */
export interface AdminGallery {
  id: string
  name: string
  photos: { media_id: string, kind: string, url: string, width: number | null, height: number | null, public: boolean, alt: Record<string, string> }[]
}

export interface ResolvedLink {
  type: 'page' | 'product' | 'category' | 'place' | 'route' | 'url' | 'anchor'
  id?: string
  route?: string
  url?: string
  anchor?: string
  new_tab?: boolean
  /** Localised path, or null when the target is not published (the button is hidden). */
  href?: string | null
  external?: boolean
}

export interface CtaSettings {
  link: ResolvedLink
  style?: 'primary' | 'secondary' | 'ghost' | 'link'
}

export interface Appearance {
  color_scheme?: 'light' | 'dark' | 'sand' | 'night' | 'brand'
  background_media_id?: string
  padding_top?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  padding_bottom?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  width?: 'contained' | 'full'
  divider_top?: 'none' | 'wave' | 'dunes' | 'slant'
  divider_bottom?: 'none' | 'wave' | 'dunes' | 'slant'
}

// Settings and content are schema-driven JSON (validated by the API), read field by field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>

export interface RenderedItem {
  id: string
  settings: Json
  content: Json
}

export interface RenderedSection {
  id: string
  type: string
  anchor_id: string | null
  visible_on: 'all' | 'desktop' | 'mobile'
  analytics_label: string | null
  appearance: Appearance
  settings: Json
  content: Json
  items: RenderedItem[]
  /** Live data (`products`, `reviews`...) and `media`: id → resolved image. */
  data: Json & { media?: Record<string, MediaView> }
}

export interface RenderedPage {
  page: {
    id: string
    type: string
    locale: string
    revision: number | null
    title: string
    slug: string
    path: string
    seo: { title: string, description: string | null, image: MediaView | null, canonical: string | null, noindex: boolean }
    hreflang: { locale: string, path: string }[]
  }
  sections: RenderedSection[]
  json_ld: Json[]
  /** Values texts reference as `{name}`: `{opening_date}` (ISO date). */
  variables: Record<string, string | null>
  preview: boolean
}

// ---- Builder ----------------------------------------------------------------------------------

export interface Period { start: string | null, end: string | null }

export interface ItemDraft {
  id: string
  settings: Json
  content: Record<string, Json>
  is_visible: boolean
  active_period: Period | null
}

export interface BlockDraft {
  id: string
  type: string
  name: string | null
  anchor_id: string | null
  is_visible: boolean
  active_period: Period | null
  visible_on: 'all' | 'desktop' | 'mobile'
  hidden_locales: string[]
  appearance: Appearance
  analytics_label: string | null
  settings: Json
  content: Record<string, Json>
  items: ItemDraft[]
  shared_block_id: string | null
  /** Read only: the shared section a placement shows. */
  shared?: BlockDraft
}

export interface PageText {
  title: string
  slug: string
  excerpt?: string | null
  seo_title?: string | null
  seo_description?: string | null
  og_media_id?: string | null
  noindex?: boolean
}

export interface BuilderTree {
  page: { id: string, page_type: string, status: string, cover_media_id: string | null, translations: Record<string, PageText> }
  draft_version: number
  has_unpublished_changes: boolean
  published_revision: number | null
  blocks: BlockDraft[]
  last_saved_by: { id: string, name: string } | null
  last_saved_at: string | null
}

/** JSON Schema node with the builder keywords. */
export interface SchemaNode {
  'type'?: string | string[]
  'title'?: string
  'enum'?: (string | number)[]
  'default'?: unknown
  'minimum'?: number
  'maximum'?: number
  'maxLength'?: number
  'maxItems'?: number
  'minItems'?: number
  'pattern'?: string
  'properties'?: Record<string, SchemaNode>
  'required'?: string[]
  'items'?: SchemaNode
  '$ref'?: string
  '$defs'?: Record<string, SchemaNode>
  'x-widget'?: string
  'x-ref'?: string
  'x-group'?: 'content' | 'layout' | 'source' | 'advanced' | 'preview' | 'viewer'
  'x-media-kinds'?: string[]
  [key: string]: unknown
}

export interface SectionType {
  code: string
  name: string
  description: string | null
  icon: string | null
  category: 'hero' | 'listing' | 'content' | 'media' | 'social_proof' | 'conversion' | 'layout' | 'utility'
  schema_version: number
  sort_order: number
  min_items: number
  max_items: number | null
  max_per_page: number | null
  allowed_owners: string[]
  allowed_page_types: string[] | null
  required_permission: string | null
  settings_schema: SchemaNode
  content_schema: SchemaNode
  item_settings_schema: SchemaNode | null
  item_content_schema: SchemaNode | null
  preset: { settings?: Json, content?: Record<string, Json>, items?: { settings?: Json, content?: Record<string, Json> }[], appearance?: Appearance }
  renders_h1: boolean
  is_active: boolean
  preview_url: string | null
}

export interface FieldError { path: string, code: string, message: string }

export interface RevisionSummary {
  id: string
  revision_number: number
  status: 'scheduled' | 'published' | 'superseded' | 'cancelled'
  publish_at: string | null
  published_at: string | null
  published_by: { id: string, name: string } | null
  note: string | null
  created_by: { id: string, name: string } | null
  created_at: string
}

export interface SectionRef { id: string, type: string, name: string | null, title: string | null }

export interface PublishCheck {
  errors: FieldError[]
  /** Not blocking (photo descriptions missing in other languages). */
  warnings?: FieldError[]
  published_revision: number | null
  /** `page_type`: the draft's type differs from the published one ("Change type" in Admin › Pages). */
  diff: { page_type?: { from: string, to: string } | null, added: SectionRef[], removed: SectionRef[], changed: SectionRef[], moved: boolean }
}

export interface PageSummary {
  id: string
  page_type: string
  status: string
  title: string | null
  slug: string | null
  has_unpublished_changes: boolean
  published_revision: number | null
  scheduled_at: string | null
  updated_at: string
}

export interface SharedSummary { id: string, type: string, name: string | null, usages: number, updated_at: string }

export interface LookupOption {
  id: string
  label: string
  hint: string | null
  /** Shop products: cover, lowest price and stock status, so a sold-out product is not picked by mistake. */
  image_url?: string | null
  price_minor?: number | null
  availability?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder' | null
}
