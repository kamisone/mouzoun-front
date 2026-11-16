<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Email sign-up with explicit consent (news, opening date, pre-booking). */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t, locale } = useI18n()
const { text } = useSectionContext(() => props.section)
const c = computed(() => props.section.content)
const email = ref('')
const consent = ref(false)
const state = ref<'idle' | 'sending' | 'done' | 'error'>('idle')
const error = ref('')
const uid = useId()

async function submit() {
  error.value = ''
  if (props.section.settings.show_consent !== false && !consent.value) {
    error.value = t('sections.newsletter.consentRequired')
    return
  }
  state.value = 'sending'
  try {
    await $fetch('/v1/newsletter', {
      baseURL: useRuntimeConfig().public.apiBase,
      method: 'POST',
      query: { locale: locale.value },
      body: { email: email.value, list: props.section.settings.list_code, consent: true },
    })
    state.value = 'done'
  }
  catch {
    state.value = 'error'
    error.value = t('sections.newsletter.error')
  }
}
</script>

<template>
  <MzSectionContainer :section="props.section" size="narrow">
    <div class="mx-auto max-w-editorial text-center">
      <MzSectionHeading :section="{ ...props.section, settings: { ...props.section.settings, heading_align: 'center' } }" />
      <p v-if="state === 'done'" class="text-body-lg" role="status" data-testid="newsletter-done">{{ text(c.success_text) || t('sections.newsletter.done') }}</p>
      <form v-else class="flex flex-col gap-4 text-start" novalidate @submit.prevent="submit">
        <div class="flex flex-col gap-3 sm:flex-row">
          <label :for="`${uid}-email`" class="sr-only">{{ t('sections.form.email') }}</label>
          <UInput :id="`${uid}-email`" v-model="email" type="email" autocomplete="email" required size="xl" class="flex-1" :placeholder="t('sections.form.emailPlaceholder')" />
          <UButton type="submit" size="xl" :loading="state === 'sending'" :label="text(c.button_label) || t('sections.newsletter.submit')" class="justify-center" />
        </div>
        <UCheckbox v-if="props.section.settings.show_consent !== false" v-model="consent" :label="text(c.consent_text) || t('sections.newsletter.consent')" />
        <p v-if="error" class="text-small text-error" role="alert">{{ error }}</p>
      </form>
    </div>
  </MzSectionContainer>
</template>
