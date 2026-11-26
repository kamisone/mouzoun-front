<script setup lang="ts">
import type { Media } from '~/utils/types'
import { acceptedTypes, formatList } from '~/composables/useMediaUpload'

/**
 * Picks one file (or several, in order) from the media library, or uploads a new one through
 * the API (multipart upload). Stores media ids only.
 *
 * Every field says what it is for: `purpose` (`media.purposes.<purpose>.title | hint | button`)
 * gives its title, a one-line hint and the upload button's name; the accepted formats and the
 * size limit, from `kinds`, close the hint. `label` / `hint` / `button` override them.
 */
const props = withDefaults(defineProps<{
  multiple?: boolean
  kinds?: string[]
  /** Key under `media.purposes` (cover, video, gallery, builder.video.media_id...). */
  purpose?: string
  label?: string
  hint?: string
  button?: string
}>(), { multiple: false, kinds: () => ['image'], purpose: undefined, label: undefined, hint: undefined, button: undefined })
const model = defineModel<string | string[] | undefined>()
const { t, te } = useI18n()
const api = useAdminApi()
const { upload, uploading, error: uploadError } = useMediaUpload(() => props.kinds)
const open = ref(false)
const library = ref<Media[]>([])
const page = ref(1)
const total = ref(0)
const cache = ref<Record<string, Media>>({})
const input = useTemplateRef<HTMLInputElement>('file')
const uid = useId()

const text = (part: 'title' | 'hint' | 'button') => {
  const key = props.purpose ? `media.purposes.${props.purpose}.${part}` : ''
  return key && te(key) ? t(key) : undefined
}
const fallbackKind = computed(() => (props.kinds.includes('video') && !props.kinds.includes('image') ? 'video' : props.multiple ? 'images' : 'image'))
const title = computed(() => props.label ?? text('title') ?? t(`media.purposes.generic.${fallbackKind.value}.title`))
const hint = computed(() => [props.hint ?? text('hint'), formatList(props.kinds, t)].filter(Boolean).join(' '))
const buttonLabel = computed(() => props.button ?? text('button') ?? t(`media.purposes.generic.${fallbackKind.value}.button`))
const accept = computed(() => acceptedTypes(props.kinds).join(','))

const ids = computed(() => (Array.isArray(model.value) ? model.value : model.value ? [model.value] : []))
async function loadLibrary() {
  const kind = props.kinds.length === 1 ? (props.kinds[0] as Media['kind']) : undefined
  const res = await api.media.list({ kind, page: page.value, per_page: 24 })
  library.value = res.data.filter(m => props.kinds.includes(m.kind))
  total.value = res.total
  for (const m of res.data) cache.value[m.id] = m
}
onMounted(async () => {
  for (const id of ids.value) {
    if (!cache.value[id]) cache.value[id] = await api.media.get(id).catch(() => ({ id, url: '' } as Media))
  }
})
watch(open, o => o && loadLibrary())
watch(page, loadLibrary)

function choose(m: Media) {
  cache.value[m.id] = m
  if (props.multiple) {
    model.value = ids.value.includes(m.id) ? ids.value.filter(x => x !== m.id) : [...ids.value, m.id]
  }
  else {
    model.value = m.id
    open.value = false
  }
}
async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const media = await upload(file)
  if (media) choose(media)
  if (input.value) input.value.value = ''
}
function remove(id: string) {
  model.value = props.multiple ? ids.value.filter(x => x !== id) : undefined
}
</script>

<template>
  <div class="flex flex-col gap-2" role="group" :aria-labelledby="`${uid}-title`" :aria-describedby="`${uid}-hint`" data-testid="media-field">
    <div>
      <p :id="`${uid}-title`" class="text-small font-medium" data-testid="media-field-title">{{ title }}</p>
      <p :id="`${uid}-hint`" class="text-caption text-muted" data-testid="media-field-hint">{{ hint }}</p>
    </div>
    <ul v-if="ids.length" class="grid grid-cols-3 gap-2">
      <li v-for="id in ids" :key="id" class="group relative aspect-square overflow-hidden rounded-xs bg-muted">
        <img v-if="cache[id]?.url && cache[id]?.kind !== 'video'" :src="cache[id]!.url" alt="" class="size-full object-cover">
        <span v-else-if="cache[id]?.kind === 'video'" class="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-caption" data-testid="media-field-video">
          <UIcon name="i-lucide-film" class="size-6 text-muted" aria-hidden="true" />
          <span class="line-clamp-2 break-all">{{ cache[id]!.original_filename }}</span>
        </span>
        <UButton icon="i-lucide-x" size="xs" color="neutral" class="absolute end-1 top-1" :aria-label="t('common.delete')" @click="remove(id)" />
      </li>
    </ul>
    <div class="flex flex-wrap gap-2">
      <UButton :label="buttonLabel" icon="i-lucide-upload" size="sm" color="neutral" variant="outline" :loading="uploading" data-testid="media-field-upload" @click="input?.click()" />
      <UButton :label="ids.length && !props.multiple ? t('admin.builder.media.replace') : t('admin.builder.media.choose')" icon="i-lucide-images" size="sm" color="neutral" variant="ghost" @click="open = true" />
      <input ref="file" type="file" class="sr-only" :accept="accept" tabindex="-1" aria-hidden="true" @change="onFile">
    </div>
    <UAlert v-if="uploadError" :title="uploadError" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
    <UModal v-model:open="open" :title="title" :ui="{ content: 'max-w-4xl' }">
      <template #body>
        <ul class="grid grid-cols-3 gap-3 sm:grid-cols-4">
          <li v-for="m in library" :key="m.id">
            <button type="button" class="relative block aspect-square w-full overflow-hidden rounded-xs bg-muted" :class="ids.includes(m.id) && 'ring-2 ring-primary'" :aria-pressed="ids.includes(m.id)" :aria-label="m.original_filename" @click="choose(m)">
              <img v-if="m.kind === 'image'" :src="m.url" alt="" loading="lazy" class="size-full object-cover">
              <span v-else class="flex size-full flex-col items-center justify-center gap-1 p-2 text-caption">
                <UIcon v-if="m.kind === 'video'" name="i-lucide-film" class="size-6 text-muted" aria-hidden="true" />{{ m.original_filename }}
              </span>
            </button>
          </li>
        </ul>
        <MzEmptyState v-if="!library.length" icon="i-lucide-image-off" :title="t('admin.builder.media.empty')" />
        <UPagination v-if="total > 24" v-model:page="page" :total="total" :items-per-page="24" class="mt-4" />
      </template>
    </UModal>
  </div>
</template>
