<script setup lang="ts">
/**
 * Heart: saves a product to the wishlist. Works before signing in (kept on this device, added to
 * the account at sign-in). A toggle button (`aria-pressed`) with a visible change of state.
 */
const props = withDefaults(defineProps<{ productId: string, name: string, overlay?: boolean }>(), { overlay: false })
const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const saved = useSaved()
const { account } = useAccount()
const busy = ref(false)
onMounted(() => saved.load())

const on = computed(() => saved.has(props.productId))

async function toggle() {
  busy.value = true
  try {
    const now = await saved.toggle(props.productId)
    if (now && !account.value) {
      toast.add({
        title: t('account.wishlist.savedHere'),
        description: t('account.wishlist.signInToKeep'),
        actions: [{ label: t('account.signin.cta'), to: localePath('/account/signin'), color: 'neutral', variant: 'outline' }],
      })
    }
  }
  catch {
    toast.add({ title: t('account.errors.generic'), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UButton
    :icon="on ? 'i-lucide-heart' : 'i-lucide-heart'"
    :aria-label="on ? t('account.wishlist.remove', { name: props.name }) : t('account.wishlist.add', { name: props.name })"
    :aria-pressed="on"
    :loading="busy"
    :color="props.overlay ? 'neutral' : on ? 'primary' : 'neutral'"
    :variant="props.overlay ? 'solid' : 'ghost'"
    class="rounded-full"
    :class="[on ? '[&_svg]:fill-current' : '', props.overlay ? 'bg-default/90 text-highlighted shadow-lifted hover:bg-default' : '']"
    data-testid="wishlist-button"
    @click.stop.prevent="toggle"
  />
</template>
