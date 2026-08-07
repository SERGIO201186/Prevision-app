// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER — Verificar Certificado · Servicios Funerarios Huerta
// Vive en /verificar/ para tener su propio scope de PWA, independiente
// del sistema principal — así se puede instalar por separado.
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'huerta-verificar-v1';

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return fetch(self.registration.scope + 'index.html')
                .then(function(response) {
                    if (response.ok) return cache.put(self.registration.scope + 'index.html', response);
                })
                .catch(function() {
                    // Sin conexión al instalar — no bloquear
                });
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE_NAME; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    const url = event.request.url;

    // Google Apps Script — siempre red, nunca cachear (los datos deben ser frescos)
    if (url.includes('script.google.com') || url.includes('googleapis.com')) {
        event.respondWith(
            fetch(event.request).catch(function() {
                return new Response(
                    JSON.stringify({ result: 'error', message: 'Sin conexión a Internet' }),
                    { headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // CDNs (Tailwind, Lucide) — red primero, cache como respaldo
    if (url.includes('cdn.tailwindcss.com') || url.includes('unpkg.com')) {
        event.respondWith(
            fetch(event.request).then(function(response) {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
                }
                return response;
            }).catch(function() {
                return caches.match(event.request);
            })
        );
        return;
    }

    // Página de verificación — cache primero, actualizar en background
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            const networkFetch = fetch(event.request).then(function(response) {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
                }
                return response;
            }).catch(function() { return null; });

            return cached || networkFetch;
        })
    );
});

// Mensajes desde la app
self.addEventListener('message', function(event) {
    if (!event.data) return;

    if (event.data.type === 'CACHE_PAGE') {
        const url = event.data.url;
        caches.open(CACHE_NAME).then(function(cache) {
            return fetch(url).then(function(response) {
                if (response.ok) return cache.put(url, response);
            }).catch(function() {});
        });
    }

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
