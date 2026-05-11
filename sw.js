// Service worker for Golf Games PWA
// Strategy:
//   - network-first for navigation (HTML) so deploys surface instantly
//   - cache-first for fonts + icons so offline on the course just works
// Bump CACHE_VERSION if you need to force old caches to be evicted.

const CACHE_VERSION = 'v5';
const CACHE = `golf-games-${CACHE_VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './data/courses.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-first for navigation/HTML — so users always see the latest deploy when online,
  // but fall back to the cached shell when offline.
  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
          return resp;
        })
        .catch(() =>
          caches.match(req).then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first for everything else (icons, fonts, manifest).
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(resp => {
          const shouldCache =
            resp &&
            resp.status === 200 &&
            (url.origin === location.origin ||
             url.hostname === 'fonts.googleapis.com' ||
             url.hostname === 'fonts.gstatic.com');
          if (shouldCache) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => new Response('', { status: 503, statusText: 'offline' }));
    })
  );
});
