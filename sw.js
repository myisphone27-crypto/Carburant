// ============================================================
//  SERVICE WORKER — Suivi Carburant (PWA offline)
//  ⚠️ Pour publier une mise à jour : v1 → v2 → v3...
// ============================================================
const CACHE_NAME = 'carburant-v1';

const APP_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// INSTALLATION : mise en cache de l'application
self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            const appPromises = APP_ASSETS.map(function (url) {
                return cache.add(url).catch(function () { /* fichier optionnel */ });
            });
            const cdnPromises = CDN_ASSETS.map(function (url) {
                return fetch(new Request(url, { mode: 'cors' })).then(function (res) {
                    if (res && res.ok) return cache.put(url, res);
                }).catch(function () { /* CDN indisponible */ });
            });
            return Promise.all(appPromises.concat(cdnPromises));
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

// ACTIVATION : suppression des anciens caches
self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) {
                if (k !== CACHE_NAME) return caches.delete(k);
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// FETCH : cache d'abord, mise à jour en arrière-plan (Stale-While-Revalidate)
self.addEventListener('fetch', function (e) {
    if (e.request.method !== 'GET') return;

    e.respondWith(
        caches.match(e.request).then(function (cached) {
            const network = fetch(e.request).then(function (res) {
                if (res && (res.ok || res.type === 'opaque')) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
                }
                return res;
            }).catch(function () {
                if (cached) return cached;
                // Hors ligne : servir la page principale pour la navigation
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Hors ligne', { status: 503, statusText: 'Offline' });
            });
            return cached || network;
        })
    );
});