<script setup lang="ts">
import type { CatalogLocale, ItineraryStep } from '~/utils/catalog-admin-api'

/**
 * "Programme" tab (activities and packages): ordered steps with a day number, a title and a
 * description per language, a place, a duration and an image.
 */
const props = defineProps<{ maxDay?: number | null, errors?: Record<string, string> }>()
const model = defineModel<ItineraryStep[]>({ required: true })
const { t } = useI18n()
const locale = ref<CatalogLocale>('fr')
const blank = (): ItineraryStep => ({ day_number: 1, place_id: null, duration_minutes: null, media_id: null, translations: { fr: { title: '', description: '' } } })
function move(i: number, by: number) {
  const next = [...model.value]
  const j = i + by
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  model.value = next
}
function text(step: ItineraryStep, field: 'title' | 'description', value: string) {
  const current = step.translations[locale.value] ?? { title: '', description: '' }
  step.translations = { ...step.translations, [locale.value]: { ...current, [field]: value } }
}
const missing = computed(() => (['en', 'ar'] as CatalogLocale[]).filter(l => model.value.some(s => !s.translations[l]?.title?.trim())))
const err = (i: number, field: string) => props.errors?.[`itinerary[${i}].${field}`]
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="itinerary">
    <MzLocaleTabs v-model="locale" :missing="model.length ? missing : []">
      <ol class="flex flex-col gap-3">
        <li v-for="(s, i) in model" :key="i" class="flex flex-col gap-2 rounded-md border border-default p-3" :data-testid="`step-${i}`">
          <div class="flex flex-wrap items-end gap-2">
            <UFormField :label="t('admin.catalog.itinerary.day')" :name="`day-${i}`" :error="err(i, 'day_number') ? t('admin.catalog.errors.range') : undefined">
              <UInputNumber v-model="s.day_number" :min="1" :max="props.maxDay ?? undefined" size="sm" class="w-24" />
            </UFormField>
            <UFormField :label="t('admin.catalog.itinerary.title')" :name="`title-${i}`" class="flex-1" :error="locale === 'fr' && err(i, 'translations.fr.title') ? t('admin.catalog.errors.required') : undefined">
              <UInput :model-value="s.translations[locale]?.title ?? ''" size="sm" class="w-full" @update:model-value="v => text(s, 'title', String(v))" />
            </UFormField>
            <UFormField :label="t('admin.catalog.itinerary.duration')" :name="`dur-${i}`">
              <UInputNumber :model-value="s.duration_minutes ?? undefined" :min="1" size="sm" class="w-28" @update:model-value="v => (s.duration_minutes = v ? Number(v) : null)" />
            </UFormField>
            <div class="ms-auto flex gap-1">
              <UButton icon="i-lucide-arrow-up" size="xs" color="neutral" variant="ghost" :disabled="i === 0" :aria-label="t('admin.builder.moveUp')" @click="move(i, -1)" />
              <UButton icon="i-lucide-arrow-down" size="xs" color="neutral" variant="ghost" :disabled="i === model.length - 1" :aria-label="t('admin.catalog.moveDown')" @click="move(i, 1)" />
              <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :aria-label="t('common.delete')" @click="model = model.filter((_, j) => j !== i)" />
            </div>
          </div>
          <UTextarea :model-value="s.translations[locale]?.description ?? ''" :rows="2" class="w-full" :aria-label="t('admin.catalog.itinerary.description')" @update:model-value="v => text(s, 'description', String(v))" />
          <div class="grid gap-2 sm:grid-cols-2">
            <MzEntityPicker :model-value="s.place_id ?? undefined" kind="place" :label="t('admin.catalog.itinerary.place')" @update:model-value="v => (s.place_id = (v as string) ?? null)" />
            <MzMediaField :model-value="s.media_id ?? undefined" purpose="itineraryImage" @update:model-value="v => (s.media_id = (v as string) ?? null)" />
          </div>
        </li>
      </ol>
    </MzLocaleTabs>
    <UButton :label="t('admin.catalog.itinerary.add')" icon="i-lucide-plus" size="sm" color="neutral" variant="outline" class="self-start" data-testid="add-step" @click="model = [...model, blank()]" />
  </div>
</template>
