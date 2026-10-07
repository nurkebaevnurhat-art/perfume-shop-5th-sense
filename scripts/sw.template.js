/* 5th SENSE — сервис-воркер приложения (PWA).
   Файл собирается скриптом scripts/build-sw.mjs: не правьте sw.js вручную.
   Сайт целиком сохраняется на телефоне, поэтому каталог открывается без интернета.
   Обновления: при каждом открытии файлы тихо обновляются в фоне,
   новая версия видна при следующем запуске. */
const VERSION = '__VERSION__';
const CACHE = `fs-${VERSION}`;
const FONTS = 'fs-fonts';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Отдаём из кэша сразу и обновляем кэш из сети в фоне.
async function staleWhileRevalidate(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) return cached;
  const fresh = await network;
  if (fresh) return fresh;
  if (fallback) return (await cache.match(fallback)) || Response.error();
  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Шрифты Google: сохраняем после первой загрузки.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Страница: без сети открываем сохранённую главную (маршруты сайта — якоря).
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, CACHE, './index.html'));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, CACHE));
});
