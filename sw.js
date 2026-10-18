// Guarda la app en el móvil para que abra rápido y funcione sin conexión
// (los filtros de cara necesitan internet solo la primera vez).
const CACHE = 'tiktoff-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const CACHEABLE = url =>
  url.origin === self.location.origin ||
  url.hostname === 'storage.googleapis.com' ||
  url.hostname === 'fonts.googleapis.com' ||
  url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!CACHEABLE(url)) return;

  // La página: primero la red (para recibir actualizaciones), si no hay, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // Todo lo demás (librería de caras, modelo, iconos, fuentes): primero la copia guardada.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
