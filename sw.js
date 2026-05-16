const CACHE_VERSION = 'v2';
const PRECACHE = `gpa-precache-${CACHE_VERSION}`;
const RUNTIME = `gpa-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/gods_plan_academy_portal.html',
  '/api.js',
  '/manifest.webmanifest',
  '/offline.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const currentCaches = [PRECACHE, RUNTIME];
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => { if (!currentCaches.includes(key)) return caches.delete(key); })
    ))
  );
  self.clients.claim();
});

// A helper for network-first with timeout
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || caches.match('/offline.html');
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Always serve navigation requests with network-first, fallback to offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // API requests: network-first (so content is fresh)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('railway.app')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Images & static assets: cache-first with runtime cache
  if (request.destination === 'image' || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(resp => {
        return caches.open(RUNTIME).then(cache => { cache.put(request, resp.clone()); return resp; });
      }).catch(()=> caches.match('/offline.html')))
    );
    return;
  }

  // Default: try cache, otherwise network
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).catch(()=>caches.match('/offline.html'))));
});
