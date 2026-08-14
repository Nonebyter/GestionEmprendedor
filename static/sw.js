/* Service worker: cache de recursos estaticos + pagina offline. */
const CACHE = 'gestion-v1';
const ASSETS = [
  '/offline',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/cart.js',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Estaticos e imagenes: cache primero.
  if (url.origin === self.location.origin && url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy));
        return res;
      }))
    );
    return;
  }

  // Navegacion: red primero, offline como respaldo.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline')));
  }
});
