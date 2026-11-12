// Offline support for the guest's tickets: the app shell and scripts are cached as they are
// fetched; ticket pages fall back to the last copy when there is no network. Nothing else
// (no API response, no personal data) is cached here: the ticket itself is kept by the page.
const CACHE = 'mz-offline-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  const isAsset = url.pathname.startsWith('/_nuxt/') || url.pathname.startsWith('/_fonts/')
  const isTicket = req.mode === 'navigate' && /\/account\/trips\/[^/]+\/ticket\/?$/.test(url.pathname)
  if (isAsset) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(req).then(hit => hit || fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone())
      return res
    }))))
  }
  else if (isTicket) {
    event.respondWith(fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then(cache => cache.put(req, copy))
      return res
    }).catch(() => caches.match(req)))
  }
})
