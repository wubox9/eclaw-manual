// sw.js — Service Worker for eclaw-phone PWA
// Handles: offline caching, network-first strategy

const CACHE_NAME = 'eclaw-phone-v17'
const APP_SHELL = [
  '/',
  '/index.html',
  '/icons/icon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/manifest.json'
]

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

// Fetch: network-first for same-origin static assets, fall back to cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return
  if (request.url.includes('ws://') || request.url.includes('wss://')) return

  // Only cache same-origin requests (skip cross-origin and API calls)
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Only cache navigations and static assets (html, js, css, images, fonts, manifest)
  const isCacheable = request.mode === 'navigate'
    || /\.(js|css|svg|png|ico|woff2?|ttf|json|webmanifest)$/i.test(url.pathname)
    || url.pathname.startsWith('/assets/')

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && isCacheable) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then(r => {
        if (r) return r
        if (request.mode === 'navigate') return caches.match('/index.html')
        return new Response('Offline', { status: 503 })
      }))
  )
})
