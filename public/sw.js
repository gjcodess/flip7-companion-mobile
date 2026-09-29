const CACHE_NAME = 'flip7-static-v5'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/assets/flip7-companion-icon-512-rounded.png', '/assets/flip7-title-logo.png', '/assets/promo-1.png', '/assets/promo-2.png']
const CARD_ARTWORK = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
].map((number) => `/cards/${number}.webp`).concat([
  '/cards/+2.webp', '/cards/+4.webp', '/cards/+6.webp', '/cards/+8.webp', '/cards/+10.webp',
  '/cards/x2.webp', '/cards/Back.webp', '/cards/FLIP%20THREE.webp', '/cards/FREEZE.webp', '/cards/SECOND%20CHANCE.webp',
])
const PRECACHE = APP_SHELL.concat(CARD_ARTWORK)

async function saveResponse(request, response) {
  if (!response || !response.ok) return response
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  const isImage = request.destination === 'image' || url.pathname.startsWith('/cards/') || url.pathname.startsWith('/assets/')
  if (isImage) {
    const refresh = fetch(request).then((response) => saveResponse(request, response)).catch(() => undefined)
    event.waitUntil(refresh)
    event.respondWith(caches.match(request).then((cached) => cached || refresh.then((response) => response || new Response('', { status: 504 }))))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => saveResponse(request, response)).catch(async () => (await caches.match('/index.html')) || Response.error()))
  }
})
