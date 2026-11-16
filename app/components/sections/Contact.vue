<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Phone, WhatsApp, email and a contact form (stored as an inquiry for the team). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t, locale } = useI18n()
const { text } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const d = computed(() => props.section.data as { email?: string, phone?: string, whatsapp?: string, address?: string })
const fields = computed(() => new Set<string>((s.value.form_fields ?? []) as string[]))
const form = reactive({ name: '', email: '', phone: '', subject: '', message: '', arrival: '', departure: '', group_size: '' })
const state = ref<'idle' | 'sending' | 'done' | 'error'>('idle')
const uid = useId()

async function submit() {
  state.value = 'sending'
  try {
    await $fetch('/v1/contact', {
      baseURL: useRuntimeConfig().public.apiBase,
      method: 'POST',
      query: { locale: locale.value },
      body: {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject || undefined,
        message: form.message,
        arrival: form.arrival || undefined,
        departure: form.departure || undefined,
        group_size: form.group_size ? Number(form.group_size) : undefined,
      },
    })
    state.value = 'done'
  }
  catch {
    state.value = 'error'
  }
}
const whatsapp = computed(() => (d.value.whatsapp ? `https://wa.me/${d.value.whatsapp.replace(/\D/g, '')}` : undefined))
</script>

<template>
  <MzSectionContainer :section="props.section">
    <div class="grid gap-12 lg:grid-cols-12">
      <div class="lg:col-span-5">
        <MzSectionHeading :section="props.section" />
        <p v-if="props.section.content.text" class="-mt-6 mb-8 text-body-lg text-muted">{{ text(props.section.content.text) }}</p>
        <ul class="flex flex-col gap-4">
          <li v-if="s.show_phone && d.phone"><UButton :to="`tel:${d.phone}`" external icon="i-lucide-phone" :label="d.phone" color="neutral" variant="link" /></li>
          <li v-if="s.show_whatsapp && whatsapp"><UButton :to="whatsapp" external target="_blank" icon="i-simple-icons-whatsapp" :label="t('sections.contact.whatsapp')" color="neutral" variant="link" /></li>
          <li v-if="s.show_email && d.email"><UButton :to="`mailto:${d.email}`" external icon="i-lucide-mail" :label="d.email" color="neutral" variant="link" /></li>
          <li v-if="d.address" class="text-muted">{{ d.address }}</li>
        </ul>
      </div>
      <div v-if="s.show_form" class="lg:col-span-7">
        <p v-if="state === 'done'" class="rounded-sm bg-muted p-8 text-body-lg" role="status">{{ text(props.section.content.success_text) || t('sections.contact.done') }}</p>
        <form v-else class="grid gap-6 sm:grid-cols-2" @submit.prevent="submit">
          <UFormField :label="t('sections.form.name')" required>
            <UInput v-model="form.name" autocomplete="name" required class="w-full" />
          </UFormField>
          <UFormField :label="t('sections.form.email')" required>
            <UInput v-model="form.email" type="email" autocomplete="email" required class="w-full" />
          </UFormField>
          <UFormField v-if="fields.has('phone')" :label="t('sections.form.phone')">
            <UInput v-model="form.phone" type="tel" autocomplete="tel" class="w-full" />
          </UFormField>
          <UFormField v-if="fields.has('group_size')" :label="t('sections.form.groupSize')">
            <UInput v-model="form.group_size" type="number" min="1" max="500" class="w-full" />
          </UFormField>
          <template v-if="fields.has('dates')">
            <UFormField :label="t('sections.form.arrival')">
              <UInput v-model="form.arrival" type="date" class="w-full" />
            </UFormField>
            <UFormField :label="t('sections.form.departure')">
              <UInput v-model="form.departure" type="date" class="w-full" />
            </UFormField>
          </template>
          <UFormField v-if="fields.has('subject')" :label="t('sections.form.subject')" class="sm:col-span-2">
            <UInput v-model="form.subject" class="w-full" />
          </UFormField>
          <UFormField :label="t('sections.form.message')" required class="sm:col-span-2">
            <UTextarea :id="`${uid}-message`" v-model="form.message" :rows="5" required class="w-full" />
          </UFormField>
          <p v-if="state === 'error'" class="text-small text-error sm:col-span-2" role="alert">{{ t('sections.contact.error') }}</p>
          <UButton type="submit" :loading="state === 'sending'" :label="t('sections.contact.send')" size="lg" class="justify-self-start" />
        </form>
      </div>
    </div>
  </MzSectionContainer>
</template>
