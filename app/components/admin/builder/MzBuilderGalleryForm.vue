<script setup lang="ts">
import type { AdminGallery, BlockDraft, FieldError, ItemDraft, SectionType } from '~/utils/page-types'
import { newItem } from '~/utils/page-builder'

/**
 * Form of the gallery section, in three tabs:
 * - Albums: the texts, then the albums (= the section's items): a gallery each (pick one or make a
 *   new one), its title and description per language, a cover chosen among its photos, a
 *   schedule; photo counts, and the photos still missing a description (alt text) with a dialog
 *   to write it;
 * - Preview: layout (with a small drawing of each), height, automatic or hand-picked photos (only
 *   photos of the albums, exactly as many as the layout shows);
 * - Viewer: the generated fields of the `viewer` group.
 */
const props = defineProps<{ type: SectionType, tab: string, path: string, errors: FieldError[] }>()
const block = defineModel<BlockDraft>({ required: true })
const api = useAdminApi()
const toast = useToast()
const { t, locale, locales } = useI18n()
const DEFAULT_LOCALE = 'fr'

// ---- Galleries of the albums --------------------------------------------------------------------
const galleries = reactive<Record<string, AdminGallery>>({})
async function fetchGallery(id: string) {
  try {
    galleries[id] = await api.galleries.get(id)
  }
  catch { /* deleted gallery: the publish check reports it */ }
}
watch(
  () => block.value.items.map(i => i.settings.gallery_id as string | undefined).filter((id): id is string => !!id),
  ids => ids.forEach(id => galleries[id] || fetchGallery(id)),
  { immediate: true },
)
type Photo = AdminGallery['photos'][number]
const usable = (p: Photo) => p.public && (p.kind === 'image' || p.kind === 'video')
const photosOf = (item: ItemDraft): Photo[] => (galleries[item.settings.gallery_id as string]?.photos ?? []).filter(usable)
const visibleAlbums = computed(() => block.value.items.filter(i => i.is_visible))
const totalPhotos = computed(() => visibleAlbums.value.reduce((n, i) => n + photosOf(i).length, 0))
const missingAlt = (p: Photo) => p.kind === 'image' ? locales.value.map(l => String(l.code)).filter(code => !p.alt[code]?.trim()) : []

// ---- Albums list -----------------------------------------------------------------------------------
const open = ref<string | null>(block.value.items[0]?.id ?? null)
const max = computed(() => props.type.max_items ?? 12)
function titleOf(item: ItemDraft, i: number) {
  const c = item.content[locale.value] ?? item.content[DEFAULT_LOCALE] ?? {}
  return (c.title as string) || t('admin.builder.gallery.album', { n: i + 1 })
}
function addAlbum() {
  const item = newItem(props.type)
  block.value.items.push(item)
  open.value = item.id
}
function move(from: number, to: number) {
  if (to < 0 || to >= block.value.items.length) return
  const [item] = block.value.items.splice(from, 1)
  block.value.items.splice(to, 0, item!)
}
function setItem(item: ItemDraft, key: string, value: unknown) {
  const { [key]: _old, ...rest } = item.settings
  item.settings = value === undefined || value === null || value === false ? rest : { ...rest, [key]: value }
}
const itemErrors = (i: number) => props.errors.filter(e => e.path.startsWith(`${props.path}/items/${i}/`))
const errorAt = (pointer: string) => props.errors.find(e => e.path === pointer)?.message

// ---- Gallery editor (new gallery / edit photos) ---------------------------------------------------
const editor = reactive({ open: false, saving: false, item: null as ItemDraft | null, id: null as string | null, name: '', media: [] as string[] })
function newGallery(item: ItemDraft, i: number) {
  Object.assign(editor, { open: true, item, id: null, name: titleOf(item, i), media: [] })
}
function editGallery(item: ItemDraft) {
  const g = galleries[item.settings.gallery_id as string]
  if (!g) return
  Object.assign(editor, { open: true, item, id: g.id, name: g.name, media: g.photos.map(p => p.media_id) })
}
async function saveGallery() {
  editor.saving = true
  try {
    const g = editor.id
      ? await api.galleries.update(editor.id, { name: editor.name, media_ids: editor.media })
      : await api.galleries.create({ name: editor.name, media_ids: editor.media })
    galleries[g.id] = g
    if (editor.item) setItem(editor.item, 'gallery_id', g.id)
    editor.open = false
  }
  catch {
    toast.add({ title: t('admin.builder.gallery.saveFailed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    editor.saving = false
  }
}

// ---- Photo descriptions (alt texts) -----------------------------------------------------------------
const describing = reactive({ open: false, saving: false, photo: null as Photo | null, gallery: '', texts: {} as Record<string, string> })
function describe(photo: Photo, gallery: string) {
  Object.assign(describing, { open: true, photo, gallery, texts: Object.fromEntries(locales.value.map(l => [l.code, photo.alt[String(l.code)] ?? ''])) })
}
async function saveDescription() {
  if (!describing.photo) return
  describing.saving = true
  try {
    await api.media.texts(describing.photo.media_id, Object.fromEntries(Object.entries(describing.texts).map(([l, alt]) => [l, { alt_text: alt }])))
    // Every gallery showing this photo.
    await Promise.all(Object.keys(galleries).filter(id => galleries[id]!.photos.some(p => p.media_id === describing.photo!.media_id)).map(fetchGallery))
    describing.open = false
  }
  catch {
    toast.add({ title: t('admin.builder.gallery.saveFailed'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    describing.saving = false
  }
}

// ---- Preview ----------------------------------------------------------------------------------------
const NEEDED: Record<string, [number, number]> = { mosaic: [5, 5], mosaic_3: [3, 3], cover: [1, 1], filmstrip: [3, 12] }
const layout = computed(() => (block.value.settings.preview_layout as string) ?? 'mosaic')
const needed = computed<[number, number]>(() => NEEDED[layout.value] ?? [5, 5])
const manual = computed(() => block.value.settings.preview_source === 'manual')
const picked = computed<string[]>(() => (block.value.settings.preview_media_ids as string[] | undefined) ?? [])
function setSetting(key: string, value: unknown) {
  block.value.settings = { ...block.value.settings, [key]: value }
}
/** Photos of all albums, once each, in album order. */
const albumPhotos = computed(() => {
  const seen = new Set<string>()
  return visibleAlbums.value.flatMap(photosOf).filter(p => !seen.has(p.media_id) && seen.add(p.media_id))
})
function togglePick(id: string) {
  const list = picked.value
  if (list.includes(id)) setSetting('preview_media_ids', list.filter(x => x !== id))
  else if (list.length < needed.value[1]) setSetting('preview_media_ids', [...list, id])
}
const pickHint = computed(() => needed.value[0] === needed.value[1]
  ? t('admin.builder.gallery.pickExactly', { n: needed.value[0], picked: picked.value.length })
  : t('admin.builder.gallery.pickBetween', { min: needed.value[0], max: needed.value[1], picked: picked.value.length }))
const layouts = ['mosaic', 'mosaic_3', 'cover', 'filmstrip'] as const
const heights = computed(() => ['sm', 'md', 'lg'].map(v => ({ label: t(`admin.builder.gallery.heights.${v}`), value: v })))
const sources = computed(() => ['auto', 'manual'].map(v => ({ label: t(`admin.builder.gallery.sources.${v}`), value: v })))
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="gallery-form">
    <!-- ---- Albums ---- -->
    <template v-if="props.tab === 'albums'">
      <MzSchemaFields v-model="block.content" :root="props.type.content_schema" group="content" :path="`${props.path}/content`" :errors="props.errors.filter(e => e.path.startsWith(`${props.path}/content`))" localized />

      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-small font-medium">
            {{ t('admin.builder.gallery.albums') }}
            <span class="text-muted" data-testid="gallery-summary">{{ t('admin.builder.gallery.summary', { photos: totalPhotos, albums: visibleAlbums.length }) }}</span>
          </h3>
          <UButton :label="t('admin.builder.gallery.addAlbum')" icon="i-lucide-plus" size="xs" :disabled="block.items.length >= max" data-testid="gallery-add-album" @click="addAlbum" />
        </div>
        <p v-if="errorAt(`${props.path}/items`)" class="text-small text-error" role="alert">{{ errorAt(`${props.path}/items`) }}</p>

        <ol class="flex flex-col gap-2">
          <li v-for="(item, i) in block.items" :key="item.id" class="rounded-sm border" :class="itemErrors(i).length ? 'border-error' : 'border-default'">
            <div class="flex items-center gap-1 p-2">
              <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-start text-small" :aria-expanded="open === item.id" @click="open = open === item.id ? null : item.id">
                <span class="truncate" :class="!item.is_visible && 'text-muted line-through'">{{ titleOf(item, i) }}</span>
                <UBadge :label="String(photosOf(item).length)" color="neutral" variant="subtle" size="sm" :aria-label="t('admin.builder.gallery.photoCount', { n: photosOf(item).length })" />
                <UIcon v-if="photosOf(item).some(p => missingAlt(p).includes(DEFAULT_LOCALE))" name="i-lucide-circle-alert" class="size-4 shrink-0 text-error" :aria-label="t('admin.builder.gallery.altMissing')" />
                <UIcon v-if="item.active_period" name="i-lucide-calendar-clock" class="size-4 shrink-0 text-info" :aria-label="t('admin.builder.badges.scheduled')" />
              </button>
              <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" :aria-label="t('admin.builder.moveUp')" @click="move(i, i - 1)" />
              <UButton icon="i-lucide-arrow-down" size="xs" color="neutral" variant="ghost" :disabled="i === block.items.length - 1" :aria-label="t('admin.builder.moveDown')" @click="move(i, i + 1)" />
              <UButton :icon="item.is_visible ? 'i-lucide-eye' : 'i-lucide-eye-off'" size="xs" color="neutral" variant="ghost" :aria-label="item.is_visible ? t('admin.builder.hide') : t('admin.builder.show')" :aria-pressed="!item.is_visible" @click="item.is_visible = !item.is_visible" />
              <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :disabled="block.items.length <= props.type.min_items" :aria-label="t('common.delete')" @click="block.items.splice(i, 1)" />
            </div>

            <div v-if="open === item.id" class="flex flex-col gap-6 border-t border-default p-4">
              <MzSchemaFields v-model="item.content" :root="props.type.item_content_schema!" :path="`${props.path}/items/${i}/content`" :errors="itemErrors(i)" localized />

              <UFormField :label="t('admin.builder.gallery.gallery')" :error="errorAt(`${props.path}/items/${i}/settings/gallery_id`)" required>
                <div class="flex flex-col gap-2">
                  <MzEntityPicker :model-value="item.settings.gallery_id" kind="gallery" :label="t('admin.builder.gallery.gallery')" @update:model-value="v => setItem(item, 'gallery_id', v)" />
                  <div class="flex flex-wrap gap-2">
                    <UButton :label="t('admin.builder.gallery.newGallery')" icon="i-lucide-folder-plus" size="xs" color="neutral" variant="outline" @click="newGallery(item, i)" />
                    <UButton v-if="galleries[item.settings.gallery_id]" :label="t('admin.builder.gallery.editPhotos')" icon="i-lucide-images" size="xs" color="neutral" variant="outline" @click="editGallery(item)" />
                  </div>
                </div>
              </UFormField>

              <div v-if="photosOf(item).length" class="flex flex-col gap-2">
                <p class="text-small font-medium">{{ t('admin.builder.gallery.cover') }} <span class="font-normal text-muted">{{ t('admin.builder.gallery.coverHint') }}</span></p>
                <ul class="grid grid-cols-4 gap-2" role="radiogroup" :aria-label="t('admin.builder.gallery.cover')">
                  <li v-for="(p, k) in photosOf(item)" :key="p.media_id" class="relative">
                    <button
                      type="button"
                      role="radio"
                      class="relative block aspect-square w-full overflow-hidden rounded-xs bg-muted"
                      :class="(item.settings.cover_media_id ?? photosOf(item)[0]?.media_id) === p.media_id && 'ring-2 ring-primary'"
                      :aria-checked="(item.settings.cover_media_id ?? photosOf(item)[0]?.media_id) === p.media_id"
                      :aria-label="p.alt[DEFAULT_LOCALE] || t('admin.builder.gallery.photo', { n: k + 1 })"
                      @click="setItem(item, 'cover_media_id', k === 0 && !item.settings.cover_media_id ? undefined : p.media_id)"
                    >
                      <img v-if="p.kind === 'image'" :src="p.url" alt="" loading="lazy" class="size-full object-cover">
                      <UIcon v-else name="i-lucide-video" class="absolute inset-0 m-auto size-6" />
                    </button>
                    <UButton
                      v-if="missingAlt(p).length"
                      :icon="missingAlt(p).includes(DEFAULT_LOCALE) ? 'i-lucide-circle-alert' : 'i-lucide-languages'"
                      :color="missingAlt(p).includes(DEFAULT_LOCALE) ? 'error' : 'warning'"
                      size="xs"
                      class="absolute end-1 top-1"
                      :aria-label="t('admin.builder.gallery.describe', { locales: missingAlt(p).join(', ').toUpperCase() })"
                      :title="t('admin.builder.gallery.describe', { locales: missingAlt(p).join(', ').toUpperCase() })"
                      :data-testid="`describe-${p.media_id}`"
                      @click="describe(p, item.settings.gallery_id)"
                    />
                  </li>
                </ul>
                <p v-if="errorAt(`${props.path}/items/${i}/settings/cover_media_id`)" class="text-small text-error">{{ errorAt(`${props.path}/items/${i}/settings/cover_media_id`) }}</p>
              </div>
              <p v-else-if="item.settings.gallery_id" class="text-small text-warning">{{ t('admin.builder.gallery.emptyGallery') }}</p>

              <UFormField :label="t('admin.builder.gallery.hiddenInPreview')">
                <USwitch :model-value="!!item.settings.hidden_in_preview" :aria-label="t('admin.builder.gallery.hiddenInPreview')" @update:model-value="v => setItem(item, 'hidden_in_preview', v)" />
              </UFormField>
              <MzPeriodField v-model="item.active_period" />
            </div>
          </li>
        </ol>
      </section>
    </template>

    <!-- ---- Preview ---- -->
    <template v-else-if="props.tab === 'preview'">
      <UFormField :label="t('admin.builder.gallery.layout')">
        <div class="grid grid-cols-2 gap-2" role="radiogroup" :aria-label="t('admin.builder.gallery.layout')">
          <button
            v-for="l in layouts"
            :key="l"
            type="button"
            role="radio"
            :aria-checked="layout === l"
            class="flex flex-col gap-2 rounded-sm border p-2 text-start text-small"
            :class="layout === l ? 'border-primary ring-1 ring-primary' : 'border-default hover:bg-muted'"
            :data-testid="`layout-${l}`"
            @click="setSetting('preview_layout', l)"
          >
            <!-- A tiny drawing of the layout. -->
            <span class="grid h-12 gap-1" :class="{ mosaic: 'grid-cols-4 grid-rows-2', mosaic_3: 'grid-cols-3 grid-rows-2', cover: 'grid-cols-1', filmstrip: 'grid-cols-5' }[l]" aria-hidden="true">
              <template v-if="l === 'mosaic'">
                <span class="col-span-2 row-span-2 rounded-xs bg-accented" /><span v-for="n in 4" :key="n" class="rounded-xs bg-accented" />
              </template>
              <template v-else-if="l === 'mosaic_3'">
                <span class="col-span-2 row-span-2 rounded-xs bg-accented" /><span v-for="n in 2" :key="n" class="rounded-xs bg-accented" />
              </template>
              <span v-else-if="l === 'cover'" class="rounded-xs bg-accented" />
              <template v-else>
                <span v-for="n in 5" :key="n" class="rounded-xs bg-accented" />
              </template>
            </span>
            {{ t(`admin.builder.gallery.layouts.${l}`) }}
          </button>
        </div>
      </UFormField>
      <UFormField :label="t('admin.builder.gallery.height')">
        <URadioGroup :model-value="block.settings.preview_height ?? 'md'" :items="heights" orientation="horizontal" @update:model-value="v => setSetting('preview_height', v)" />
      </UFormField>
      <UFormField :label="t('admin.builder.gallery.source')">
        <URadioGroup :model-value="block.settings.preview_source ?? 'auto'" :items="sources" orientation="horizontal" @update:model-value="v => setSetting('preview_source', v)" />
      </UFormField>
      <div v-if="manual" class="flex flex-col gap-2" data-testid="preview-picker">
        <p class="text-small" :class="picked.length < needed[0] || picked.length > needed[1] ? 'text-warning' : 'text-muted'">{{ pickHint }}</p>
        <p v-if="errorAt(`${props.path}/settings/preview_media_ids`)" class="text-small text-error">{{ errorAt(`${props.path}/settings/preview_media_ids`) }}</p>
        <ul v-if="albumPhotos.length" class="grid grid-cols-4 gap-2">
          <li v-for="p in albumPhotos" :key="p.media_id">
            <button
              type="button"
              class="relative block aspect-square w-full overflow-hidden rounded-xs bg-muted disabled:opacity-40"
              :class="picked.includes(p.media_id) && 'ring-2 ring-primary'"
              :aria-pressed="picked.includes(p.media_id)"
              :aria-label="p.alt[DEFAULT_LOCALE] || p.media_id"
              :disabled="!picked.includes(p.media_id) && picked.length >= needed[1]"
              @click="togglePick(p.media_id)"
            >
              <img v-if="p.kind === 'image'" :src="p.url" alt="" loading="lazy" class="size-full object-cover">
              <UIcon v-else name="i-lucide-video" class="absolute inset-0 m-auto size-6" />
              <span v-if="picked.includes(p.media_id)" class="absolute start-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-caption text-inverted">{{ picked.indexOf(p.media_id) + 1 }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="text-small text-muted">{{ t('admin.builder.gallery.noAlbumPhotos') }}</p>
      </div>
      <UFormField :label="t('admin.builder.gallery.showCount')">
        <USwitch :model-value="block.settings.show_count !== false" :aria-label="t('admin.builder.gallery.showCount')" @update:model-value="v => setSetting('show_count', v)" />
      </UFormField>
      <UFormField :label="t('admin.builder.gallery.showChips')">
        <USwitch :model-value="block.settings.show_album_chips !== false" :aria-label="t('admin.builder.gallery.showChips')" @update:model-value="v => setSetting('show_album_chips', v)" />
      </UFormField>
    </template>

    <!-- ---- Viewer ---- -->
    <MzSchemaFields v-else-if="props.tab === 'viewer'" v-model="block.settings" :root="props.type.settings_schema" group="viewer" :path="`${props.path}/settings`" :errors="props.errors.filter(e => e.path.startsWith(`${props.path}/settings`))" />

    <UModal v-model:open="editor.open" :title="editor.id ? t('admin.builder.gallery.editPhotos') : t('admin.builder.gallery.newGallery')" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField :label="t('admin.builder.gallery.galleryName')" required>
            <UInput v-model="editor.name" class="w-full" maxlength="120" />
          </UFormField>
          <MzMediaField v-model="editor.media" multiple :kinds="['image', 'video']" :label="t('admin.builder.gallery.photos')" />
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="editor.open = false" />
          <UButton :label="t('common.save')" :loading="editor.saving" :disabled="!editor.name.trim()" data-testid="gallery-save" @click="saveGallery" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="describing.open" :title="t('admin.builder.gallery.describeTitle')">
      <template #body>
        <div class="flex flex-col gap-4">
          <img v-if="describing.photo" :src="describing.photo.url" alt="" class="max-h-48 w-full rounded-xs object-contain">
          <UFormField v-for="l in locales" :key="l.code" :label="`${l.name ?? l.code} (${String(l.code).toUpperCase()})`" :required="l.code === DEFAULT_LOCALE" :hint="t('admin.builder.gallery.altHint')">
            <UTextarea v-model="describing.texts[String(l.code)]" :rows="2" autoresize class="w-full" :dir="l.dir === 'rtl' ? 'rtl' : 'ltr'" :lang="String(l.code)" maxlength="300" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="describing.open = false" />
          <UButton :label="t('common.save')" :loading="describing.saving" @click="saveDescription" />
        </div>
      </template>
    </UModal>
  </div>
</template>
