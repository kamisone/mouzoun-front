<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

interface Crop { code: string, name: string, description: string | null, icon: string | null, harvest_months: number[] }

/** Harvest months of the farm crops: an accessible table, the current month highlighted. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t, locale } = useI18n()
const { text } = useSectionContext(() => props.section)
const crops = computed(() => (props.section.data.crops ?? []) as Crop[])
const current = computed(() => (props.section.settings.highlight_current_month !== false ? Number(props.section.data.current_month) : 0))
const months = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const date = Date.UTC(2027, i, 1)
    return {
      n: i + 1,
      short: new Intl.DateTimeFormat(locale.value, { month: 'narrow', timeZone: 'UTC' }).format(date),
      long: new Intl.DateTimeFormat(locale.value, { month: 'long', timeZone: 'UTC' }).format(date),
    }
  }),
)
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <div class="overflow-x-auto">
      <table class="w-full min-w-xl border-collapse text-small">
        <caption class="sr-only">{{ text(props.section.content.title) || t('sections.calendar.caption') }}</caption>
        <thead>
          <tr>
            <th scope="col" class="py-2 pe-4 text-start font-medium">{{ t('sections.calendar.crop') }}</th>
            <th v-for="m in months" :key="m.n" scope="col" class="w-8 py-2 text-center font-medium" :class="m.n === current && 'text-primary'">
              <abbr :title="m.long" class="no-underline">{{ m.short }}</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="crop in crops" :key="crop.code" class="border-t border-default">
            <th scope="row" class="py-3 pe-4 text-start font-normal">
              <span class="flex items-center gap-2"><UIcon v-if="crop.icon" :name="crop.icon" class="size-4 text-primary" aria-hidden="true" />{{ crop.name }}</span>
            </th>
            <td v-for="m in months" :key="m.n" class="py-3 text-center" :class="m.n === current && 'bg-muted'">
              <span v-if="crop.harvest_months.includes(m.n)" class="inline-block size-3 rounded-full bg-primary" role="img" :aria-label="t('sections.calendar.harvest', { month: m.long })" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </MzSectionContainer>
</template>
