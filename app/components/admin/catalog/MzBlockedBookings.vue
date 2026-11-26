<script setup lang="ts">
import type { BookingRef } from '~/utils/catalog-admin-api'

/** The bookings that stop a change (shown with the API's refusal), each linked to its screen. */
const props = defineProps<{ message: string, bookings: BookingRef[] }>()
const { t } = useI18n()
const { date } = useDate()
</script>

<template>
  <UAlert color="warning" variant="soft" icon="i-lucide-calendar-x" :title="props.message" data-testid="blocked-bookings">
    <template #description>
      <ul class="mt-2 flex flex-col gap-1">
        <li v-for="b in props.bookings" :key="b.booking_id" class="flex flex-wrap items-center gap-2">
          <ULink :to="`/admin/bookings/${b.booking_id}`" class="font-medium underline">{{ b.reference }}</ULink>
          <span v-if="b.arrival" class="text-muted">{{ date(b.arrival) }} → {{ b.departure ? date(b.departure) : '…' }}</span>
          <span v-else-if="b.starts_at" class="text-muted">{{ date(b.starts_at) }}</span>
          <UBadge :label="t(`status.${b.status}`)" size="sm" color="neutral" variant="outline" />
        </li>
      </ul>
    </template>
  </UAlert>
</template>
