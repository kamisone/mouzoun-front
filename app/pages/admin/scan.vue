<script setup lang="ts">
import type { ScannedTicket } from '~/utils/admin-types'

/**
 * Arrival desk: scan a guest's QR ticket (camera, where the browser can read QR codes) or paste
 * its code. Shows who it is, what is still due, and checks the guests in.
 */
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.scan.title' })
const { t } = useI18n()
const admin = useAdminApi()
const toast = useToast()
const { money } = useMoney()
const { dateRange, date } = useDate()

const code = ref('')
const result = ref<ScannedTicket | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const video = ref<HTMLVideoElement | null>(null)
const scanning = ref(false)
const cameraAvailable = ref(false)
let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  cameraAvailable.value = 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia
})
onBeforeUnmount(stop)

async function check(token = code.value) {
  if (!token.trim()) return
  busy.value = true
  error.value = null
  result.value = null
  try {
    result.value = await admin.scanTicket(token.trim())
  }
  catch {
    error.value = t('admin.scan.invalid')
  }
  finally {
    busy.value = false
  }
}

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    scanning.value = true
    await nextTick()
    video.value!.srcObject = stream
    await video.value!.play()
    const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
    const detector = new Detector({ formats: ['qr_code'] })
    timer = setInterval(async () => {
      const found = await detector.detect(video.value!).catch(() => [])
      if (found[0]?.rawValue) {
        code.value = found[0].rawValue
        stop()
        await check(found[0].rawValue)
      }
    }, 300)
  }
  catch {
    error.value = t('admin.scan.noCamera')
    stop()
  }
}

function stop() {
  if (timer) clearInterval(timer)
  timer = null
  stream?.getTracks().forEach(tr => tr.stop())
  stream = null
  scanning.value = false
}

async function checkIn() {
  if (!result.value) return
  try {
    await admin.bookings.setStatus(result.value.id, 'checked_in')
    toast.add({ title: t('admin.scan.checkedIn'), color: 'success', icon: 'i-lucide-check' })
    result.value = { ...result.value, status: 'checked_in' }
  }
  catch {
    toast.add({ title: t('auth.error'), color: 'error' })
  }
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <MzPageHeader :title="t('admin.scan.title')" :description="t('admin.scan.description')" />
    <div v-if="cameraAvailable" class="flex flex-col gap-3">
      <video v-show="scanning" ref="video" class="aspect-square w-full max-w-sm rounded-sm bg-inverted object-cover" muted playsinline :aria-label="t('admin.scan.camera')" />
      <UButton v-if="!scanning" :label="t('admin.scan.start')" icon="i-lucide-camera" class="self-start" @click="start" />
      <UButton v-else :label="t('admin.scan.stop')" icon="i-lucide-square" color="neutral" variant="outline" class="self-start" @click="stop" />
    </div>
    <form class="flex flex-wrap items-end gap-2" @submit.prevent="check()">
      <UFormField :label="t('admin.scan.code')" class="flex-1">
        <UInput v-model="code" autocomplete="off" dir="ltr" class="w-full font-mono" />
      </UFormField>
      <UButton type="submit" :label="t('admin.scan.check')" :loading="busy" />
    </form>
    <UAlert v-if="error" :title="error" color="error" variant="subtle" icon="i-lucide-circle-x" role="alert" />
    <UCard v-if="result" variant="outline" data-testid="scan-result">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-lg font-semibold text-highlighted">{{ result.reference }}</span>
          <UBadge :label="t(`status.${result.status}`)" :color="['confirmed', 'checked_in'].includes(result.status) ? 'success' : 'warning'" variant="subtle" />
        </div>
        <p class="text-lg text-highlighted">{{ result.lead }}</p>
        <p class="text-sm text-muted">
          {{ result.arrival_date && result.departure_date ? dateRange(result.arrival_date, result.departure_date) : result.arrival_date ? date(result.arrival_date) : '' }}
          · {{ t('admin.scan.party', { adults: result.adults, children: result.children + result.infants }) }}
        </p>
        <UAlert v-if="result.balance_minor > 0" :title="t('admin.scan.balance', { amount: money(result.balance_minor) })" color="warning" variant="subtle" />
        <UAlert v-if="!result.precheckin_done" :title="t('admin.scan.noPrecheckin')" color="info" variant="subtle" />
        <div class="flex flex-wrap gap-2">
          <UButton v-if="result.status === 'confirmed'" :label="t('admin.scan.checkIn')" icon="i-lucide-log-in" @click="checkIn" />
          <UButton :to="`/admin/bookings/${result.id}`" :label="t('admin.scan.open')" color="neutral" variant="outline" />
        </div>
      </div>
    </UCard>
  </div>
</template>
