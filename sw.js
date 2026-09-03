/**
 * ====================================================================================
 * SERVICE WORKER - IGR KIDS (PROTOCOLO CORPORATIVO V58)
 * Code Ahumada 2026
 * ====================================================================================
 */

const CACHE_NAME = 'igr-kids-v58';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=58',
  './app.js?v=58',
  './manifest.json?v=58',
  './manifest.json',
  './icons/favicon.png?v=58',
  './icons/favicon.png',
  './icons/apple-touch-icon.png?v=58',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png?v=58',
  './icons/icon-192.png',
  './icons/icon-512.png?v=58',
  './icons/icon-512.png',
  './icons/logo-icon.png?v=58',
  './icons/logo-icon.png',
  './icons/app-logo-full.png?v=58',
  './icons/app-logo-full.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js'
];

// Install Event - Pre-cache core shell & skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW v54] Pre-caching partial warning:', err);
      });
    })
  );
});

// Activate Event - Clean old caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW v54] Eliminando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-First for HTML/Navigations, Stale-while-revalidate for local assets, network-only for live API
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass cache for Google Apps Script, Sheet links and WhatsApp
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('script.googleusercontent.com') ||
    url.hostname.includes('wa.me') ||
    url.searchParams.has('callback')
  ) {
    return;
  }

  // Strategy 1: Network-First for HTML navigations / root documents (always fetch fresh HTML first)
  const isNavigate = event.request.mode === 'navigate';
  const isHtml = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');

  if (isNavigate || isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('./index.html') || caches.match('./');
          });
        })
    );
    return;
  }

  // Strategy 2: Stale-While-Revalidate for CSS, JS, Images, Fonts and External CDNs
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
