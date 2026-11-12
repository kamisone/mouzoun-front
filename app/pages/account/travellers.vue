<script setup lang="ts">
import type { SavedTraveller } from '~/utils/account-types'
import { countries } from '~/utils/contact'

/**
 * Saved travellers: the people you travel with, to fill bookings and the pre-check-in in one
 * tap. An ID number is kept only with explicit consent, encrypted, and shown again only after
 * confirming it's you.
 */
definePageMeta({ middleware: 'account' })
const { t, locale } = useI18n()
const api = useAccountApi()
const toast = useToast()
const reauth = useReauth()
const { data: categories } = useGuestCategories()
const { date } = useDate()

const travellers = ref<SavedTraveller[]>([])
const idEnabled = ref(false)
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    const res = await api.travellers.list()
    travellers.value = res.travellers
    idEnabled.value = res.id_numbers_enabled
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

type DocType = 'passport' | 'national_id' | 'residence_permit' | 'driving_licence' | 'other'
const docTypes = computed(() => (['passport', 'national_id', 'residence_permit', 'driving_licence', 'other'] as const).map(v => ({ value: v, label: t(`booking.precheckin.docs.${v}`) })))
const countryItems = computed(() => countries(locale.value))
const categoryItems = computed(() => (categories.value ?? []).map(c => ({ value: c.id, label: c.name })))

const open = ref(false)
const editing = ref<SavedTraveller | null>(null)
const form = reactive({
  first_name: '',
  last_name: '',
  guest_category_id: undefined as string | undefined,
  date_of_birth: '',
  nationality: undefined as string | undefined,
  id_document_type: undefined as DocType | undefined,
  id_document_number: '',
  id_consent: false,
})
const errors = reactive<Record<string, string | undefined>>({})
const saving = ref(false)

function edit(trav: SavedTraveller | null) {
  editing.value = trav
  Object.assign(form, {
    first_name: trav?.first_name ?? '',
    last_name: trav?.last_name ?? '',
    guest_category_id: trav?.guest_category_id ?? undefined,
    date_of_birth: trav?.date_of_birth ?? '',
    nationality: trav?.nationality ?? undefined,
    id_document_type: (trav?.id_document_type ?? undefined) as DocType | undefined,
    id_document_number: '',
    id_consent: !!trav?.id_consent_at,
  })
  Object.keys(errors).forEach((k) => { errors[k] = undefined })
  open.value = true
}

async function save() {
  errors.first_name = form.first_name.trim() ? undefined : t('validation.required')
  errors.last_name = form.last_name.trim() ? undefined : t('validation.required')
  errors.id_consent = form.id_document_number.trim() && !form.id_consent ? t('account.travellers.consentNeeded') : undefined
  if (Object.values(errors).some(Boolean)) return
  saving.value = true
  const body = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    guest_category_id: form.guest_category_id ?? null,
    date_of_birth: form.date_of_birth || null,
    nationality: form.nationality ?? null,
    id_document_type: form.id_document_type ?? null,
    id_document_number: form.id_document_number.trim() || null,
    id_consent: form.id_consent,
  }
  try {
    if (editing.value) await api.travellers.update(editing.value.id, body)
    else await api.travellers.create(body)
    open.value = false
    await load()
    toast.add({ title: t('account.saved'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    toast.add({ title: t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

const deleting = ref<SavedTraveller | null>(null)
const deleteOpen = computed({ get: () => !!deleting.value, set: (v: boolean) => { if (!v) deleting.value = null } })
async function remove() {
  if (!deleting.value) return
  await api.travellers.remove(deleting.value.id)
  deleting.value = null
  await load()
}

const revealed = reactive<Record<string, string | null>>({})
async function reveal(trav: SavedTraveller) {
  const res = await reauth.guard(() => api.travellers.reveal(trav.id)).catch(() => undefined)
  if (res) revealed[trav.id] = res.id_document_number
}
</script>

<template>
  <MzAccountShell :title="t('account.nav.travellers')" :description="t('account.travellers.intro')">
    <div v-if="loading" aria-busy="true" class="flex flex-col gap-3"><MzSkeleton v-for="i in 2" :key="i" class="h-20" /></div>
    <template v-else>
      <MzEmptyState v-if="!travellers.length" icon="i-lucide-users-round" :title="t('account.travellers.empty')" :description="t('account.travellers.emptyText')" />
      <ul v-else class="flex flex-col gap-3">
        <li v-for="trav in travellers" :key="trav.id" class="flex flex-wrap items-center justify-between gap-3 rounded-sm p-4 ring ring-default">
          <div class="flex flex-col gap-1">
            <span class="font-medium text-highlighted">{{ trav.first_name }} {{ trav.last_name }}</span>
            <span class="text-small text-muted">
              <template v-if="trav.date_of_birth">{{ date(trav.date_of_birth) }}</template>
              <template v-if="trav.id_document_type"> · {{ t(`booking.precheckin.docs.${trav.id_document_type}`) }}</template>
              <template v-if="trav.has_id_document">
                · <span dir="ltr">{{ revealed[trav.id] ?? '••••••' }}</span>
              </template>
            </span>
          </div>
          <div class="flex flex-wrap gap-1">
            <UButton v-if="trav.has_id_document && !revealed[trav.id]" :label="t('account.travellers.show')" icon="i-lucide-eye" color="neutral" variant="ghost" size="sm" @click="reveal(trav)" />
            <UButton :label="t('common.edit')" icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" @click="edit(trav)" />
            <UButton :label="t('common.delete')" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" @click="deleting = trav" />
          </div>
        </li>
      </ul>
      <UButton :label="t('account.travellers.add')" icon="i-lucide-plus" class="self-start" @click="edit(null)" />
    </template>

    <UModal v-model:open="open" :title="editing ? t('account.travellers.edit') : t('account.travellers.add')">
      <template #body>
        <form id="traveller-form" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="save">
          <UFormField :label="t('account.profile.firstName')" :error="errors.first_name" required>
            <UInput v-model="form.first_name" class="w-full" />
          </UFormField>
          <UFormField :label="t('account.profile.lastName')" :error="errors.last_name" required>
            <UInput v-model="form.last_name" class="w-full" />
          </UFormField>
          <UFormField v-if="categoryItems.length" :label="t('account.travellers.category')" :hint="t('common.optional')">
            <USelect v-model="form.guest_category_id" :items="categoryItems" class="w-full" />
          </UFormField>
          <UFormField :label="t('booking.precheckin.birthDate')" :hint="t('common.optional')">
            <UInput v-model="form.date_of_birth" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('booking.precheckin.nationality')" :hint="t('common.optional')">
            <USelectMenu v-model="form.nationality" :items="countryItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('booking.precheckin.docType')" :hint="t('common.optional')">
            <USelect v-model="form.id_document_type" :items="docTypes" class="w-full" />
          </UFormField>
          <template v-if="idEnabled">
            <UFormField
              :label="t('booking.precheckin.docNumber')"
              :help="editing?.has_id_document ? t('booking.precheckin.docStored') : undefined"
              :hint="t('common.optional')"
              class="sm:col-span-2"
            >
              <UInput v-model="form.id_document_number" autocomplete="off" dir="ltr" class="w-full" />
            </UFormField>
            <UFormField :error="errors.id_consent" class="sm:col-span-2">
              <UCheckbox v-model="form.id_consent" :label="t('account.travellers.consent')" :description="t('booking.precheckin.privacy')" />
            </UFormField>
          </template>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" form="traveller-form" :label="t('common.save')" :loading="saving" />
        </div>
      </template>
    </UModal>
    <MzConfirmDialog v-model:open="deleteOpen" danger :title="t('account.travellers.confirmDelete', { name: deleting?.first_name ?? '' })" :confirm-label="t('common.delete')" @confirm="remove" />
  </MzAccountShell>
</template>
