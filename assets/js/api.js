/* 5th SENSE — слой доступа к данным.
   Весь интерфейс получает данные только через FS.api, FS.payments и FS.shipping.
   Чтобы подключить базу данных, достаточно заменить реализацию функций ниже
   на запросы к серверу (например, fetch('/api/products')) — сигнатуры
   уже асинхронные там, где это понадобится. */
window.FS = window.FS || {};

FS.api = (function () {
  const byId = new Map(FS.products.map((p) => [p.id, p]));

  function minPrice(p) { return Math.min(...p.volumes.map((v) => v.price)); }
  function mainVolume(p) { return p.volumes.find((v) => v.ml === p.main) || p.volumes[0]; }
  function inStock(p) { return p.volumes.some((v) => v.stock > 0); }
  function totalStock(p) { return p.volumes.reduce((s, v) => s + v.stock, 0); }

  // Популярность: бестселлеры и витринные позиции выше, затем по исходному порядку.
  const popularity = new Map(FS.products.map((p, i) => [p.id, (p.bestseller ? 100 : 0) + (p.featured ? 50 : 0) - i]));

  const SORTS = {
    popular: (a, b) => popularity.get(b.id) - popularity.get(a.id),
    new: (a, b) => (b.isNew - a.isNew) || ((b.year || 0) - (a.year || 0)),
    'price-asc': (a, b) => mainVolume(a).price - mainVolume(b).price,
    'price-desc': (a, b) => mainVolume(b).price - mainVolume(a).price,
    name: (a, b) => a.name.localeCompare(b.name, 'ru')
  };

  function normalize(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/['’`]/g, '').trim();
  }

  function haystack(p) {
    const fam = FS.families.find((f) => f.id === p.family);
    return normalize([p.name, p.brand, p.short, fam && fam.name, ...p.notes.top, ...p.notes.heart, ...p.notes.base].join(' '));
  }
  const index = new Map(FS.products.map((p) => [p.id, haystack(p)]));

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

  /* --- Заказы ---
     В демо-режиме заказ сохраняется в localStorage этого браузера.
     Для боевого режима замените тело createOrder на POST /api/orders. */
  const ORDERS_KEY = 'fs.orders.v1';

  async function createOrder(order) {
    const number = '5S-' + Date.now().toString(36).toUpperCase().slice(-6);
    const record = { ...order, number, status: 'new', paymentStatus: 'unpaid', createdAt: new Date().toISOString() };
    const orders = FS.storage.get(ORDERS_KEY, []);
    orders.push(record);
    FS.storage.set(ORDERS_KEY, orders);
    return record;
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
    createOrder,
    orders: () => FS.storage.get(ORDERS_KEY, [])
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
