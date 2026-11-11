<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { BRAND_COLORS, SHADES } from '~/theme/palette'
import type { GalleryImage } from '~/components/marketing/MzGallery.vue'

/**
 * Visual review tool of the design system: tokens, type, and every Mz component with its
 * variants, in light/dark and LTR/RTL. Dev only (or staff in production).
 */
definePageMeta({ middleware: 'styleguide' })
useHead({ title: 'Style guide', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const { t } = useI18n()
const toast = useToast()

// ---- Direction override (checks RTL without switching language) ----
const direction = ref<'ltr' | 'rtl'>('ltr')
const pageDir = useTextDirection({ selector: 'html' })
watch(direction, d => (pageDir.value = d))
onMounted(() => (direction.value = pageDir.value === 'rtl' ? 'rtl' : 'ltr'))

const colors = Object.keys(BRAND_COLORS)
const semanticBg = ['bg-default', 'bg-muted', 'bg-elevated', 'bg-accented', 'bg-inverted']
const semanticText = ['text-highlighted', 'text-default', 'text-toned', 'text-muted', 'text-dimmed', 'text-primary', 'text-secondary', 'text-success', 'text-info', 'text-warning', 'text-error']
const radii = ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full']
const shadows = ['shadow-soft', 'shadow-warm', 'shadow-lifted']
const buttonColors = ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] as const
const buttonVariants = ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'] as const

// ---- Sample data (placeholders) ----
// Local SVG placeholders (public/images/placeholders): no third-party requests.
const img = (name: string) => `/images/placeholders/${name}.svg`
const gallery: GalleryImage[] = [
  { src: img('dunes'), alt: 'Dunes at sunset (sample)', caption: 'Dunes (sample)' },
  { src: img('palms'), alt: 'Palm grove (sample)' },
  { src: img('tent'), alt: 'Nomad tent (sample)' },
  { src: img('camel'), alt: 'Camels (sample)' },
]
const price = ref<number | null>(12050)
const title = ref<Record<string, string>>({ fr: 'Tente nomade', en: 'Nomad tent', ar: '' })
const dates = ref({ start: '2027-01-15', end: '2027-01-17' })
const image = ref<{ id: string, url: string } | null>(null)
const confirmOpen = ref(false)
const drawerOpen = ref(false)
const { query, update } = useTableQuery({ perPage: 5 })
interface Row extends Record<string, unknown> { reference: string, guest: string, status: string, total: number }
const rows: Row[] = [
  { reference: 'MZ-27-000041', guest: 'Amina Benali', status: 'confirmed', total: 32500 },
  { reference: 'MZ-27-000042', guest: 'Lucas Martin', status: 'awaiting_payment', total: 18000 },
  { reference: 'MZ-27-000043', guest: 'يوسف العمراني', status: 'cancelled', total: 9000 },
]
const { money } = useMoney()
const columns: TableColumn<Row>[] = [
  { accessorKey: 'reference', header: 'Reference' },
  { accessorKey: 'guest', header: 'Guest' },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => h(resolveComponent('MzStatusBadge'), { status: row.original.status }) },
  { accessorKey: 'total', header: 'Total', cell: ({ row }) => money(row.original.total) },
]
</script>

<template>
  <div class="pb-24">
    <!-- Controls -->
    <div class="sticky top-(--ui-header-height) z-(--z-raised) border-b border-default bg-elevated/95 backdrop-blur">
      <MzContainer class="flex flex-wrap items-center gap-3 py-3">
        <p class="font-display text-lg font-semibold">Style guide</p>
        <UFieldGroup>
          <UButton label="LTR" :variant="direction === 'ltr' ? 'solid' : 'outline'" color="neutral" size="sm" @click="direction = 'ltr'" />
          <UButton label="RTL" :variant="direction === 'rtl' ? 'solid' : 'outline'" color="neutral" size="sm" @click="direction = 'rtl'" />
        </UFieldGroup>
        <MzThemeToggle size="sm" />
        <MzLocaleSwitcher size="sm" />
      </MzContainer>
    </div>

    <MzSection title="Colour scales" eyebrow="Tokens" description="Generated in OKLCH from app/theme/palette.ts (npm run tokens). Base colour at 500.">
      <div class="flex flex-col gap-4">
        <div v-for="name in colors" :key="name">
          <p class="mb-1 font-semibold">{{ name }}</p>
          <div class="grid grid-cols-11 gap-1">
            <div v-for="shade in SHADES" :key="shade" class="flex flex-col gap-1">
              <div class="h-12 rounded-md ring ring-default" :style="{ background: `var(--color-${name}-${shade})` }" />
              <span class="text-center text-xs text-muted tabular-nums">{{ shade }}</span>
            </div>
          </div>
        </div>
      </div>
    </MzSection>

    <MzSection title="Semantic tokens" eyebrow="Tokens" description="What components use. Light (warm sand) and dark (desert night), side by side." tone="muted">
      <div class="grid gap-4 md:grid-cols-2">
        <div v-for="mode in ['light', 'dark']" :key="mode" :class="mode" class="rounded-lg bg-default p-5 text-default ring ring-default">
          <p class="mb-3 font-semibold text-highlighted">{{ mode }}</p>
          <div class="mb-4 grid grid-cols-5 gap-2">
            <div v-for="bg in semanticBg" :key="bg" class="flex flex-col gap-1">
              <div class="h-10 rounded-md ring ring-default" :class="bg" />
              <code class="text-[10px] text-muted">{{ bg }}</code>
            </div>
          </div>
          <ul class="grid grid-cols-2 gap-1 text-sm">
            <li v-for="cls in semanticText" :key="cls" :class="cls">{{ cls }}</li>
          </ul>
          <div class="mt-4 flex flex-wrap gap-2">
            <UButton label="Primary" />
            <UButton label="Secondary" color="secondary" />
            <UButton label="Neutral" color="neutral" variant="outline" />
          </div>
        </div>
      </div>
    </MzSection>

    <MzSection title="Typography" eyebrow="Tokens">
      <div class="grid gap-8 md:grid-cols-2">
        <div class="flex flex-col gap-3">
          <p class="font-display text-5xl font-semibold">Fraunces display</p>
          <h2 class="text-3xl font-semibold">Heading 2 — Nuits sous les étoiles</h2>
          <h3 class="text-xl font-semibold">Heading 3 — The farm and palm grove</h3>
          <p class="text-lg">Lead text — Inter, regular. Camping, café, quads, farm fields, village visits.</p>
          <p>Body — The quick brown fox jumps over the lazy dog. 0123456789 € 1 250,00</p>
          <p class="text-sm text-muted">Small, muted — captions and help text.</p>
        </div>
        <div lang="ar" dir="rtl" class="flex flex-col gap-3">
          <p class="font-display text-5xl font-semibold">نوتو كوفي عربي</p>
          <h2 class="text-3xl font-semibold">عنوان ثانٍ — ليالٍ تحت النجوم</h2>
          <h3 class="text-xl font-semibold">عنوان ثالث — المزرعة وواحة النخيل</h3>
          <p class="text-lg">نص تمهيدي — IBM Plex Sans Arabic، تخييم ومقهى ودراجات رباعية.</p>
          <p>نص عادي — زيارة القرية والمزرعة والماشية. 0123456789</p>
          <p class="text-sm text-muted">نص صغير للتعليقات والمساعدة.</p>
        </div>
      </div>
    </MzSection>

    <MzSection title="Radius, shadows, spacing" eyebrow="Tokens" tone="muted">
      <div class="flex flex-wrap gap-6">
        <div v-for="r in radii" :key="r" class="flex flex-col items-center gap-2">
          <div class="size-16 bg-primary" :class="r" />
          <code class="text-xs text-muted">{{ r }}</code>
        </div>
        <div v-for="s in shadows" :key="s" class="flex flex-col items-center gap-2">
          <div class="size-16 rounded-lg bg-elevated" :class="s" />
          <code class="text-xs text-muted">{{ s }}</code>
        </div>
      </div>
      <p class="mt-6 text-sm text-muted">Sections use <code>py-(--section-y)</code> (fluid 3.5–7 rem) and <code>--section-gap</code> between header and content.</p>
    </MzSection>

    <MzSection title="Buttons and badges" eyebrow="Nuxt UI, configured in app.config.ts">
      <div class="flex flex-col gap-4">
        <div v-for="variant in buttonVariants" :key="variant" class="flex flex-wrap gap-2">
          <UButton v-for="color in buttonColors" :key="color" :label="color" :color="color" :variant="variant" />
        </div>
        <div class="flex flex-wrap gap-2">
          <MzStatusBadge v-for="s in ['draft', 'pending', 'awaiting_payment', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired']" :key="s" :status="s" />
        </div>
      </div>
    </MzSection>

    <MzSection title="Base" eyebrow="Components" tone="muted">
      <MzGrid :cols="2">
        <UCard>
          <MzStack gap="sm">
            <MzLogo />
            <MzLogo size="sm" icon-only />
            <MzPrice :cents="12050" />
            <MzPrice :cents="4500" from unit="person" trim-zero-cents />
            <MzPrice :cents="0" />
            <MzPrice :cents="125000" size="lg" unit="night" />
            <MzDate value="2027-01-15" />
            <MzDate value="2027-01-16T08:00:00Z" with-time />
            <MzDate value="2027-01-15" end="2027-01-17" />
          </MzStack>
        </UCard>
        <MzStack>
          <MzEmptyState>
            <UButton :label="t('common.backHome')" variant="soft" />
          </MzEmptyState>
          <MzSkeleton />
        </MzStack>
      </MzGrid>
    </MzSection>

    <MzHero
      eyebrow="MzHero"
      title="Une nuit sous les étoiles de M'ssici"
      description="Image background with overlay (placeholder photo)."
      :image="img('night')"
      height="md"
    >
      <template #actions>
        <UButton :label="t('common.book')" size="xl" />
        <UButton :label="t('common.learnMore')" size="xl" color="neutral" variant="outline" />
      </template>
    </MzHero>

    <MzSection title="Marketing" eyebrow="Components">
      <MzStack gap="xl">
        <MzGrid :cols="3">
          <MzFeatureCard icon="i-lucide-tent" title="Camping" description="Feature card with icon." />
          <MzFeatureCard icon="i-lucide-sprout" title="La ferme" description="Clickable variant." to="#" />
          <MzFeatureCard icon="i-lucide-coffee" title="Le café" description="Third one." />
        </MzGrid>
        <MzGrid :cols="3">
          <MzOfferCard
            title="Tente nomade"
            description="Tente berbère meublée, lits, tapis et lanternes."
            :image="img('tent')"
            image-alt="Inside a nomad tent (sample)"
            :price-from-cents="4500"
            price-unit="night"
            :badges="[{ label: 'Populaire', color: 'primary' }]"
            to="#"
          />
          <MzOfferCard
            title="Quad 2 h"
            description="Jusqu'aux grandes dunes et retour au coucher du soleil."
            :image="img('quad')"
            image-alt="Quad in the dunes (sample)"
            :price-from-cents="8000"
            price-unit="person"
            :duration-minutes="120"
            :badges="[{ label: 'Guidé', color: 'secondary' }, { label: '16+' }]"
            to="#"
          />
          <MzOfferCard title="Sans image" description="Card without media, no link." :price-from-cents="1200" :duration-minutes="90" />
        </MzGrid>
        <MzGallery :images="gallery" :cols="4" />
        <MzGrid :cols="2">
          <MzTestimonial quote="Un accueil inoubliable, des nuits magiques et le meilleur tajine du voyage." author="Claire D." origin="Lyon, France" :rating="5" />
          <MzTestimonial quote="The quad tour at sunset was the highlight of our trip to Morocco." author="Tom R." origin="Bristol, UK" :rating="4" />
        </MzGrid>
        <MzMapEmbed :lat="31.238933" :lng="-4.701349" />
        <MzCtaBanner title="Prêt pour une nuit sous les étoiles ?" description="Call to action banner.">
          <UButton :label="t('common.book')" size="lg" color="neutral" />
        </MzCtaBanner>
      </MzStack>
    </MzSection>

    <MzSection title="Forms" eyebrow="Components" tone="muted" size="narrow">
      <UCard>
        <MzStack>
          <MzFormField name="price" label="MzMoneyInput" :help="`Model: ${price ?? 'null'} cents`">
            <MzMoneyInput v-model="price" />
          </MzFormField>
          <MzFormField name="title" label="MzTranslatableInput" required>
            <MzTranslatableInput v-model="title" label="Title" />
          </MzFormField>
          <MzFormField name="dates" label="MzDateRangePicker">
            <MzDateRangePicker v-model="dates" min="2026-11-11" />
          </MzFormField>
          <MzFormField name="image" label="MzImagePicker" help="Uploads to the bucket through the media API (staff session needed).">
            <MzImagePicker v-model="image" label="Cover" />
          </MzFormField>
        </MzStack>
      </UCard>
    </MzSection>

    <MzSection title="Admin" eyebrow="Components">
      <MzStack gap="lg">
        <MzGrid :cols="4" gap="sm">
          <MzStatCard label="Réservations" :value="128" icon="i-lucide-calendar-check" :delta="0.12" />
          <MzStatCard label="Revenu" :value="money(1254000)" icon="i-lucide-wallet" :delta="-0.04" />
          <MzStatCard label="Occupation" value="76 %" icon="i-lucide-tent" :delta="0" />
          <MzStatCard label="Chargement" :value="null" loading />
        </MzGrid>
        <MzDataTable :columns="columns" :rows="rows" :total="rows.length" :query="query" :sortable="['reference', 'total']" @update="update" />
        <div class="flex flex-wrap gap-2">
          <UButton label="MzConfirmDialog" color="error" variant="soft" @click="confirmOpen = true" />
          <UButton label="MzFormDrawer" variant="soft" @click="drawerOpen = true" />
          <UButton label="Toast" color="neutral" variant="outline" @click="toast.add({ title: 'Enregistré', description: 'Toast notification', color: 'success', icon: 'i-lucide-check' })" />
        </div>
        <MzConfirmDialog v-model:open="confirmOpen" danger :confirm-label="t('common.delete')" @confirm="confirmOpen = false" />
        <MzFormDrawer v-model:open="drawerOpen" title="Modifier le produit" form-id="sg-drawer-form">
          <UForm id="sg-drawer-form" :state="{}" class="flex flex-col gap-4" @submit="drawerOpen = false">
            <MzFormField name="name" label="Nom" required>
              <MzTranslatableInput v-model="title" />
            </MzFormField>
            <MzFormField name="price" label="Prix">
              <MzMoneyInput v-model="price" />
            </MzFormField>
          </UForm>
        </MzFormDrawer>
      </MzStack>
    </MzSection>
  </div>
</template>
