<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

interface Place { id: string, name: string, description: string | null, lat: number | null, lng: number | null, distance_km: number | null }

/**
 * Where the camp is: an OpenStreetMap embed loaded on request (privacy), directions, and the
 * distances to the places the editor chose (M'ssici, Alnif, Rissani...).
 */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { t, locale } = useI18n()
const { text } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const places = computed(() => (props.section.data.places ?? []) as Place[])
const camp = computed(() => props.section.data.camp as { lat: number | null, lng: number | null } | undefined)
const lat = computed(() => Number(s.value.center_lat ?? camp.value?.lat ?? 31.2389))
const lng = computed(() => Number(s.value.center_lng ?? camp.value?.lng ?? -4.7013))
const km = (n: number) => new Intl.NumberFormat(locale.value, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 0 }).format(n)
const directions = computed(() => `https://www.google.com/maps/dir/?api=1&destination=${lat.value},${lng.value}`)
</script>

<template>
  <MzSectionContainer :section="props.section">
    <div class="grid gap-12 lg:grid-cols-12">
      <div class="lg:col-span-5">
        <MzSectionHeading :section="props.section" />
        <p v-if="props.section.content.text" class="-mt-6 text-body-lg text-muted">{{ text(props.section.content.text) }}</p>
        <table v-if="s.show_distance_table && places.length" class="mt-8 w-full text-small">
          <caption class="sr-only">{{ t('sections.map.distances') }}</caption>
          <tbody>
            <tr v-for="p in places" :key="p.id" class="border-t border-default">
              <th scope="row" class="py-3 text-start font-normal">
                {{ p.name }}
                <span v-if="p.description" class="block text-muted">{{ p.description }}</span>
              </th>
              <td class="py-3 text-end text-toned">{{ p.distance_km != null ? km(p.distance_km) : '' }}</td>
            </tr>
          </tbody>
        </table>
        <UButton v-if="s.show_directions" :to="directions" target="_blank" external :label="t('sections.map.directions')" icon="i-lucide-navigation" color="neutral" variant="outline" class="mt-8" />
      </div>
      <div class="lg:col-span-7">
        <MzMapEmbed :lat="lat" :lng="lng" :zoom="Number(s.zoom ?? 9)" :title="text(props.section.content.title)" ratio="4/3" />
      </div>
    </div>
  </MzSectionContainer>
</template>
