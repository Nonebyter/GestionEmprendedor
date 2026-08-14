/* Service worker: cachea la app para que abra rapido y funcione offline parcialmente. */
const CACHE = 'gestion-static-v2';
const ASSETS = [
  './', './index.html', './carrito.html', './pedido.html', './mis-pedidos.html', './admin.html',
  './assets/css/style.css',
  './assets/js/firebase.js', './assets/js/ui.js', './assets/js/store.js', './assets/js/cart.js',
  './assets/js/pages/catalog.js', './assets/js/pages/cart-page.js', './assets/js/pages/order.js',
  './assets/js/pages/track.js', './assets/js/pages/admin.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Los datos de Firestore siempre van a la red.
  if (/googleapis\.com|firebaseio|firestore/.test(request.url)) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && new URL(request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
  );
});
