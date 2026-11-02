// Hors ligne : on sert le cache tout de suite et on le rafraîchit en arrière-plan,
// pour qu'une mise à jour arrive sans jamais bloquer l'appli quand l'envie est là.
const CACHE = 'souffle-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/model.js', 'js/lungs.js', 'js/content.js', 'js/store.js',
  'assets/lungs-a.png', 'assets/lungs-b.png', 'assets/lungs-c.png',
  'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      const refresh = fetch(e.request)
        .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => hit);
      if (hit) { e.waitUntil(refresh); return hit; }
      return refresh;
    }),
  );
});
