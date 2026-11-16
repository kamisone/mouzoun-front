<script setup lang="ts">
import type { PublishCheck } from '~/utils/page-types'
import type { Builder } from '~/composables/useBuilder'
import { fromCampLocal } from '~/utils/camp-datetime'

/**
 * Publish now or schedule (camp time), with an optional note. Shows what changes compared with
 * the published revision (sections added, removed, changed, reordered) and the validation
 * errors that block publishing, with a link to each faulty section.
 */
const props = defineProps<{ builder: Builder, pageId: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ published: [] }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const b = props.builder
const check = ref<PublishCheck | null>(null)
const mode = ref<'now' | 'schedule'>('now')
const when = ref('')
const note = ref('')
const busy = ref(false)

watch(open, async (o) => {
  if (!o) return
  check.value = null
  await b.flush()
  check.value = await api.pages.publishCheck(props.pageId)
})

const blockOf = (path: string) => b.blocks.value[Number(path.split('/')[2])]
function goTo(path: string) {
  const block = blockOf(path)
  if (block) b.select(block.id)
  open.value = false
}
async function publish() {
  busy.value = true
  try {
    const at = mode.value === 'schedule' ? fromCampLocal(when.value) : null
    const { revision } = await api.pages.publish(props.pageId, { publish_at: at, note: note.value || null })
    toast.add({
      title: revision.status === 'scheduled' ? t('admin.builder.publish.scheduled', { n: revision.revision_number }) : t('admin.builder.publish.done', { n: revision.revision_number }),
      color: 'success',
      icon: 'i-lucide-check',
    })
    open.value = false
    note.value = ''
    emit('published')
  }
  catch (e) {
    const err = e as { data?: { error?: { details?: { errors?: PublishCheck['errors'] } } } }
    if (err.data?.error?.details?.errors && check.value) check.value = { ...check.value, errors: err.data.error.details.errors }
    else toast.add({ title: t('admin.builder.publish.failed'), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('admin.builder.publish.title')">
    <template #body>
      <div v-if="!check" class="flex justify-center py-8"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
      <div v-else class="flex flex-col gap-6">
        <div v-if="check.errors.length" class="flex flex-col gap-2" data-testid="publish-errors">
          <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('admin.builder.publish.blocked', { n: check.errors.length })" />
          <ul class="flex flex-col gap-1 text-small">
            <li v-for="e in check.errors" :key="e.path + e.code">
              <button type="button" class="text-start underline" @click="goTo(e.path)">{{ blockOf(e.path)?.name ?? b.typeOf(blockOf(e.path)?.type ?? '')?.name ?? e.path }}</button> : {{ e.message }}
            </li>
          </ul>
        </div>
        <section>
          <h3 class="mb-2 text-small font-medium">{{ check.published_revision ? t('admin.builder.publish.changes', { n: check.published_revision }) : t('admin.builder.publish.first') }}</h3>
          <ul class="flex flex-col gap-1 text-small" data-testid="publish-diff">
            <li v-for="s in check.diff.added" :key="`a${s.id}`"><UBadge :label="t('admin.builder.publish.added')" color="success" variant="subtle" size="sm" /> {{ s.name ?? s.title ?? b.typeOf(s.type)?.name }}</li>
            <li v-for="s in check.diff.changed" :key="`c${s.id}`"><UBadge :label="t('admin.builder.publish.changed')" color="info" variant="subtle" size="sm" /> {{ s.name ?? s.title ?? b.typeOf(s.type)?.name }}</li>
            <li v-for="s in check.diff.removed" :key="`r${s.id}`"><UBadge :label="t('admin.builder.publish.removed')" color="error" variant="subtle" size="sm" /> {{ s.name ?? s.title ?? b.typeOf(s.type)?.name }}</li>
            <li v-if="check.diff.moved">{{ t('admin.builder.publish.moved') }}</li>
            <li v-if="!check.diff.added.length && !check.diff.changed.length && !check.diff.removed.length && !check.diff.moved" class="text-muted">{{ t('admin.builder.publish.noChange') }}</li>
          </ul>
        </section>
        <URadioGroup v-model="mode" :items="[{ label: t('admin.builder.publish.now'), value: 'now' }, { label: t('admin.builder.publish.schedule'), value: 'schedule' }]" orientation="horizontal" />
        <UFormField v-if="mode === 'schedule'" :label="t('admin.builder.publish.when')" :hint="t('admin.builder.schedule.timezone')" required>
          <UInput v-model="when" type="datetime-local" />
        </UFormField>
        <UFormField :label="t('admin.builder.publish.note')">
          <UInput v-model="note" class="w-full" :placeholder="t('admin.builder.publish.notePlaceholder')" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          :label="mode === 'schedule' ? t('admin.builder.publish.scheduleAction') : t('admin.builder.publish.nowAction')"
          :loading="busy"
          :disabled="!check || !!check.errors.length || (mode === 'schedule' && !when)"
          data-testid="publish-confirm"
          @click="publish"
        />
      </div>
    </template>
  </UModal>
</template>
