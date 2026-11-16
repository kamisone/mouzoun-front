<script setup lang="ts">
import type { RevisionSummary } from '~/utils/page-types'
import type { Builder } from '~/composables/useBuilder'

/** Revision history: preview any revision in the frame, restore it into the draft, cancel a scheduled one. */
const props = defineProps<{ builder: Builder, pageId: string, canPublish: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ preview: [revisionId: string | null], restored: [] }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const revisions = ref<RevisionSummary[]>([])
const busy = ref<string | null>(null)
const colors = { published: 'success', scheduled: 'info', superseded: 'neutral', cancelled: 'warning' } as const

async function load() {
  revisions.value = (await api.pages.revisions(props.pageId)).revisions
}
watch(open, o => o && load())

async function restore(r: RevisionSummary) {
  if (!window.confirm(t('admin.builder.revisions.confirmRestore', { n: r.revision_number }))) return
  busy.value = r.id
  try {
    await props.builder.flush()
    const res = await api.pages.restore(r.id)
    await props.builder.load()
    props.builder.setErrors(res.errors)
    toast.add({ title: t('admin.builder.revisions.restored', { n: r.revision_number }), icon: 'i-lucide-history' })
    emit('restored')
    emit('preview', null)
  }
  finally {
    busy.value = null
  }
}
async function cancel(r: RevisionSummary) {
  busy.value = r.id
  try {
    await api.pages.cancel(r.id)
    await load()
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <USlideover v-model:open="open" :title="t('admin.builder.revisions.title')">
    <template #body>
      <MzEmptyState v-if="!revisions.length" icon="i-lucide-history" :title="t('admin.builder.revisions.none')" />
      <ol class="flex flex-col gap-3">
        <li v-for="r in revisions" :key="r.id" class="rounded-sm border border-default p-3">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium">{{ t('admin.builder.revisions.number', { n: r.revision_number }) }}</span>
            <UBadge :label="t(`admin.builder.revisions.status.${r.status}`)" :color="colors[r.status]" variant="subtle" size="sm" />
          </div>
          <p class="mt-1 text-small text-muted">
            <MzDate :value="r.published_at ?? r.publish_at ?? r.created_at" with-time />
            <template v-if="r.published_by ?? r.created_by"> · {{ (r.published_by ?? r.created_by)!.name }}</template>
          </p>
          <p v-if="r.note" class="mt-1 text-small">{{ r.note }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton :label="t('admin.builder.revisions.preview')" icon="i-lucide-eye" size="xs" color="neutral" variant="outline" @click="emit('preview', r.id)" />
            <UButton v-if="props.canPublish" :label="t('admin.builder.revisions.restore')" icon="i-lucide-history" size="xs" color="neutral" variant="outline" :loading="busy === r.id" @click="restore(r)" />
            <UButton v-if="props.canPublish && r.status === 'scheduled'" :label="t('admin.builder.revisions.cancel')" icon="i-lucide-x" size="xs" color="warning" variant="outline" :loading="busy === r.id" @click="cancel(r)" />
          </div>
        </li>
      </ol>
    </template>
  </USlideover>
</template>
