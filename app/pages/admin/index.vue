<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin-auth', i18n: false, title: 'admin.dashboard' })

const { t } = useI18n()
const { user } = useAuth()
</script>

<template>
  <div>
    <MzPageHeader :title="t('admin.dashboard')" :description="user ? t('admin.welcome', { name: user.full_name }) : undefined" />
    <MzGrid :cols="4" gap="sm">
      <MzStatCard :label="t('admin.bookings')" :value="null" icon="i-lucide-calendar-check" />
      <MzStatCard :label="t('admin.customers')" :value="null" icon="i-lucide-users" />
      <MzStatCard :label="t('admin.products')" :value="null" icon="i-lucide-tent" />
      <MzStatCard :label="t('admin.media')" :value="null" icon="i-lucide-images" />
    </MzGrid>
    <MzEmptyState class="mt-6" icon="i-lucide-chart-line" :title="t('admin.upcoming')" :description="t('admin.statsPlaceholder')" />
  </div>
</template>
