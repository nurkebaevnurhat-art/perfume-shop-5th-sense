# Архитектура сайта 5th SENSE

## Файлы

```
index.html                 оболочка: шрифты, manifest, заставка, шторка, порядок скриптов
assets/css/style.css       все стили: токены :root, компоненты, админка
assets/js/telegram.js      мини-приложение Telegram (грузится первым: чистит #tgWebAppData)
assets/js/config.js        FS.config (бренд, контакты, seller, валюта), FS.delivery, FS.paymentMethods
assets/js/data.js          FS.families, FS.categories, FS.defaultProducts (исходный каталог)
assets/js/bottle.js        чертёж/иллюстрация флакона, если нет фото (product.bottle)
assets/js/store.js         FS.storage (localStorage с запасным вариантом в памяти), корзина, избранное
assets/js/api.js           FS.catalog, FS.backend, FS.api (поиск, фильтры, заказы), FS.payments, FS.shipping
assets/js/motion.js        анимации, заставка, курсор, fit() для крупного логотипа
assets/js/ui.js            шапка, подвал, карточки, корзина, поиск, toast
assets/js/views/*.js       home, catalog (+favorites), product, checkout, pages (доставка, оферта,
                           политика, возврат, FS.legal), admin
assets/js/importer.js      Excel/CSV ⇄ каталог (SheetJS с cdnjs, грузится по требованию)
assets/js/pwa.js           сервис-воркер и предложение установить приложение
assets/js/app.js           маршрутизатор, переходы со шторкой, первичная загрузка каталога
assets/products/           фото исходных товаров (имя = id)
assets/files/              шаблон таблицы каталога
api/*.js, server/*.js      сервер (см. server.md)
scripts/build-sw.mjs       sw.js из scripts/sw.template.js (версия = хэш файлов)
scripts/build-single.mjs   dist/5th-sense.html — всё в одном файле (демо-режим, без сервера)
scripts/export-site.mjs    public/ для Vercel (buildCommand в vercel.json)
vercel.json                сборка, заголовки, includeFiles для функций, которым нужен каталог
netlify.toml, _headers, _redirects   запасной хостинг (только демо-режим)
```

## Маршруты (`FS.app.resolve`)

`home`, `aromaty`/`vitriny`/`boutique` (якоря главной), `catalog`, `catalog-<категория>`,
`family-<семейство>`, `product-<id>`, `checkout`, `favorites`, `delivery`, `offer`,
`privacy`, `returns`, `admin`, `admin-orders|products|data`, `admin-new`, `admin-edit-<id>`.
Ссылки с `target="_blank"` роутер не перехватывает (оферта из формы заказа).

`render(route, force, quiet)`: `quiet` — тихая перерисовка той же страницы без
шторки и прокрутки (используется, когда с сервера пришёл новый каталог).

## Слой данных

- `FS.backend`: `usable` (https/localhost и не однофайловая сборка), `status()` →
  `/api/status` (`storage`, `telegram`, `admin`, `accepting`), `call(method, path, body, {auth|key})`,
  пароль админки хранится в sessionStorage и уходит как `Bearer encodeURIComponent(пароль)`.
- `FS.catalog`: источник `server` (копия в localStorage `fs.catalog.server`), `local`
  (правки демо-админки, `fs.catalog.v1`) или `file` (data.js). `sync()` тянет
  `/api/products`; при первом визите без копии роутер ждёт его до 2,5 с.
- `FS.api`: `filter`, `related`, `brands`, `mainVolume`…; правки каталога
  (`upsertProduct`, `deleteProduct`, `replaceCatalog`, `resetCatalog`) сами идут на
  сервер, когда `remoteCatalog()` (есть хранилище + пароль админки); `onChange` —
  слушатели перерисовки.
- Заказы: `createOrder` → `/api/orders`, если сервер принимает заказы, иначе в
  localStorage; админка читает `loadOrders()`; `updateOrder(number, patch, {saved, error})`.

## Товар (формат)

```
{ id, type: 'perfume'|'set', name, brand, gender: men|women|unisex, family (id из FS.families),
  concentration: EDP|EDT|Parfum|Extrait|Cologne, year, perfumer, country,
  niche, bestseller, isNew, featured, volumes: [{ ml, price, stock, label? }], main (ml),
  short, description, notes: { top[], heart[], base[] }, longevity 1–5, sillage 1–5,
  bottle: { shape, cap, liquid, capColor, label }, image?, photo? (имя файла из таблицы) }
```
`image` — `assets/products/<файл>` или `/api/image?n=<имя без расширения>&v=<версия>`.

## Сборки

- Однофайловая (`dist/5th-sense.html`) — для показа без хостинга: инлайнит
  изображения в `FS.assets`; в ней `FS.backend.usable === false` → демо-режим.
- PWA: `sw.js` precache (кроме `assets/products` и `assets/files` — они кэшируются по
  мере просмотра), stale-while-revalidate, `/api/` не кэшируется.
  Регистрируется только на https/localhost и при наличии manifest.
