<script setup lang="ts">
/**
 * Minimal rich text editor (paragraphs, bold, italic, lists, links) producing the HTML subset the
 * API keeps; the API sanitises it again and refuses scripts. Pasted text is inserted as plain text.
 */
const props = withDefaults(defineProps<{ label: string, dir?: 'ltr' | 'rtl', lang?: string }>(), { dir: 'ltr', lang: undefined })
const model = defineModel<string | undefined>()
const { t } = useI18n()
const editor = useTemplateRef<HTMLDivElement>('editor')

onMounted(() => {
  if (editor.value) editor.value.innerHTML = model.value ?? ''
})
watch(model, (v) => {
  if (editor.value && document.activeElement !== editor.value && editor.value.innerHTML !== (v ?? '')) editor.value.innerHTML = v ?? ''
})

function sync() {
  const html = editor.value?.innerHTML ?? ''
  model.value = html.replace(/<br>$/, '').trim() || undefined
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
      @input="sync"
      @blur="sync"
      @paste="paste"
    />
  </div>
</template>
