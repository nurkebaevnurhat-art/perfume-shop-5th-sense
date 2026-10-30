/* 5th SENSE — сервис-воркер приложения (PWA).
   Файл собирается скриптом scripts/build-sw.mjs: не правьте sw.js вручную.
   Сайт целиком сохраняется на телефоне, поэтому каталог открывается без интернета.
   Обновления: страница, стили и код при интернете берутся из сети (сохранённая копия —
   только без связи или если сеть не ответила за 3 секунды), поэтому после выкладки
   новая версия видна с первого же открытия. Фото — из копии, обновляются в фоне. */
const VERSION = '4beecfe735';
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
  "assets/js/importer.js",
  "assets/js/motion.js",
  "assets/js/pwa.js",
  "assets/js/qr.js",
  "assets/js/seo.js",
  "assets/js/store.js",
  "assets/js/telegram.js",
  "assets/js/ui.js",
  "assets/js/views/admin.js",
  "assets/js/views/card.js",
  "assets/js/views/catalog.js",
  "assets/js/views/checkout.js",
  "assets/js/views/home.js",
  "assets/js/views/kassa.js",
  "assets/js/views/pages.js",
  "assets/js/views/podbor.js",
  "assets/js/views/product.js",
  "index.html",
  "kassa.webmanifest",
  "kassa/index.html",
  "manifest.webmanifest"
];

self.addEventListener('install', (event) => {
  // cache: 'reload' — мимо кэша браузера, чтобы в новую версию не попали старые файлы.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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

// Сначала сеть (свежая версия сайта), без сети или при долгом ответе — сохранённая копия.
// store: false — не сохранять ответ (страницы /product-x: без сети их заменяет index.html).
async function networkFirst(request, cacheName, fallback, store = true) {
  const cache = await caches.open(cacheName);
  const key = request;
  const network = fetch(request, { cache: 'no-cache' }).then((res) => {
    if (store && res && res.ok) cache.put(key, res.clone());
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 3000, null));
  try {
    const res = await Promise.race([network, slow]);
    if (res && res.ok) return res;
  } catch (e) { /* нет сети */ }
  const cached = (await cache.match(key, { ignoreSearch: true })) || (fallback && (await cache.match(fallback)));
  if (cached) return cached;
  return network.catch(() => Response.error());
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

  // Страница: без сети открываем сохранённую главную. Адреса страниц сайта
  // (/catalog, /product-x) — та же index.html: сайт сам нарисует нужную страницу.
  if (request.mode === 'navigate') {
    const page = /^\/[a-z0-9-]+$/.test(url.pathname);
    event.respondWith(networkFirst(request, CACHE, './index.html', !page));
    return;
  }
  // Код и стили — тоже свежие: иначе новая страница открылась бы со старым оформлением.
  if (/\.(js|css|webmanifest)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, CACHE));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, CACHE));
});
