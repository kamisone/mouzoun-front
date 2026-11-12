<script setup lang="ts">
import type { Wishlist } from '~/utils/account-types'

/** Wishlists: named lists of stays and activities, each shareable by a read-only link. */
definePageMeta({ middleware: 'account' })
const { t } = useI18n()
const localePath = useLocalePath()
const api = useAccountApi()
const toast = useToast()
const saved = useSaved()
const { copy } = useClipboard()
const { money } = useMoney()

const lists = ref<Wishlist[]>([])
const loading = ref(true)
const newName = ref('')
const creating = ref(false)

async function load() {
  loading.value = true
  try {
    lists.value = (await api.wishlists.list()).lists
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

const productPath = (kind: string, slug: string) => localePath(`/${kind === 'accommodation' ? 'stays' : kind === 'package' ? 'packages' : 'activities'}/${slug}`)
const shareUrl = (token: string) => `${window.location.origin}${localePath(`/wishlists/${token}`)}`

async function create() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    await api.wishlists.create(newName.value.trim())
    newName.value = ''
    await load()
  }
  catch (e) {
    toast.add({ title: t(`account.errors.${apiErrorCode(e)}`, t('account.errors.generic')), color: 'error' })
  }
  finally {
    creating.value = false
  }
}

const editing = ref<string | null>(null)
const editName = ref('')
function startRename(list: Wishlist) {
  editing.value = list.id
  editName.value = list.name
}
async function rename(list: Wishlist) {
  const name = editName.value.trim()
  if (name && list.id) {
    await api.wishlists.rename(list.id, name)
    list.name = name
  }
  editing.value = null
}

const deleting = ref<Wishlist | null>(null)
const deleteOpen = computed({ get: () => !!deleting.value, set: (v: boolean) => { if (!v) deleting.value = null } })
const deleteBusy = ref(false)
async function remove() {
  if (!deleting.value?.id) return
  deleteBusy.value = true
  try {
    await api.wishlists.remove(deleting.value.id)
    deleting.value = null
    await load()
  }
  finally {
    deleteBusy.value = false
  }
}

async function share(list: Wishlist) {
  if (!list.id) return
  const { share_token } = await api.wishlists.share(list.id)
  list.share_token = share_token
  await copy(shareUrl(share_token))
  toast.add({ title: t('account.wishlist.linkCopied'), color: 'success' })
}

async function unshare(list: Wishlist) {
  if (!list.id) return
  await api.wishlists.unshare(list.id)
  list.share_token = null
}

async function removeItem(list: Wishlist, productId: string) {
  if (!list.id) return
  await api.wishlists.removeItem(list.id, productId)
  list.items = list.items.filter(i => i.product.id !== productId)
  saved.ids.value = (await api.saved.ids()).product_ids
}

async function move(from: Wishlist, productId: string, to: string) {
  if (!from.id) return
  await api.wishlists.put(to, productId, { from: from.id })
  await load()
}
</script>

<template>
  <MzAccountShell :title="t('account.nav.wishlists')" :description="t('account.wishlist.intro')">
    <div v-if="loading" aria-busy="true" class="grid gap-4 sm:grid-cols-2"><MzSkeleton v-for="i in 2" :key="i" class="h-48" /></div>
    <template v-else>
      <section v-for="list in lists" :key="list.id ?? list.name" class="flex flex-col gap-4" :aria-labelledby="`list-${list.id}`">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <form v-if="editing && editing === list.id" class="flex items-center gap-2" @submit.prevent="rename(list)">
            <UInput v-model="editName" maxlength="80" :aria-label="t('account.wishlist.rename')" autofocus />
            <UButton type="submit" :label="t('common.save')" size="sm" />
            <UButton :label="t('common.cancel')" color="neutral" variant="ghost" size="sm" @click="editing = null" />
          </form>
          <h2 v-else :id="`list-${list.id}`" class="font-display text-h3 text-highlighted">
            {{ list.is_default ? t('account.wishlist.defaultName') : list.name }}
            <span class="text-small font-normal text-muted">· {{ t('account.wishlist.count', { n: list.items.length }, list.items.length) }}</span>
          </h2>
          <div class="flex flex-wrap gap-1">
            <UButton v-if="!list.share_token" :label="t('account.wishlist.share')" icon="i-lucide-share-2" color="neutral" variant="ghost" size="sm" @click="share(list)" />
            <template v-else>
              <UButton :label="t('account.wishlist.copyLink')" icon="i-lucide-link" color="neutral" variant="ghost" size="sm" @click="copy(shareUrl(list.share_token)); toast.add({ title: t('account.wishlist.linkCopied') })" />
              <UButton :label="t('account.wishlist.stopSharing')" color="neutral" variant="ghost" size="sm" @click="unshare(list)" />
            </template>
            <template v-if="!list.is_default">
              <UButton :label="t('common.edit')" icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" @click="startRename(list)" />
              <UButton :label="t('common.delete')" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" @click="deleting = list" />
            </template>
          </div>
        </div>
        <p v-if="!list.items.length" class="text-small text-muted">{{ t('account.wishlist.empty') }}</p>
        <ul v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="item in list.items" :key="item.product.id" class="flex flex-col gap-3 rounded-sm p-4 ring ring-default">
            <NuxtLink :to="productPath(item.product.kind, item.product.slug)" class="flex flex-col gap-2">
              <img v-if="item.product.cover" :src="item.product.cover.url" :alt="item.product.cover.alt ?? ''" class="aspect-[3/2] w-full rounded-sm object-cover" loading="lazy">
              <span class="font-medium text-highlighted">{{ item.product.name }}</span>
              <span v-if="item.product.from_price_minor" class="text-small text-muted">{{ t('common.from') }} {{ money(item.product.from_price_minor) }}</span>
            </NuxtLink>
            <div class="mt-auto flex flex-wrap gap-1">
              <UButton :label="t('account.wishlist.removeShort')" icon="i-lucide-heart-off" color="neutral" variant="ghost" size="xs" @click="removeItem(list, item.product.id)" />
              <USelect
                v-if="lists.length > 1"
                :items="lists.filter(l => l.id && l.id !== list.id).map(l => ({ label: l.is_default ? t('account.wishlist.defaultName') : l.name, value: l.id! }))"
                :placeholder="t('account.wishlist.moveTo')"
                :aria-label="t('account.wishlist.moveTo')"
                size="xs"
                class="min-w-32"
                @update:model-value="(v: string) => move(list, item.product.id, v)"
              />
            </div>
          </li>
        </ul>
      </section>
      <form class="flex max-w-md items-end gap-2" @submit.prevent="create">
        <UFormField :label="t('account.wishlist.newList')" class="flex-1">
          <UInput v-model="newName" maxlength="80" class="w-full" />
        </UFormField>
        <UButton type="submit" :label="t('account.wishlist.create')" :loading="creating" :disabled="!newName.trim()" />
      </form>
    </template>
    <MzConfirmDialog
      v-model:open="deleteOpen"
      danger
      :title="t('account.wishlist.confirmDelete', { name: deleting?.name ?? '' })"
      :confirm-label="t('common.delete')"
      :loading="deleteBusy"
      @confirm="remove"
    />
  </MzAccountShell>
</template>
