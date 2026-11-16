<script setup lang="ts">
import type { RenderedSection } from '~/utils/page-types'

/** Icons (or photos) with a short text: facilities, reasons to come. Site amenities as a source. */
const props = defineProps<{ section: RenderedSection, index: number }>()
const { text, media } = useSectionContext(() => props.section)
const s = computed(() => props.section.settings)
const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5', 6: 'sm:grid-cols-3 lg:grid-cols-6' } as const
const features = computed(() =>
  s.value.source === 'amenities'
    ? ((props.section.data.amenities ?? []) as { code: string, icon: string | null, name: string, description: string | null }[])
        .map(a => ({ id: a.code, icon: a.icon, media: undefined, title: a.name, text: a.description, href: null as string | null }))
    : props.section.items.map(i => ({ id: i.id, icon: i.settings.icon as string | undefined, media: media(i.settings.media_id), title: text(i.content.title), text: text(i.content.text), href: (i.settings.link?.href ?? null) as string | null })),
)
</script>

<template>
  <MzSectionContainer :section="props.section">
    <MzSectionHeading :section="props.section" />
    <ul class="grid gap-x-8 gap-y-12" :class="cols[Number(s.columns ?? 3) as keyof typeof cols] ?? cols[3]">
      <MzReveal v-for="(f, i) in features" :key="f.id" as="li" :index="i" class="relative">
        <MzMedia v-if="f.media" :media="f.media" decorative ratio="3/2" class="mb-6" sizes="(min-width: 1024px) 33vw, 100vw" />
        <span v-else-if="f.icon" class="mb-6 inline-flex size-12 items-center justify-center rounded-sm" :class="s.icon_style === 'filled' ? 'bg-primary text-inverted' : 'border border-default text-primary'">
          <UIcon :name="f.icon" class="size-6" aria-hidden="true" />
        </span>
        <h3 class="text-h3">
          <NuxtLink v-if="f.href" :to="f.href" class="after:absolute after:inset-0 after:content-['']">{{ f.title }}</NuxtLink>
          <template v-else>{{ f.title }}</template>
        </h3>
        <p v-if="f.text" class="mt-2 text-muted">{{ f.text }}</p>
      </MzReveal>
    </ul>
  </MzSectionContainer>
</template>
