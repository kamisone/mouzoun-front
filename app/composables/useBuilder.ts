import type { BlockDraft, BuilderTree, FieldError, SectionType, SchemaNode } from '~/utils/page-types'
import { blockFromPreset, clone, cloneBlock, forSave } from '~/utils/page-builder'

interface Conflict { current_version: number, saved_by: { id: string, name: string } | null, saved_at: string | null }
type ApiError = { status?: number, data?: { error?: { code?: string, details?: Record<string, unknown> } } }

/**
 * State of the page builder: the draft tree, the selection, autosave (2 s after the last change,
 * with `If-Match: draft_version`), conflicts (409: someone else saved), server validation errors
 * mapped to fields, undo of a deletion, and the live preview (postMessage to the iframe).
 */
export function useBuilder(pageId: string) {
  const api = useAdminApi()
  const toast = useToast()
  const { t } = useI18n()

  const tree = ref<BuilderTree | null>(null)
  const blocks = ref<BlockDraft[]>([])
  const version = ref(0)
  const types = ref<SectionType[]>([])
  const appearanceSchema = ref<SchemaNode>({})
  const canPublish = ref(false)
  const canUseHtml = ref(false)
  const selected = ref<string | null>(null)
  const dirty = ref(false)
  const saving = ref(false)
  const errors = ref<FieldError[]>([])
  const conflict = ref<Conflict | null>(null)
  const lastSaved = ref<Date | null>(null)
  const preview = ref<HTMLIFrameElement | null>(null)

  /** JSON of the last draft the server accepted (or refused as invalid): changes are compared to it. */
  let savedJson = ''
  let refusedJson = ''
  const currentJson = () => JSON.stringify(blocks.value.map(forSave))

  const typeOf = (code: string) => types.value.find(x => x.code === code)
  const selectedBlock = computed(() => blocks.value.find(b => b.id === selected.value) ?? null)

  function apply(next: BuilderTree, replaceBlocks = true) {
    tree.value = next
    version.value = next.draft_version
    if (replaceBlocks) blocks.value = clone(next.blocks)
  }

  async function load() {
    const [builder, sectionTypes] = await Promise.all([api.pages.builder(pageId), api.sectionTypes()])
    types.value = sectionTypes.types
    appearanceSchema.value = sectionTypes.appearance_schema
    canPublish.value = sectionTypes.can_publish
    canUseHtml.value = sectionTypes.can_use_html
    apply(builder)
    savedJson = currentJson()
    dirty.value = false
    conflict.value = null
    errors.value = []
  }

  // ---- Saving -----------------------------------------------------------------------------
  let pending: Promise<void> | null = null
  async function save(): Promise<void> {
    if (pending) {
      await pending
      if (!dirty.value) return
    }
    if (conflict.value) return
    const snapshot = blocks.value.map(forSave)
    const sentJson = JSON.stringify(snapshot)
    if (sentJson === savedJson) {
      dirty.value = false
      return
    }
    saving.value = true
    pending = (async () => {
      try {
        const next = await api.pages.save(pageId, version.value, { blocks: snapshot })
        // Edits made while the request was in flight stay local (and are saved next).
        apply(next, false)
        // Placements get their shared section from the server.
        for (const b of blocks.value) {
          const fresh = next.blocks.find(x => x.id === b.id)
          if (b.shared_block_id && fresh?.shared) b.shared = fresh.shared
        }
        errors.value = []
        lastSaved.value = new Date()
        savedJson = sentJson
        dirty.value = currentJson() !== savedJson
        postToPreview({ type: 'mz:refresh' })
      }
      catch (e) {
        const err = e as ApiError
        const code = err.data?.error?.code
        if (err.status === 409 && code === 'draft_conflict') {
          conflict.value = err.data!.error!.details as unknown as Conflict
        }
        else if (err.status === 422) {
          errors.value = ((err.data?.error?.details?.errors ?? []) as FieldError[])
          refusedJson = sentJson
        }
        else {
          toast.add({ title: t('admin.builder.saveFailed'), color: 'error', icon: 'i-lucide-cloud-off' })
        }
      }
      finally {
        saving.value = false
        pending = null
      }
    })()
    await pending
  }

  const autosave = useDebounceFn(() => save(), 2000)
  watch(blocks, () => {
    if (!tree.value) return
    const json = currentJson()
    dirty.value = json !== savedJson
    if (dirty.value && json !== refusedJson) autosave()
  }, { deep: true })

  /** Saves now (before publishing, leaving, or a server-side operation). */
  async function flush() {
    if (dirty.value || pending) await save()
  }

  // ---- Edits ------------------------------------------------------------------------------
  function select(id: string | null) {
    selected.value = id
    if (id) postToPreview({ type: 'mz:scroll-to', id })
  }

  function add(type: SectionType, position = blocks.value.length) {
    const block = blockFromPreset(type)
    blocks.value.splice(position, 0, block)
    select(block.id)
  }

  function addShared(shared: BlockDraft, position = blocks.value.length) {
    const block: BlockDraft = { ...blockFromPreset(typeOf(shared.type)!), settings: {}, content: {}, items: [], shared_block_id: shared.id, shared }
    blocks.value.splice(position, 0, block)
    select(block.id)
  }

  function duplicate(id: string) {
    const i = blocks.value.findIndex(b => b.id === id)
    if (i < 0) return
    const copy = cloneBlock(blocks.value[i]!)
    if (blocks.value[i]!.shared) copy.shared = blocks.value[i]!.shared
    blocks.value.splice(i + 1, 0, copy)
    select(copy.id)
  }

  function remove(id: string) {
    const i = blocks.value.findIndex(b => b.id === id)
    if (i < 0) return
    const [removed] = blocks.value.splice(i, 1)
    if (selected.value === id) selected.value = null
    toast.add({
      title: t('admin.builder.deleted'),
      icon: 'i-lucide-trash-2',
      actions: [{ label: t('admin.builder.undo'), color: 'neutral', variant: 'outline', onClick: () => { blocks.value.splice(Math.min(i, blocks.value.length), 0, removed!) } }],
    })
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= blocks.value.length || from === to) return
    const [block] = blocks.value.splice(from, 1)
    blocks.value.splice(to, 0, block!)
  }

  /** Moves a section to the shared library and replaces it with a placement. */
  async function convertToShared(id: string) {
    const block = blocks.value.find(b => b.id === id)
    if (!block || block.shared_block_id) return
    const shared = await api.shared.create(forSave({ ...block, name: block.name ?? typeOf(block.type)?.name ?? null }))
    Object.assign(block, { settings: {}, content: {}, items: [], appearance: {}, shared_block_id: shared.id, shared })
    toast.add({ title: t('admin.builder.nowShared'), icon: 'i-lucide-link' })
  }

  /** Server errors under `prefix` (e.g. `/blocks/3`), by path relative to it. */
  function errorsUnder(prefix: string) {
    return errors.value.filter(e => e.path === prefix || e.path.startsWith(`${prefix}/`))
  }
  const errorCount = (blockId: string) => {
    const i = blocks.value.findIndex(b => b.id === blockId)
    return i < 0 ? 0 : errorsUnder(`/blocks/${i}`).length
  }

  // ---- Live preview -----------------------------------------------------------------------
  function postToPreview(message: Record<string, unknown>) {
    preview.value?.contentWindow?.postMessage(JSON.parse(JSON.stringify(message)), window.location.origin)
  }
  const sendSelected = useDebounceFn(() => {
    const block = selectedBlock.value
    if (block) postToPreview({ type: 'mz:preview-section', section: block })
  }, 250)
  watch(selectedBlock, sendSelected, { deep: true })

  useEventListener(window, 'message', (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    const msg = event.data as { type?: string, id?: string }
    if (msg.type === 'mz:select-section' && msg.id) selected.value = msg.id
  })

  // Leaving with unsaved changes.
  useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
    if (dirty.value || saving.value) e.preventDefault()
  })

  function setErrors(list: FieldError[]) {
    errors.value = list
  }

  return {
    setErrors,
    tree, blocks, version, types, appearanceSchema, canPublish, canUseHtml, selected, selectedBlock, dirty, saving, errors, conflict, lastSaved, preview,
    typeOf, load, save, flush, select, add, addShared, duplicate, remove, move, convertToShared, errorsUnder, errorCount, postToPreview,
  }
}

export type Builder = ReturnType<typeof useBuilder>
