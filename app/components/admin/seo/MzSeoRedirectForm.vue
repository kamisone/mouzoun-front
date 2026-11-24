<script setup lang="ts">
import type { AdminRedirect } from '~/utils/seo-admin-api'

/**
 * Add or edit a redirect: `from_path` is normalised on blur and refused when it is live content;
 * `to_path` offers live addresses of every language, or takes an https:// URL (external warning).
 * Loops and chains are reported inline by the API. Editing an automatic redirect makes it manual.
 */
const props = defineProps<{ redirect: AdminRedirect | null, prefill: { from_path: string, to_path?: string } | null, codes: number[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const admin = useAdminApi()
const toast = useToast()

const form = reactive({ from_path: '', to_path: '', status_code: 301, note: '' })
const errors = ref<Record<string, string>>({})
watch(open, (o) => {
  if (!o) return
  errors.value = {}
  const r = props.redirect
  Object.assign(form, r
    ? { from_path: r.from_path, to_path: r.to_path, status_code: r.status_code, note: r.note ?? '' }
    : { from_path: props.prefill?.from_path ?? '', to_path: props.prefill?.to_path ?? '', status_code: 301, note: '' })
}, { immediate: true })

/** Same rule as the site: decoded, NFC, no trailing or double slash. */
function normalise(raw: string) {
  let p = raw.trim().replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0] ?? ''
  if (!p) return ''
  if (!p.startsWith('/')) p = `/${p}`
  try {
    p = decodeURIComponent(p)
  }
  catch { /* keep it */ }
  p = p.normalize('NFC').replace(/\/{2,}/g, '/')
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}
const external = computed(() => form.to_path.trim().startsWith('https://'))

// Autocomplete over live addresses.
const live = ref<{ label: string, value: string, description: string }[]>([])
watchDebounced(() => form.to_path, async (q) => {
  if (!open.value || external.value) return
  const res = await admin.seo.livePaths(q).catch(() => ({ data: [] }))
  live.value = res.data.map(p => ({ label: p.path, value: p.path, description: `${p.locale.toUpperCase()} · ${t(`admin.seo.types.${p.entity_type}`)}` }))
}, { debounce: 250, immediate: true })

const saving = ref(false)
async function save() {
  errors.value = {}
  saving.value = true
  try {
    const body = { from_path: normalise(form.from_path), to_path: external.value ? form.to_path.trim() : normalise(form.to_path), status_code: form.status_code, note: form.note }
    if (props.redirect) await admin.seo.updateRedirect(props.redirect.id, body)
    else await admin.seo.createRedirect(body)
    toast.add({ title: t('admin.seo.redirects.saved'), color: 'success' })
    emit('saved')
  }
  catch (e) {
    const fields = (e as { data?: { error?: { details?: { fields?: Record<string, string> } } } }).data?.error?.details?.fields
    if (fields) errors.value = fields
    else toast.add({ title: t('shop.errors.generic'), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
const err = (f: string) => (errors.value[f] ? t(`admin.seo.errors.${errors.value[f]}`) : undefined)
</script>

<template>
  <MzFormDrawer v-model:open="open" :title="props.redirect ? t('admin.seo.redirects.edit') : t('admin.seo.redirects.add')" form-id="redirect-form" :loading="saving">
    <form id="redirect-form" class="flex flex-col gap-4" data-testid="redirect-form" @submit.prevent="save">
      <UAlert v-if="props.redirect?.source === 'auto'" color="info" variant="soft" icon="i-lucide-info" :title="t('admin.seo.redirects.autoBecomesManual')" />
      <UFormField :label="t('admin.seo.redirects.columns.from_path')" name="from_path" required :error="err('from_path')" :help="t('admin.seo.redirects.fromHelp')">
        <UInput v-model="form.from_path" class="w-full font-mono" dir="ltr" data-testid="redirect-from" @blur="form.from_path = normalise(form.from_path)" />
      </UFormField>
      <UFormField :label="t('admin.seo.redirects.columns.to_path')" name="to_path" required :error="err('to_path')" :help="external ? t('admin.seo.redirects.externalWarning') : t('admin.seo.redirects.toHelp')">
        <UInput v-model="form.to_path" class="w-full font-mono" dir="ltr" autocomplete="off" data-testid="redirect-to" />
        <ul v-if="!external && live.length && !live.some(l => l.value === form.to_path)" class="mt-2 flex flex-col rounded-md border border-default" :aria-label="t('admin.seo.redirects.suggestions')">
          <li v-for="l in live.slice(0, 6)" :key="l.value">
            <button type="button" class="flex w-full items-center justify-between gap-2 px-2 py-1 text-start text-small hover:bg-elevated" @click="form.to_path = l.value">
              <span class="truncate font-mono" dir="ltr">{{ l.label }}</span><span class="shrink-0 text-caption text-muted">{{ l.description }}</span>
            </button>
          </li>
        </ul>
      </UFormField>
      <UFormField :label="t('admin.seo.redirects.columns.status_code')" name="status_code" :error="err('status_code')">
        <USelect v-model="form.status_code" :items="props.codes.map(c => ({ value: c, label: t(`admin.seo.codes.${c}`) }))" class="w-full" />
      </UFormField>
      <UFormField :label="t('admin.seo.redirects.note')" name="note">
        <UTextarea v-model="form.note" :rows="2" class="w-full" />
      </UFormField>
    </form>
  </MzFormDrawer>
</template>
