<script setup lang="ts">
import type { BlockDraft, FieldError, SchemaNode } from '~/utils/page-types'
import type { Builder } from '~/composables/useBuilder'

/** Edits a shared section of the library: every page that shows it gets unpublished changes. */
const props = defineProps<{ builder: Builder, sharedId: string | null, appearanceSchema: SchemaNode }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [block: BlockDraft] }>()
const { t } = useI18n()
const api = useAdminApi()
const toast = useToast()
const block = ref<BlockDraft | null>(null)
const usages = ref(0)
const errors = ref<FieldError[]>([])
const busy = ref(false)
const type = computed(() => (block.value ? props.builder.typeOf(block.value.type) : undefined))

watch(open, async (o) => {
  if (!o || !props.sharedId) return
  errors.value = []
  block.value = await api.shared.get(props.sharedId)
  usages.value = (await api.shared.usages(props.sharedId)).usages.length
})
async function save() {
  if (!block.value || !props.sharedId) return
  busy.value = true
  try {
    const saved = await api.shared.update(props.sharedId, block.value)
    emit('saved', saved)
    toast.add({ title: t('admin.builder.shared.saved', { n: usages.value }), color: 'success' })
    open.value = false
  }
  catch (e) {
    const err = e as { data?: { error?: { details?: { errors?: FieldError[] } } } }
    errors.value = (err.data?.error?.details?.errors ?? []).map(x => ({ ...x, path: `/blocks/0${x.path}` }))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <USlideover v-model:open="open" :title="t('admin.builder.shared.editTitle')" :description="t('admin.builder.shared.usedOn', { n: usages })" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <MzBuilderSectionForm v-if="block && type" v-model="block" :type="type" :index="0" :errors="errors" :appearance-schema="props.appearanceSchema" />
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton :label="t('common.save')" :loading="busy" @click="save" />
      </div>
    </template>
  </USlideover>
</template>
