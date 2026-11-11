<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { BRAND_COLORS, SHADES } from '~/theme/palette'

/**
 * Visual review tool of the design system: tokens, type, buttons, section templates and every
 * Mz component, in light/dark and LTR/RTL. Dev only (or staff in production).
 */
definePageMeta({ middleware: 'styleguide' })
useHead({ title: 'Style guide', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const { t } = useI18n()
const toast = useToast()
const { photo } = usePhoto()

// ---- Direction override (checks RTL without switching language) ----
const direction = ref<'ltr' | 'rtl'>('ltr')
const pageDir = useTextDirection({ selector: 'html' })
watch(direction, d => (pageDir.value = d))
onMounted(() => (direction.value = pageDir.value === 'rtl' ? 'rtl' : 'ltr'))

const semantic = [
  ['bg-default', 'Background'],
  ['bg-elevated', 'Elevated'],
  ['bg-muted', 'Sand (subtle)'],
  ['bg-accented', 'Accented'],
  ['bg-inverted', 'Ink'],
] as const
const textTokens = ['text-highlighted', 'text-default', 'text-toned', 'text-muted', 'text-dimmed', 'text-primary'] as const
const typeScale = [
  ['text-display-xl', 'Display XL · 56→104', 'font-display'],
  ['text-display-lg', 'Display L · 44→72', 'font-display'],
  ['text-h1', 'H1 · 36→56', 'font-display'],
  ['text-h2', 'H2 · 28→40', 'font-display'],
  ['text-h3', 'H3 · 22→28', 'font-display'],
  ['text-body-lg', 'Body L · 18→20', 'font-sans'],
  ['text-body', 'Body · 16→17', 'font-sans'],
  ['text-small', 'Small · 14', 'font-sans'],
  ['text-caption', 'Caption · 12', 'font-sans'],
] as const
const spacing = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 40] as const
const spacingClass: Record<number, string> = { 1: 'w-1', 2: 'w-2', 3: 'w-3', 4: 'w-4', 6: 'w-6', 8: 'w-8', 12: 'w-12', 16: 'w-16', 24: 'w-24', 32: 'w-32', 40: 'w-40' }

const tent = computed(() => photo('nomad-tent'))
const night = computed(() => photo('night-sky'))
const offers = computed(() => [
  { title: 'Tente nomade', description: 'Tente berbère meublée, lits, tapis et lanternes.', p: photo('nomad-tent'), price: 4500, unit: 'night' as const, duration: null },
  { title: 'Quad dans les dunes', description: 'Une heure de pistes jusqu’aux grandes dunes.', p: photo('quads'), price: 4500, unit: 'person' as const, duration: 60 },
  { title: 'Thé au café du camp', description: 'Format 3:2, sans prix.', p: photo('mint-tea'), price: null, unit: undefined, duration: 30 },
])
const gallery = computed(() => (['oasis', 'mint-tea', 'host', 'sunset-ripples', 'camp'] as const).map(s => ({ src: photo(s).src, srcset: photo(s).srcset, alt: photo(s).alt, lqip: photo(s).lqip })))

const price = ref<number | null>(12050)
const title = ref<Record<string, string>>({ fr: 'Tente nomade', en: 'Nomad tent', ar: '' })
const dates = ref({ start: '2027-01-15', end: '2027-01-17' })
const image = ref<{ id: string, url: string } | null>(null)
const email = ref('')
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
    <div class="sticky top-(--ui-header-height) z-(--z-raised) border-b border-default bg-default">
      <MzContainer class="flex flex-wrap items-center gap-4 py-3">
        <p class="font-display text-h3">Style guide</p>
        <UFieldGroup>
          <UButton label="LTR" :variant="direction === 'ltr' ? 'solid' : 'outline'" color="neutral" size="sm" @click="direction = 'ltr'" />
          <UButton label="RTL" :variant="direction === 'rtl' ? 'solid' : 'outline'" color="neutral" size="sm" @click="direction = 'rtl'" />
        </UFieldGroup>
        <MzThemeToggle size="sm" />
        <MzLocaleSwitcher size="sm" variant="text" />
      </MzContainer>
    </div>

    <MzSection eyebrow="Tokens" title="Colour" description="Ivory and ink, photography, and one accent used rarely. Status colours appear only in forms and admin." space="md">
      <div class="grid gap-6 md:grid-cols-2">
        <div v-for="mode in ['light', 'dark']" :key="mode" :class="mode" class="rounded-sm bg-default p-6 ring ring-default">
          <p class="eyebrow mb-4">{{ mode }}</p>
          <div class="grid grid-cols-5 gap-2">
            <div v-for="[cls, label] in semantic" :key="cls" class="flex flex-col gap-2">
              <div class="h-16 rounded-xs ring ring-default" :class="cls" />
              <span class="text-caption text-muted">{{ label }}</span>
            </div>
          </div>
          <ul class="mt-6 flex flex-col gap-1 text-small">
            <li v-for="cls in textTokens" :key="cls" :class="cls">{{ cls }} — Le silence du désert</li>
          </ul>
        </div>
      </div>
      <div class="mt-12 flex flex-col gap-4">
        <div v-for="name in Object.keys(BRAND_COLORS)" :key="name" class="grid grid-cols-[6rem_1fr] items-center gap-4">
          <span class="text-small text-muted">{{ name }}</span>
          <div class="grid grid-cols-11 gap-1">
            <div v-for="shade in SHADES" :key="shade" class="h-8 rounded-xs" :style="{ background: `var(--color-${name}-${shade})` }" :title="`${name}-${shade}`" />
          </div>
        </div>
      </div>
    </MzSection>

    <MzSection eyebrow="Tokens" title="Typography" description="Cormorant Garamond for display, Inter for reading. Arabic: Noto Naskh Arabic and IBM Plex Sans Arabic, no tracking, no uppercase." tone="sand" space="md">
      <div class="flex flex-col divide-y divide-default border-y border-default">
        <div v-for="[cls, label, family] in typeScale" :key="cls" class="grid items-baseline gap-4 py-6 lg:grid-cols-12">
          <span class="text-caption text-muted lg:col-span-2">{{ label }}</span>
          <p class="lg:col-span-5" :class="[cls, family, family === 'font-display' && 'text-highlighted']">Le silence du désert</p>
          <p lang="ar" dir="rtl" class="lg:col-span-5" :class="[cls, family, family === 'font-display' && 'text-highlighted']">سكون الصحراء</p>
        </div>
      </div>
      <div class="mt-12 grid gap-6 md:grid-cols-2">
        <p class="eyebrow">Eyebrow label · Expériences</p>
        <p lang="ar" dir="rtl" class="eyebrow">تسمية صغيرة · التجارب</p>
      </div>
    </MzSection>

    <MzSection eyebrow="Tokens" title="Space, shape, depth" space="md">
      <div class="grid gap-12 lg:grid-cols-2">
        <div class="flex flex-col gap-2">
          <div v-for="s in spacing" :key="s" class="flex items-center gap-4">
            <span class="w-12 text-caption text-muted tabular-nums">{{ s * 4 }}</span>
            <div class="h-3 bg-primary" :class="spacingClass[s]" />
          </div>
        </div>
        <div class="flex flex-wrap items-start gap-8">
          <div class="flex flex-col items-center gap-2"><div class="size-20 rounded-xs bg-muted ring ring-default" /><span class="text-caption text-muted">2 px · inputs</span></div>
          <div class="flex flex-col items-center gap-2"><div class="size-20 rounded-sm bg-muted ring ring-default" /><span class="text-caption text-muted">4 px · cards, images</span></div>
          <div class="flex flex-col items-center gap-2"><div class="size-20 rounded-full bg-muted ring ring-default" /><span class="text-caption text-muted">full · pills</span></div>
          <div class="flex flex-col items-center gap-2"><div class="size-20 rounded-sm bg-elevated shadow-overlay" /><span class="text-caption text-muted">overlay shadow only</span></div>
        </div>
      </div>
    </MzSection>

    <MzSection eyebrow="Components" title="Actions" description="One primary action per view. Secondary: ink outline. Tertiary: text link." tone="sand" space="md">
      <div class="flex flex-col gap-8">
        <div class="flex flex-wrap items-center gap-6">
          <UButton label="Réserver un séjour" size="lg" />
          <UButton label="Nous écrire" color="neutral" variant="outline" size="lg" />
          <a href="#" class="link-underline text-small font-medium text-highlighted">Voir les hébergements</a>
        </div>
        <div class="flex flex-wrap items-center gap-6">
          <UButton label="Primary md" />
          <UButton label="Secondary md" color="neutral" variant="outline" />
          <UButton label="Ghost" color="neutral" variant="ghost" icon="i-lucide-sliders-horizontal" />
          <UButton label="Small" size="sm" />
          <UButton label="Disabled" disabled />
        </div>
        <div class="flex flex-wrap items-center gap-6">
          <MzPrice :cents="4500" from unit="person" trim-zero-cents />
          <MzPrice :cents="125050" size="lg" />
          <MzDate value="2027-01-15" end="2027-01-17" />
          <MzDate value="2027-01-16T08:00:00Z" with-time />
          <MzLogo />
        </div>
      </div>
    </MzSection>

    <MzHero eyebrow="MzHero" title="Le silence du désert, à M’ssici" description="Full-viewport photograph, scrim, one action." :image="photo('hero-dunes').src" :image-srcset="photo('hero-dunes').srcset" :lqip="photo('hero-dunes').lqip" next="sg-split">
      <template #actions>
        <UButton :label="t('home.cta')" size="lg" />
      </template>
    </MzHero>

    <MzEditorialSplit id="sg-split" eyebrow="MzEditorialSplit" title="Des tentes nomades, simplement confortables" :image="tent.src" :image-srcset="tent.srcset" :image-alt="tent.alt" :lqip="tent.lqip">
      <p>Image on 7 columns, text on 4, one column of air. Alternate with <code>reverse</code>.</p>
      <template #actions>
        <a href="#" class="link-underline text-small font-medium text-highlighted">Voir les hébergements</a>
      </template>
    </MzEditorialSplit>

    <MzSection eyebrow="MzOfferCard" title="Expériences" tone="sand">
      <MzGrid :cols="3">
        <MzOfferCard
          v-for="(o, i) in offers"
          :key="o.title"
          :title="o.title"
          :description="o.description"
          :image="o.p.src"
          :image-srcset="o.p.srcset"
          :image-alt="o.p.alt"
          :lqip="o.p.lqip"
          :ratio="i === 2 ? '3/2' : '4/5'"
          :price-from-cents="o.price"
          :price-unit="o.unit"
          :duration-minutes="o.duration"
          :label="i === 1 ? 'Guidé' : undefined"
          to="#"
        />
      </MzGrid>
    </MzSection>

    <MzQuoteImage quote="Ici, la nuit a encore toutes ses étoiles." author="Claire" origin="Lyon" :image="night.src" :image-srcset="night.srcset" :lqip="night.lqip" />

    <MzSection eyebrow="MzFacts · MzGallery · MzTestimonial" title="Rhythm" space="md">
      <MzStack gap="xl">
        <MzFacts :facts="[{ value: '6', label: 'tentes nomades' }, { value: '20', label: 'emplacements' }, { value: '45', label: 'km de Rissani' }, { value: '1', label: 'ferme familiale' }]" />
        <MzGallery :images="gallery" />
        <MzGrid :cols="2">
          <MzTestimonial quote="Un accueil inoubliable, des nuits magiques et le meilleur tajine du voyage." author="Claire D." origin="Lyon, France" :rating="5" />
          <MzTestimonial quote="The quad tour at sunset was the highlight of our trip to Morocco." author="Tom R." origin="Bristol, UK" />
        </MzGrid>
      </MzStack>
    </MzSection>

    <MzSection eyebrow="MzPracticalInfo" title="Venir à M’ssici">
      <MzPracticalInfo
        :lat="31.238933"
        :lng="-4.701349"
        :items="[{ title: 'Accès', text: 'Route N12, environ 45 km de Rissani.' }, { title: 'Arrivée', text: 'Accueil à partir de 14 h.' }, { title: 'Saison', text: 'D’octobre à avril.' }]"
      />
    </MzSection>

    <MzCtaBanner eyebrow="MzCtaBanner" title="Une nuit sous les étoiles vous attend" description="Sand surface, serif title, one action.">
      <UButton :label="t('home.cta')" size="lg" />
    </MzCtaBanner>

    <MzSection eyebrow="Components" title="Forms" size="narrow" space="md">
      <UForm :state="{}" class="flex flex-col gap-8">
        <MzFormField name="email" label="E-mail" description="Hairline field, label on top." required>
          <UInput v-model="email" type="email" placeholder="vous@exemple.com" class="w-full" />
        </MzFormField>
        <MzFormField name="price" label="MzMoneyInput" :help="`Model: ${price ?? 'null'} cents`">
          <MzMoneyInput v-model="price" />
        </MzFormField>
        <MzFormField name="title" label="MzTranslatableInput" required>
          <MzTranslatableInput v-model="title" label="Title" />
        </MzFormField>
        <MzFormField name="dates" label="MzDateRangePicker">
          <MzDateRangePicker v-model="dates" min="2026-11-11" />
        </MzFormField>
        <MzFormField name="image" label="MzImagePicker" help="Uploads through the media API (staff session needed).">
          <MzImagePicker v-model="image" label="Cover" />
        </MzFormField>
        <UAlert title="Calm error state" description="Shown under a field or form, never shouting." color="error" variant="subtle" icon="i-lucide-circle-alert" />
      </UForm>
    </MzSection>

    <MzSection eyebrow="Components" title="Admin" description="Same palette and type, denser and neutral: the accent only for primary actions." tone="sand" space="md">
      <MzStack gap="lg">
        <MzGrid :cols="4" gap="sm">
          <MzStatCard label="Réservations" :value="128" icon="i-lucide-calendar-check" :delta="0.12" />
          <MzStatCard label="Revenu" :value="money(1254000)" icon="i-lucide-wallet" :delta="-0.04" />
          <MzStatCard label="Occupation" value="76 %" icon="i-lucide-tent" :delta="0" />
          <MzStatCard label="Chargement" :value="null" loading />
        </MzGrid>
        <MzDataTable :columns="columns" :rows="rows" :total="rows.length" :query="query" :sortable="['reference', 'total']" @update="update" />
        <div class="flex flex-wrap gap-2">
          <MzStatusBadge v-for="s in ['draft', 'pending', 'awaiting_payment', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired']" :key="s" :status="s" />
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton label="New booking" size="sm" icon="i-lucide-plus" />
          <UButton label="MzFormDrawer" size="sm" color="neutral" variant="outline" @click="drawerOpen = true" />
          <UButton label="MzConfirmDialog" size="sm" color="neutral" variant="outline" @click="confirmOpen = true" />
          <UButton label="Toast" size="sm" color="neutral" variant="ghost" @click="toast.add({ title: 'Enregistré', description: 'Toast notification', color: 'success', icon: 'i-lucide-check' })" />
        </div>
        <MzGrid :cols="2" gap="sm">
          <MzEmptyState />
          <MzSkeleton variant="card" />
        </MzGrid>
        <MzConfirmDialog v-model:open="confirmOpen" danger :confirm-label="t('common.delete')" @confirm="confirmOpen = false" />
        <MzFormDrawer v-model:open="drawerOpen" title="Modifier le produit" form-id="sg-drawer-form">
          <UForm id="sg-drawer-form" :state="{}" class="flex flex-col gap-6" @submit="drawerOpen = false">
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
