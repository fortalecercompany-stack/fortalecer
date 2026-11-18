// FORTALECER · permite instalar la página como aplicación y abrirla aunque falle la señal.
// Nunca guarda respuestas de la base de datos: solo los archivos de la página.
const VERSION = 'fortalecer-20';
const BASE = ['./', 'index.html', 'css/app.css?v=20', 'config.js?v=20', 'js/main.js?v=20', 'js/efectos.js?v=20', 'manifest.webmanifest', 'icono-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).catch(() => { })); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Primero la red (para tener siempre la última versión); si no hay señal, la copia guardada.
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
