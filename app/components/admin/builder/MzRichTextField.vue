<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Ref } from 'vue'

/**
 * Minimal rich text editor (paragraphs, bold, italic, lists, links) producing the HTML subset the
 * API keeps; the API sanitises it again and refuses scripts. Pasted text is inserted as plain text.
 * On legal pages, "Insert company field" adds a token such as `{{seller.siren}}` at the cursor:
 * the page shows the value from Admin › Settings › Legal entity (the list comes from the API, so
 * only tokens the renderer knows can be inserted).
 */
const props = withDefaults(defineProps<{ label: string, dir?: 'ltr' | 'rtl', lang?: string }>(), { dir: 'ltr', lang: undefined })
const model = defineModel<string | undefined>()
const { t } = useI18n()
const editor = useTemplateRef<HTMLDivElement>('editor')

// ---- Company field tokens (legal pages only) ---------------------------------------------------
const pageType = inject<Ref<string | undefined> | undefined>('builder-page-type', undefined)
const isLegal = computed(() => pageType?.value === 'legal')
const PICKED = ['seller.', 'mediator.', 'host.', 'shop.']
const api = useAdminApi()
const tokens = ref<string[]>([])
watch(isLegal, async (legal) => {
  if (!legal || tokens.value.length) return
  try {
    tokens.value = (await api.pages.legalTokens()).tokens.filter(tk => PICKED.some(p => tk.startsWith(p)))
  }
  catch { /* no picker without the list */ }
}, { immediate: true })
const tokenItems = computed<DropdownMenuItem[][]>(() => PICKED.map(prefix => tokens.value
  .filter(tk => tk.startsWith(prefix))
  .map(tk => ({ label: t(`admin.builder.tokens.${tk.replace('.', '_')}`), description: `{{${tk}}}`, onSelect: () => insertToken(tk) })))
  .filter(g => g.length))
// The cursor is lost when the menu takes the focus: keep the last range inside the editor.
let range: Range | null = null
function keepRange() {
  const sel = window.getSelection()
  if (sel?.rangeCount && editor.value?.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange()
}
function insertToken(token: string) {
  const el = editor.value
  if (!el) return
  el.focus()
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    if (range) {
      sel.addRange(range)
    }
    else {
      const end = document.createRange()
      end.selectNodeContents(el)
      end.collapse(false)
      sel.addRange(end)
    }
  }
  const text = `{{${token}}}`
  const done = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text)
  if (!done) {
    // No editing command (some browsers, tests): insert a text node at the cursor.
    const at = sel?.rangeCount ? sel.getRangeAt(0) : null
    if (at && el.contains(at.startContainer)) {
      at.deleteContents()
      const node = document.createTextNode(text)
      at.insertNode(node)
      at.setStartAfter(node)
      at.collapse(true)
    }
    else {
      el.append(text)
    }
  }
  sync()
  keepRange()
}

onMounted(() => {
  if (editor.value) editor.value.innerHTML = model.value ?? ''
  // Enter makes a new <p> (Chrome's default is <div>, which the API does not keep).
  if (typeof document.execCommand === 'function') document.execCommand('defaultParagraphSeparator', false, 'p')
})
watch(model, (v) => {
  if (editor.value && document.activeElement !== editor.value && editor.value.innerHTML !== (v ?? '')) editor.value.innerHTML = v ?? ''
})

/**
 * Copies the editor's HTML into the model. Without the element nothing is written: when a tab
 * switch removes the focused editor, the browser blurs it after Vue cleared the ref, and reading
 * "no element" as "empty text" used to wipe the language being edited (then autosaved). Typing
 * already synced on input, so there is nothing to keep at that point.
 */
function sync() {
  const el = editor.value
  if (!el) return
  model.value = paragraphs(el.innerHTML.replace(/<br>$/, '').trim()) || undefined
}

const BLOCKS = new Set(['P', 'UL', 'OL', 'H3', 'H4', 'BLOCKQUOTE'])
/**
 * The HTML in the subset the API keeps: a line the browser made as a `<div>` becomes a `<p>`,
 * and text typed straight into the box (after "select all, delete") is wrapped in a `<p>`. The
 * API drops `<div>` but keeps its text, so lines used to be glued together on save.
 * The editor itself is left alone (the caret stays put); only the saved value changes.
 */
function paragraphs(html: string): string {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  const root = tpl.content
  if (!root.textContent?.trim()) return ''
  let para: HTMLParagraphElement | null = null
  let node = root.firstChild
  while (node) {
    const next = node.nextSibling
    if (node instanceof HTMLElement && node.tagName === 'DIV') {
      if ([...node.children].some(c => BLOCKS.has(c.tagName) || c.tagName === 'DIV')) {
        // A wrapper around blocks (lists, other lines): unwrap it, then look at its children.
        const first = node.firstChild
        node.replaceWith(...node.childNodes)
        node = first ?? next
        continue
      }
      const p = document.createElement('p')
      p.append(...node.childNodes)
      node.replaceWith(p)
      para = null
    }
    else if (node instanceof HTMLElement && BLOCKS.has(node.tagName)) {
      para = null
    }
    else if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim() && !para) {
      node.remove()
    }
    else {
      if (!para) {
        para = document.createElement('p')
        node.before(para)
      }
      para.append(node)
    }
    node = next
  }
  return tpl.innerHTML
}
function exec(command: string, value?: string) {
  editor.value?.focus()
  document.execCommand(command, false, value)
  sync()
}
function link() {
  const url = window.prompt(t('admin.builder.richtext.linkPrompt'), 'https://')
  if (url && /^(https:|mailto:|tel:)/.test(url)) exec('createLink', url)
}
function paste(e: ClipboardEvent) {
  e.preventDefault()
  document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '')
  sync()
}
</script>

<template>
  <div class="rounded-sm border border-default focus-within:ring-1 focus-within:ring-primary">
    <div class="flex gap-1 border-b border-default p-1" role="toolbar" :aria-label="t('admin.builder.richtext.toolbar')">
      <UButton icon="i-lucide-bold" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.builder.richtext.bold')" @mousedown.prevent="exec('bold')" />
      <UButton icon="i-lucide-italic" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.builder.richtext.italic')" @mousedown.prevent="exec('italic')" />
      <UButton icon="i-lucide-list" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.builder.richtext.list')" @mousedown.prevent="exec('insertUnorderedList')" />
      <UButton icon="i-lucide-list-ordered" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.builder.richtext.orderedList')" @mousedown.prevent="exec('insertOrderedList')" />
      <UButton icon="i-lucide-link" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.builder.richtext.link')" @mousedown.prevent="link" />
      <UButton icon="i-lucide-remove-formatting" size="xs" color="neutral" variant="ghost" :aria-label="t('admin.builder.richtext.clear')" @mousedown.prevent="exec('removeFormat')" />
      <UDropdownMenu v-if="isLegal && tokenItems.length" :items="tokenItems" :content="{ align: 'end' }" :ui="{ content: 'max-h-80' }">
        <UButton :label="t('admin.builder.tokens.insert')" icon="i-lucide-building-2" size="xs" color="neutral" variant="ghost" class="ms-auto" data-testid="insert-token" @mousedown="keepRange" />
      </UDropdownMenu>
    </div>
    <div
      ref="editor"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :aria-label="props.label"
      :dir="props.dir"
      :lang="props.lang"
      class="mz-prose min-h-32 px-3 py-2 text-small focus:outline-none [&_p]:text-small"
      @input="sync(); keepRange()"
      @keyup="keepRange"
      @mouseup="keepRange"
      @blur="sync()"
      @paste="paste"
    />
  </div>
</template>
