/* 5th SENSE — слой доступа к данным.
   Весь интерфейс получает данные только через FS.api, FS.payments и FS.shipping.
   Заказы идут на сервер (FS.backend, папка api/ в корне проекта), каталог
   пока хранится в data.js; чтобы перенести его в базу, замените FS.catalog
   на запросы к серверу (например, fetch('/api/products')). */
window.FS = window.FS || {};

/* Пути к файлам (фото товаров). При сборке в один файл сюда подставляются
   встроенные данные; на обычном хостинге путь возвращается как есть. */
FS.assetUrl = (path) => (path && FS.assets && FS.assets[path]) || path;

/* Каталог. Источники по порядку:
   1) сервер (/api/products), когда каталог загружен из админки, — последняя копия
      хранится в браузере, чтобы сайт открывался сразу и без интернета;
   2) правки из демо-админки в этом браузере (если сервера нет);
   3) исходные данные FS.defaultProducts (data.js). */
FS.catalog = (function () {
  const KEY = 'fs.catalog.v1';
  const SERVER_KEY = 'fs.catalog.server';
  // Товары, снятые с продажи: убираются и из каталога, сохранённого в браузере через админку.
  const REMOVED = ['set-five-senses', 'set-evening'];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  let source = 'file';
  let version = null;

  function fromServerCache() {
    const cached = FS.storage.get(SERVER_KEY, null);
    return cached && Array.isArray(cached.products) && cached.products.length ? cached : null;
  }

  return {
    load() {
      const server = fromServerCache();
      if (server) {
        source = 'server';
        version = server.version;
        FS.products = server.products;
        return FS.products;
      }
      const saved = FS.storage.get(KEY, null);
      const list = Array.isArray(saved) ? saved.filter((p) => !REMOVED.includes(p.id)) : [];
      source = list.length ? 'local' : 'file';
      FS.products = list.length ? list : clone(FS.defaultProducts);
      return FS.products;
    },
    save(list) {
      if (source === 'server') { // правки админки уже ушли на сервер, обновляем копию в браузере
        FS.products = list;
        return FS.storage.set(SERVER_KEY, { version, products: list }) || true;
      }
      const ok = FS.storage.set(KEY, list);
      FS.products = list;
      if (ok) source = 'local';
      return ok;
    },
    reset() {
      FS.storage.remove(KEY);
      FS.storage.remove(SERVER_KEY);
      source = 'file';
      version = null;
      FS.products = clone(FS.defaultProducts);
    },
    isCustom: () => source !== 'file',
    source: () => source,
    hasCache: () => Boolean(fromServerCache()),

    /* Свежий каталог с сервера. true — каталог изменился (нужно перерисовать). */
    async sync() {
      if (!FS.backend.usable) return false;
      let data;
      try { data = await FS.backend.call('GET', '/api/products'); } catch (e) { return false; }
      if (!data) return false;
      if (!data.products) { // на сервере каталога нет — работаем по data.js
        if (source !== 'server') return false;
        FS.storage.remove(SERVER_KEY);
        this.load();
        return true;
      }
      if (source === 'server' && data.version && data.version === version) return false;
      source = 'server';
      version = data.version;
      FS.products = data.products;
      FS.storage.set(SERVER_KEY, { version, products: data.products });
      return true;
    },
    // Ответ сервера после правки из админки.
    serverSaved(meta) {
      source = 'server';
      if (meta && meta.version) version = meta.version;
      FS.storage.set(SERVER_KEY, { version, products: FS.products });
    }
  };
})();
FS.catalog.load();

/* Сервер (Vercel Functions в папке api/). Если сервер не отвечает (локальный
   просмотр, сборка в один файл, хостинг без функций), сайт работает в
   демо-режиме: заказы сохраняются только в браузере. */
FS.backend = (function () {
  const KEY_STORE = 'fs.admin.key';
  const usable = /^https?:$/.test(location.protocol) && !FS.assets;
  let pending = null;
  let info;
  let memoryKey = '';

  function status() {
    if (!pending) {
      const ask = usable
        ? fetch('/api/status', { cache: 'no-store', headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => (j && j.ok ? j : null))
          .catch(() => null)
        : Promise.resolve(null);
      pending = ask.then((j) => { info = j; return j; });
    }
    return pending;
  }

  function adminKey() {
    try { return sessionStorage.getItem(KEY_STORE) || memoryKey; } catch (e) { return memoryKey; }
  }
  function setAdminKey(key) {
    memoryKey = key || '';
    try { if (key) sessionStorage.setItem(KEY_STORE, key); else sessionStorage.removeItem(KEY_STORE); } catch (e) { /* только память */ }
  }

  async function call(method, path, body, opts) {
    const o = opts || {};
    const headers = { Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    const key = o.key !== undefined ? o.key : (o.auth ? adminKey() : '');
    if (key) headers.Authorization = 'Bearer ' + encodeURIComponent(key);
    let res;
    try {
      res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch (e) {
      throw Object.assign(new Error('Нет соединения с сервером'), { code: 'network', status: 0 });
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* не JSON */ }
    if (!res.ok) {
      throw Object.assign(new Error((data && data.message) || `Ошибка сервера (${res.status})`), { code: data && data.error, status: res.status });
    }
    return data;
  }

  return {
    usable,
    status,
    // undefined — ещё проверяем, null — сервера нет (демо-режим).
    get info() { return info; },
    known: () => info !== undefined,
    accepting: () => Boolean(info && info.accepting),
    call,
    adminKey,
    setAdminKey
  };
})();

FS.api = (function () {
  let byId = new Map();
  let popularity = new Map();
  let index = new Map();
  const listeners = new Set();

  function minPrice(p) { return Math.min(...p.volumes.map((v) => v.price)); }
  function mainVolume(p) { return p.volumes.find((v) => v.ml === p.main) || p.volumes[0]; }
  function inStock(p) { return p.volumes.some((v) => v.stock > 0); }
  function totalStock(p) { return p.volumes.reduce((s, v) => s + v.stock, 0); }

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/['’`]/g, '').trim();
  }

  function haystack(p) {
    const fam = FS.families.find((f) => f.id === p.family);
    return normalize([p.name, p.brand, p.short, fam && fam.name, ...p.notes.top, ...p.notes.heart, ...p.notes.base].join(' '));
  }

  // Индексы пересобираются после каждого изменения каталога.
  function rebuild() {
    byId = new Map(FS.products.map((p) => [p.id, p]));
    // Популярность: бестселлеры и витринные позиции выше, затем по порядку в каталоге.
    popularity = new Map(FS.products.map((p, i) => [p.id, (p.bestseller ? 100 : 0) + (p.featured ? 50 : 0) - i]));
    index = new Map(FS.products.map((p) => [p.id, haystack(p)]));
  }
  rebuild();

  const flag = (v) => (v ? 1 : 0);
  const SORTS = {
    popular: (a, b) => popularity.get(b.id) - popularity.get(a.id),
    new: (a, b) => (flag(b.isNew) - flag(a.isNew)) || ((b.year || 0) - (a.year || 0)),
    'price-asc': (a, b) => mainVolume(a).price - mainVolume(b).price,
    'price-desc': (a, b) => mainVolume(b).price - mainVolume(a).price,
    name: (a, b) => a.name.localeCompare(b.name, 'ru')
  };

  /* query: { category, families[], brands[], genders[], priceMin, priceMax, q, inStock, sort, ids[] } */
  function filter(query) {
    const q = query || {};
    const cat = FS.categories.find((c) => c.id === q.category);
    const words = normalize(q.q).split(/\s+/).filter(Boolean);
    let list = FS.products.filter((p) => {
      if (cat && !cat.match(p)) return false;
      if (q.ids && !q.ids.includes(p.id)) return false;
      if (q.families && q.families.length && !q.families.includes(p.family)) return false;
      if (q.brands && q.brands.length && !q.brands.includes(p.brand)) return false;
      if (q.genders && q.genders.length && !q.genders.includes(p.gender)) return false;
      const price = mainVolume(p).price;
      if (q.priceMin && price < q.priceMin) return false;
      if (q.priceMax && price > q.priceMax) return false;
      if (q.inStock && !inStock(p)) return false;
      if (words.length) {
        const text = index.get(p.id);
        if (!words.every((w) => text.includes(w))) return false;
      }
      return true;
    });
    list = list.slice().sort(SORTS[q.sort] || SORTS.popular);
    return list;
  }

  // Похожие ароматы: то же семейство, затем общие ноты, затем тот же пол.
  function related(p, limit) {
    const notes = new Set([...p.notes.top, ...p.notes.heart, ...p.notes.base]);
    return FS.products
      .filter((o) => o.id !== p.id && o.type === 'perfume')
      .map((o) => {
        const shared = [...o.notes.top, ...o.notes.heart, ...o.notes.base].filter((n) => notes.has(n)).length;
        const score = (o.family === p.family ? 6 : 0) + shared * 2 + (o.gender === p.gender || o.gender === 'unisex' ? 1 : 0);
        return { o, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit || 4)
      .map((x) => x.o);
  }

  function brands() {
    return [...new Set(FS.products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b));
  }

  /* --- Изменение каталога (админ-панель) ---
     С сервером (есть хранилище и вход по паролю) правки сохраняются на сервере
     и сразу видны всем покупателям; без сервера — только в этом браузере. */
  const remoteCatalog = () => Boolean(FS.backend.info && FS.backend.info.storage && FS.backend.info.admin && FS.backend.adminKey());
  const notify = () => listeners.forEach((fn) => fn());

  function commit() {
    const ok = FS.catalog.save(FS.products);
    rebuild();
    notify();
    return ok;
  }

  function saveRemote(method, path, body) {
    return FS.backend.call(method, path, body, { auth: true })
      .then((data) => { FS.catalog.serverSaved(data && (data.meta || data)); return data; })
      .catch((err) => {
        FS.ui.toast(`Изменение не сохранено на сервере: ${err.message}`, null, { duration: 8000 });
        throw err;
      });
  }

  // Возвращает true сразу; с сервером onSaved/ошибка приходят позже.
  function upsertProduct(product) {
    const i = FS.products.findIndex((p) => p.id === product.id);
    if (i >= 0) FS.products[i] = product; else FS.products.unshift(product);
    const ok = commit();
    if (remoteCatalog()) {
      return saveRemote('PATCH', '/api/products', { product }).then((data) => {
        // Сервер мог подставить фото по имени файла.
        const j = FS.products.findIndex((p) => p.id === product.id);
        if (j >= 0 && data.product) { FS.products[j] = data.product; commit(); }
        return true;
      }).catch(() => false);
    }
    return ok;
  }

  function deleteProduct(id) {
    FS.products = FS.products.filter((p) => p.id !== id);
    const ok = commit();
    if (remoteCatalog()) return saveRemote('DELETE', `/api/products?id=${encodeURIComponent(id)}`).then(() => true).catch(() => false);
    return ok;
  }

  function replaceCatalog(list) {
    if (remoteCatalog()) {
      return FS.backend.call('PUT', '/api/products', { products: list }, { auth: true }).then(async () => {
        await FS.catalog.sync(); // забираем каталог с подставленными фото
        rebuild();
        notify();
        return true;
      });
    }
    FS.products = list;
    return commit();
  }

  function resetCatalog() {
    const done = () => { FS.catalog.reset(); rebuild(); notify(); };
    if (remoteCatalog()) return FS.backend.call('POST', '/api/products', { action: 'reset' }, { auth: true }).then(done);
    done();
    return true;
  }

  // Каталог пришёл с сервера (при открытии сайта).
  function refreshProducts() {
    rebuild();
    notify();
  }

  // Изменение остатка по позициям заказа: sign = -1 списать, +1 вернуть.
  function moveStock(items, sign) {
    items.forEach((item) => {
      const p = byId.get(item.id);
      const v = p && p.volumes.find((x) => x.ml === item.ml);
      if (v) v.stock = Math.max(0, v.stock + sign * item.qty);
    });
    commit();
  }

  /* --- Заказы ---
     С сервером заказы уходят на /api/orders (хранилище и Telegram),
     админка читает их оттуда же. Без сервера (демо) — localStorage этого браузера. */
  const ORDERS_KEY = 'fs.orders.v1';
  const STATUSES = [
    { id: 'new', name: 'Новый' },
    { id: 'confirmed', name: 'Подтверждён' },
    { id: 'shipped', name: 'Передан в доставку' },
    { id: 'done', name: 'Выполнен' },
    { id: 'cancelled', name: 'Отменён' }
  ];
  const PAYMENT_STATUSES = [
    { id: 'unpaid', name: 'Не оплачен' },
    { id: 'paid', name: 'Оплачен' }
  ];

  let remote = null; // заказы с сервера, когда админка работает через него
  const remoteMode = () => remote !== null;
  const orders = () => remote || FS.storage.get(ORDERS_KEY, []);

  async function createOrder(order) {
    await FS.backend.status();
    if (FS.backend.accepting()) {
      // Склад ведёт магазин: в браузере покупателя остатки не меняем.
      const data = await FS.backend.call('POST', '/api/orders', order, { auth: Boolean(order.test) });
      if (remote) remote.push(data.order);
      return data.order;
    }
    const number = '5S-' + Date.now().toString(36).toUpperCase().slice(-6);
    const record = { ...order, number, status: 'new', paymentStatus: 'unpaid', createdAt: new Date().toISOString() };
    const list = FS.storage.get(ORDERS_KEY, []);
    list.push(record);
    FS.storage.set(ORDERS_KEY, list);
    moveStock(record.items, -1);
    return record;
  }

  // Заказы с сервера для админки. Без хранилища на сервере список пуст.
  async function loadOrders() {
    const info = FS.backend.info;
    if (!info || !info.storage) { remote = []; return remote; }
    const data = await FS.backend.call('GET', '/api/orders', null, { auth: true });
    remote = data.orders || [];
    return remote;
  }
  function forgetOrders() { remote = null; }

  /* Меняет статус сразу на экране. В демо отмена возвращает товар на склад,
     возобновление снова списывает; с сервером изменение сохраняется там:
     on.saved(data) — сервер принял (data.customerNotified — сколько сообщений
     ушло покупателю в Telegram), on.error(err, order) — не принял. */
  function updateOrder(number, patch, on) {
    const handlers = on || {};
    const list = orders();
    const o = list.find((x) => x.number === number);
    if (!o) return null;
    const before = { ...o };
    Object.assign(o, patch, { updatedAt: new Date().toISOString() });
    if (remoteMode()) {
      FS.backend.call('PATCH', '/api/orders', { number, ...patch }, { auth: true })
        .then((data) => { Object.assign(o, data.order); if (handlers.saved) handlers.saved(data, o); })
        .catch((err) => { Object.assign(o, before); if (handlers.error) handlers.error(err, o); });
      return o;
    }
    const wasCancelled = before.status === 'cancelled';
    const isCancelled = o.status === 'cancelled';
    if (!wasCancelled && isCancelled) moveStock(o.items, +1);
    if (wasCancelled && !isCancelled) moveStock(o.items, -1);
    FS.storage.set(ORDERS_KEY, list);
    return o;
  }

  async function clearOrders() {
    if (remoteMode()) {
      await FS.backend.call('DELETE', '/api/orders', null, { auth: true });
      remote = [];
      return;
    }
    FS.storage.remove(ORDERS_KEY);
  }

  return {
    productSync: (id) => byId.get(id),
    async product(id) { return byId.get(id) || null; },
    async products(query) { return filter(query); },
    filter,
    related,
    brands,
    minPrice,
    mainVolume,
    inStock,
    totalStock,
    upsertProduct,
    deleteProduct,
    resetCatalog,
    replaceCatalog,
    refreshProducts,
    remoteCatalog,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    createOrder,
    updateOrder,
    clearOrders,
    loadOrders,
    forgetOrders,
    remoteOrders: remoteMode,
    orders,
    STATUSES,
    PAYMENT_STATUSES
  };
})();

/* Платежи. Сейчас реальные платежи не подключены: метод start() честно
   сообщает, что заказ оплачивается при получении.
   Подключение провайдера (Kaspi Pay, CloudPayments, Stripe и т. п.):
   1. включите способ в FS.paymentMethods (enabled: true);
   2. зарегистрируйте провайдера: FS.payments.register('online_card', { start(order) { ... } }),
      где start создаёт платёж на вашем сервере и возвращает { redirectUrl } или { status }. */
FS.payments = (function () {
  const providers = {
    on_delivery: {
      async start() { return { status: 'pay_on_delivery' }; }
    }
  };
  return {
    register(id, provider) { providers[id] = provider; },
    isAvailable(id) {
      const m = FS.paymentMethods.find((x) => x.id === id);
      return Boolean(m && m.enabled && providers[id]);
    },
    async start(id, order) {
      if (!this.isAvailable(id)) throw new Error('Способ оплаты недоступен');
      return providers[id].start(order);
    }
  };
})();

/* Доставка. quote() возвращает стоимость или null, если её подтверждает менеджер.
   Для интеграции со службой доставки замените price в FS.delivery на запрос к API. */
FS.shipping = {
  methods: () => FS.delivery,
  quote(methodId, subtotal) {
    const m = FS.delivery.find((d) => d.id === methodId) || FS.delivery[0];
    return m.price(subtotal);
  }
};
