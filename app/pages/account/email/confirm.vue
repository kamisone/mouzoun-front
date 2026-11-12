<script setup lang="ts">
/** Old link target of the email-change email: the code is typed under Login & security. */
definePageMeta({ middleware: 'account' })
const localePath = useLocalePath()
onMounted(() => navigateTo(localePath('/account/security#email'), { replace: true }))
</script>

<template>
  <div />
</template>
