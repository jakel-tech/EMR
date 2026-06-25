const CACHE_NAME = 'hims-cmms-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png'
];

// Installation Event: pre-caches basic shell structure
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell app assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activation Event: cleans up older outdated storage caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((allKeys) => {
      return Promise.all(
        allKeys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Cleaning deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepting fetch calls for network/cache resolution fallback
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip modifying non-GET requests (like POST api submissions)
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle local application routes/assets
  if (requestUrl.origin === self.location.origin) {
    // For API calls, prefer network with zero caching fallback (since HIMS data changes constantly)
    if (requestUrl.pathname.startsWith('/api/')) {
      return; // let native browser handle normally
    }

    // Default strategy: Network first, fallback to cached assets for SPA feel & robustness
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If valid response, open cache and clone
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // For general navigation requests, fallback/match index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          // Return an offline response for other assets to avoid "Failed to fetch"
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
  }
});
