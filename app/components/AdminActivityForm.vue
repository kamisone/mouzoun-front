<script setup lang="ts">
import type { Activity, ActivityInput } from '~/utils/types'

const props = defineProps<{ id?: string }>()
const api = useAdminApi()
const { upload, uploading, error: uploadError } = useMediaUpload()
const coverPreview = ref<string | null>(null)

const form = reactive<ActivityInput>({
  slug: '',
  title_fr: '',
  title_en: '',
  description_fr: '',
  description_en: '',
  price_mad: 0,
  duration_minutes: 60,
  cover_media_id: null,
  is_published: false,
})
const error = ref('')
const saving = ref(false)

onMounted(async () => {
  if (!props.id) return
  const a = await api<Activity>(`/v1/activities/id/${props.id}`)
  Object.assign(form, {
    slug: a.slug,
    title_fr: a.title_fr,
    title_en: a.title_en,
    description_fr: a.description_fr,
    description_en: a.description_en,
    price_mad: a.price_mad,
    duration_minutes: a.duration_minutes,
    cover_media_id: a.cover_media_id,
    is_published: a.is_published,
  })
  coverPreview.value = a.cover_image_url
})

async function onCoverSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const media = await upload(file)
  if (media) {
    form.cover_media_id = media.id
    coverPreview.value = media.url
  }
  input.value = ''
}

function removeCover() {
  form.cover_media_id = null
  coverPreview.value = null
}

async function save() {
  error.value = ''
  saving.value = true
  const body = { ...form }
  try {
    if (props.id) await api(`/v1/activities/id/${props.id}`, { method: 'PUT', body })
    else await api('/v1/activities', { method: 'POST', body })
    await navigateTo('/admin/activities')
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 409 ? 'Ce slug existe déjà' : 'Vérifiez les champs du formulaire'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <h1 class="mb-6 text-2xl font-bold">{{ id ? "Modifier l'activité" : 'Nouvelle activité' }}</h1>
  <form class="max-w-3xl space-y-4 rounded-xl bg-white p-6 shadow-sm" @submit.prevent="save">
    <label class="block text-sm">
      Slug (URL)
      <input v-model="form.slug" class="input mt-1" required pattern="[a-z0-9-]+" />
    </label>
    <div class="grid gap-4 md:grid-cols-2">
      <label class="block text-sm">Titre (FR)<input v-model="form.title_fr" class="input mt-1" required /></label>
      <label class="block text-sm">Title (EN)<input v-model="form.title_en" class="input mt-1" required /></label>
      <label class="block text-sm">
        Description (FR)
        <textarea v-model="form.description_fr" rows="5" class="input mt-1" />
      </label>
      <label class="block text-sm">
        Description (EN)
        <textarea v-model="form.description_en" rows="5" class="input mt-1" />
      </label>
      <label class="block text-sm">
        Prix (MAD)
        <input v-model.number="form.price_mad" type="number" min="0" class="input mt-1" />
      </label>
      <label class="block text-sm">
        Durée (minutes)
        <input v-model.number="form.duration_minutes" type="number" min="0" class="input mt-1" />
      </label>
    </div>
    <div class="text-sm">
      <div class="mb-1">Image de couverture</div>
      <div class="flex items-start gap-4">
        <img v-if="coverPreview" :src="coverPreview" alt="" class="h-28 w-40 rounded-lg object-cover" />
        <div class="space-y-2">
          <input
            type="file"
            :accept="ACCEPTED_IMAGE_TYPES.join(',')"
            :disabled="uploading"
            class="block text-sm"
            @change="onCoverSelected"
          />
          <p class="text-xs text-gray-500">JPEG, PNG, WebP ou AVIF — 15 Mo max.</p>
          <p v-if="uploading" class="text-xs text-gray-500">Envoi en cours…</p>
          <p v-if="uploadError" class="text-xs text-red-600">{{ uploadError }}</p>
          <button v-if="coverPreview" type="button" class="text-xs text-red-600 hover:underline" @click="removeCover">
            Retirer l'image
          </button>
        </div>
      </div>
    </div>
    <label class="flex items-center gap-2 text-sm"><input v-model="form.is_published" type="checkbox" /> Publié</label>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div class="flex gap-2">
      <button class="btn" :disabled="saving || uploading">Enregistrer</button>
      <NuxtLink to="/admin/activities" class="btn-ghost">Annuler</NuxtLink>
    </div>
  </form>
</template>
