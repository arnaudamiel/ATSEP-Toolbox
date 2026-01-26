/**
 * Service Worker for ATSEP Toolbox PWA
 * 
 * Implements a cache-first strategy with background updates.
 * All assets are cached for offline use.
 * 
 * @version 10
 */

const CACHE_NAME = 'atsep-calc-v1.10';

/**
 * List of assets to cache for offline use.
 * Update this list when adding new files to the application.
 */
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './constants.js',
    './Vincenty.js',
    './QNH.js',
    './ui.js',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png'
];

/**
 * Install event - caches all static assets.
 * Uses skipWaiting() to activate immediately.
 */
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((error) => {
                console.error('[SW] Failed to cache assets:', error);
            })
    );
});

/**
 * Fetch event - implements stale-while-revalidate strategy.
 * Returns cached response immediately while fetching update in background.
 */
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip cross-origin requests (like Google Fonts)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Start fetching from network in background
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        // Update cache with fresh response
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.log('[SW] Network fetch failed:', error);
                        // Return cached response if network fails
                        return cachedResponse;
                    });

                // Return cached response immediately, update in background
                return cachedResponse || fetchPromise;
            })
    );
});

/**
 * Activate event - cleans up old caches.
 * Uses clients.claim() to take control immediately.
 */
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheWhitelist.indexOf(cacheName) === -1) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

/**
 * Message event - handles messages from the main thread.
 * Currently supports 'skipWaiting' to force immediate activation.
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
