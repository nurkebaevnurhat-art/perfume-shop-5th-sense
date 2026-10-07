/* 5th SENSE — сервис-воркер приложения (PWA).
   Файл собирается скриптом scripts/build-sw.mjs: не правьте sw.js вручную.
   Сайт целиком сохраняется на телефоне, поэтому каталог открывается без интернета.
   Обновления: при каждом открытии файлы тихо обновляются в фоне,
   новая версия видна при следующем запуске. */
const VERSION = '67c1f6a32a';
const CACHE = `fs-${VERSION}`;
const FONTS = 'fs-fonts';
const PRECACHE = [
  "./",
  "assets/css/style.css",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-512.png",
  "assets/img/favicon.svg",
  "assets/img/fibers.svg",
  "assets/img/grain.svg",
  "assets/img/logo-intro.png",
  "assets/js/api.js",
  "assets/js/app.js",
  "assets/js/bottle.js",
  "assets/js/config.js",
  "assets/js/data.js",
  "assets/js/motion.js",
  "assets/js/pwa.js",
  "assets/js/store.js",
  "assets/js/ui.js",
  "assets/js/views/admin.js",
  "assets/js/views/catalog.js",
  "assets/js/views/checkout.js",
  "assets/js/views/home.js",
  "assets/js/views/pages.js",
  "assets/js/views/product.js",
  "assets/products/armani-stronger-with-you-intensely.jpg",
  "assets/products/baccarat-rouge-540.jpg",
  "assets/products/byredo-bal-dafrique.jpg",
  "assets/products/byredo-blanche.jpg",
  "assets/products/byredo-sundazed.jpg",
  "assets/products/clive-christian-1872.jpg",
  "assets/products/clive-christian-matsukita.jpg",
  "assets/products/creed-green-irish-tweed.jpg",
  "assets/products/crivelli-oud-maracuja.jpg",
  "assets/products/dg-the-one.jpg",
  "assets/products/dior-sauvage-elixir.jpg",
  "assets/products/jo-malone-peony-blush-suede.jpg",
  "assets/products/kilian-straight-to-heaven.jpg",
  "assets/products/layton.jpg",
  "assets/products/le-labo-the-matcha-26.jpg",
  "assets/products/le-labo-the-noir-29.jpg",
  "assets/products/lv-afternoon-swim.jpg",
  "assets/products/lv-imagination.jpg",
  "assets/products/lv-les-sables-roses.jpg",
  "assets/products/lv-stellar-times.jpg",
  "assets/products/lv-symphony.jpg",
  "assets/products/marly-althair.jpg",
  "assets/products/montale-vanilla-extasy.jpg",
  "assets/products/oud-wood.jpg",
  "assets/products/santal-33.jpg",
  "assets/products/tom-ford-ombre-leather.jpg",
  "index.html",
  "manifest.webmanifest"
];

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
  // Запросы к серверу (заказы, админка) всегда идут в сеть.
  if (url.pathname.startsWith('/api/')) return;

  // Страница: без сети открываем сохранённую главную (маршруты сайта — якоря).
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, CACHE, './index.html'));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, CACHE));
});
