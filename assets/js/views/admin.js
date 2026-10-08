/* 5th SENSE — админ-панель.
   С сервером (папка api/, переменная ADMIN_PASSWORD на Vercel) вход проверяет
   сервер, заказы читаются из хранилища, а уведомления настраиваются на вкладке
   «Данные». Без сервера админка работает в демо-режиме: заказы хранятся в этом
   браузере, а пароль — только заглушка. Каталог в обоих режимах пока
   меняется только в браузере (см. FS.catalog в api.js). */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.admin = (function () {
  const { $, $$, esc, money, plural, toast, volumeLabel } = FS.ui;
  const DEMO_PASSWORD = '5thsense';
  const SESSION_KEY = 'fs.admin.session';
  const TABS = [
    { id: 'overview', token: 'admin', name: 'Обзор' },
    { id: 'orders', token: 'admin-orders', name: 'Заказы' },
    { id: 'products', token: 'admin-products', name: 'Товары' },
    { id: 'data', token: 'admin-data', name: 'Данные' }
  ];
  const SHAPES = [['block', 'Прямоугольный'], ['tower', 'Высокий'], ['cylinder', 'Цилиндр'], ['flask', 'Округлые плечи'], ['facet', 'Гранёный'], ['amphora', 'Капля']];

  let root = null;
  let route = null;
  let memorySession = false;
  let orderFilter = { status: 'all', q: '' };
  let productFilter = { q: '', category: '' };
  let draft = null; // товар в редакторе
  let importPlan = null; // загруженная таблица до подтверждения

  /* ---------- Режим ---------- */
  // Сервер с паролем админки: заказы и вход через /api. Иначе — демо в браузере.
  const serverMode = () => Boolean(FS.backend.info && FS.backend.info.admin);
  const serverInfo = () => FS.backend.info || {};
  // Пока заказы с сервера не загружены, не показываем локальные демо-заказы.
  const allOrders = () => (serverMode() && !FS.api.remoteOrders() ? [] : FS.api.orders());
  const ordersReady = () => !serverMode() || FS.api.remoteOrders();

  /* ---------- Вход ---------- */
  function authed() {
    if (serverMode()) return Boolean(FS.backend.adminKey());
    try { return sessionStorage.getItem(SESSION_KEY) === '1' || memorySession; } catch (e) { return memorySession; }
  }
  function setAuthed(on) {
    memorySession = on;
    try { if (on) sessionStorage.setItem(SESSION_KEY, '1'); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* только память */ }
    if (!on) { FS.backend.setAdminKey(''); FS.api.forgetOrders(); }
  }

  function loginView() {
    return `
      <section class="admin-login">
        <form class="login-card" data-login novalidate>
          <p class="corner-note">5th SENSE, админ-панель</p>
          <h1>Вход для сотрудников</h1>
          <div class="field">
            <label for="admin-password">Пароль</label>
            <input id="admin-password" type="password" autocomplete="current-password" data-autofocus>
            <p class="field-error" id="admin-password-error" aria-live="polite"></p>
          </div>
          <button class="btn btn--primary btn--block" type="submit">Войти</button>
          ${serverMode()
    ? '<p class="login-hint">Пароль задаётся в настройках проекта на Vercel (переменная ADMIN_PASSWORD).</p>'
    : `<p class="login-hint">Демо-пароль: <strong class="selectable">${DEMO_PASSWORD}</strong>. В демо-версии пароль ничего не защищает: на настоящем сайте вход проверяет сервер.</p>`}
          <a class="text-link" href="#home">Вернуться на сайт</a>
        </form>
      </section>`;
  }

  /* ---------- Общие части ---------- */
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; }
  };
  const statusName = (id) => (FS.api.STATUSES.find((s) => s.id === id) || {}).name || id;

  function counts() {
    const orders = allOrders();
    return {
      orders: orders.length,
      newOrders: orders.filter((o) => o.status === 'new').length,
      products: FS.products.length
    };
  }

  function shell(body) {
    const c = counts();
    const tabCount = { orders: c.newOrders ? `<span class="tab-count">${c.newOrders}</span>` : '', products: `<span class="tab-count tab-count--mute">${c.products}</span>` };
    const activeTab = route.tab === 'edit' ? 'products' : route.tab;
    return `
      <section class="admin">
        <div class="admin-head">
          <div>
            <p class="corner-note">${serverMode() ? 'заказы на сервере' : 'демо-версия без сервера'}</p>
            <h1>Админ-панель</h1>
          </div>
          <div class="admin-head-actions">
            <a class="btn btn--sm" href="#home">Открыть сайт</a>
            <button class="btn btn--outline btn--sm" type="button" data-admin-logout>Выйти</button>
          </div>
        </div>
        <p class="admin-notice">${notice()}</p>
        <nav class="admin-tabs" aria-label="Разделы админ-панели">
          ${TABS.map((t) => `<a class="admin-tab ${t.id === activeTab ? 'is-active' : ''}" href="#${t.token}" ${t.id === activeTab ? 'aria-current="page"' : ''}>${t.name}${tabCount[t.id] || ''}</a>`).join('')}
        </nav>
        <div class="admin-body" data-admin-body>${body}</div>
      </section>`;
  }

  function notice() {
    const info = serverInfo();
    if (serverMode()) {
      return (info.storage
        ? 'Заказы хранятся на сервере и видны с любого устройства.'
        : 'Хранилище заказов не подключено: заказы приходят только в Telegram, здесь их не видно. Подключите Upstash Redis в разделе Storage на Vercel.') +
        ' Каталог и остатки пока меняются только в этом браузере: покупатели видят каталог из assets/js/data.js.';
    }
    if (FS.backend.info) return 'Сервер принимает заказы, но пароль админ-панели не задан (переменная ADMIN_PASSWORD на Vercel), поэтому админка работает в демо-режиме и показывает только заказы из этого браузера.';
    return 'Изменения сохраняются только в этом браузере и сразу видны на сайте в нём же. Другие посетители их не увидят, пока не подключён сервер.';
  }

  /* ---------- Обзор ---------- */
  function lowStock() {
    const rows = [];
    FS.products.forEach((p) => p.volumes.forEach((v) => { if (v.stock <= 2) rows.push({ p, v }); }));
    return rows.sort((a, b) => a.v.stock - b.v.stock);
  }

  function overview() {
    const orders = allOrders();
    const active = orders.filter((o) => o.status !== 'cancelled');
    const revenue = active.reduce((s, o) => s + (o.total || 0), 0);
    const out = FS.products.filter((p) => !FS.api.inStock(p)).length;
    const low = lowStock();
    const latest = orders.slice().reverse().slice(0, 5);
    const stats = [
      ['Новые заказы', counts().newOrders, 'ждут подтверждения'],
      ['Всего заказов', orders.length, serverMode() ? 'на сервере' : 'в этом браузере'],
      ['Сумма заказов', money(revenue), 'без отменённых'],
      ['Товаров', FS.products.length, out ? `${out} нет в наличии` : 'все в наличии']
    ];
    return `
      <div class="stats">${stats.map(([k, v, note]) => `<div class="stat"><p class="stat-label">${k}</p><p class="stat-value">${v}</p><p class="stat-note">${note}</p></div>`).join('')}</div>
      <div class="admin-cols">
        <section class="admin-panel">
          <div class="panel-head"><h2>Последние заказы</h2><a class="text-link" href="#admin-orders">Все заказы</a></div>
          ${latest.length ? `<ul class="mini-list">${latest.map((o) => `
            <li><a href="#admin-orders" data-open-order="${esc(o.number)}">
              <span class="mini-main"><strong>${esc(o.number)}</strong> ${esc(o.customer.firstName)} ${esc(o.customer.lastName)}</span>
              <span class="mini-meta"><span class="status status--${o.status}">${statusName(o.status)}</span>${money(o.total)}</span>
            </a></li>`).join('')}</ul>` : emptyOrders()}
        </section>
        <section class="admin-panel">
          <div class="panel-head"><h2>Заканчиваются</h2><a class="text-link" href="#admin-products">Все товары</a></div>
          ${low.length ? `<ul class="mini-list">${low.slice(0, 8).map(({ p, v }) => `
            <li><a href="#admin-edit-${p.id}">
              <span class="mini-main"><strong>${esc(p.name)}</strong> ${esc(volumeLabel(v))}</span>
              <span class="mini-meta"><span class="stock-pill ${v.stock ? 'is-low' : 'is-out'}">${v.stock ? `осталось ${v.stock}` : 'нет в наличии'}</span></span>
            </a></li>`).join('')}</ul>` : '<p class="panel-empty">Остатков достаточно по всем позициям.</p>'}
        </section>
      </div>`;
  }

  function emptyOrders() {
    return `<div class="panel-empty">
      <p>Заказов пока нет. Оформите заказ на сайте или добавьте тестовый, чтобы посмотреть, как работает раздел.</p>
      <button class="btn btn--outline btn--sm" type="button" data-test-order>Добавить тестовый заказ</button>
    </div>`;
  }

  /* ---------- Заказы ---------- */
  function orderRow(o) {
    const items = o.items.map((i) => `<li><span>${esc(i.brand)} ${esc(i.name)}, ${i.ml}&nbsp;мл × ${i.qty}</span><span>${money(i.price * i.qty)}</span></li>`).join('');
    return `
      <details class="order" data-order="${esc(o.number)}">
        <summary>
          <span class="order-num"><strong>${esc(o.number)}</strong>${o.test ? '<span class="tag">тест</span>' : ''}<em>${fmtDate(o.createdAt)}</em></span>
          <span class="order-who">${esc(o.customer.firstName)} ${esc(o.customer.lastName)}<em>${esc(o.customer.phone)}</em></span>
          <span class="order-sum">${money(o.total)}<em>${o.items.reduce((n, i) => n + i.qty, 0)} шт.</em></span>
          <span class="order-badges"><span class="status status--${o.status}">${statusName(o.status)}</span><span class="pay pay--${o.paymentStatus}">${o.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен'}</span></span>
        </summary>
        <div class="order-body">
          <div class="order-controls">
            <label class="field"><span>Статус заказа</span>
              <select data-order-status="${esc(o.number)}">${FS.api.STATUSES.map((s) => `<option value="${s.id}" ${s.id === o.status ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
            </label>
            <label class="field"><span>Оплата</span>
              <select data-order-payment="${esc(o.number)}">${FS.api.PAYMENT_STATUSES.map((s) => `<option value="${s.id}" ${s.id === o.paymentStatus ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
            </label>
          </div>
          <div class="order-grid">
            <div><h3>Состав</h3><ul class="order-items">${items}</ul>
              <dl class="order-sums"><div><dt>Товары</dt><dd>${money(o.subtotal)}</dd></div><div><dt>Доставка</dt><dd>${o.shipping === null ? 'рассчитает менеджер' : o.shipping === 0 ? 'бесплатно' : money(o.shipping)}</dd></div><div><dt>Итого</dt><dd>${money(o.total)}</dd></div></dl>
            </div>
            <div><h3>Покупатель</h3>
              <p>${esc(o.customer.firstName)} ${esc(o.customer.lastName)}<br><span class="selectable">${esc(o.customer.phone)}</span><br><span class="selectable">${esc(o.customer.email)}</span></p>
              <h3>Доставка и оплата</h3>
              <p>${esc(o.delivery.name)}${o.delivery.id === 'pickup' ? '' : `<br>${esc(o.customer.city)}, ${esc(o.customer.address)}`}<br>${esc(o.payment.name)}</p>
              ${o.comment ? `<h3>Комментарий</h3><p>${esc(o.comment)}</p>` : ''}
              ${o.gift ? '<p class="tag tag--blue">Подарочная упаковка</p>' : ''}
            </div>
          </div>
        </div>
      </details>`;
  }

  function ordersBody() {
    if (serverMode() && !serverInfo().storage) return '<p class="panel-empty">Заказы приходят в Telegram. Чтобы видеть и вести их здесь, подключите хранилище Upstash Redis (Vercel → Storage) и сделайте Redeploy.</p>';
    const all = allOrders().slice().reverse();
    const q = orderFilter.q.trim().toLowerCase();
    const list = all.filter((o) => (orderFilter.status === 'all' || o.status === orderFilter.status) &&
      (!q || [o.number, o.customer.firstName, o.customer.lastName, o.customer.phone].join(' ').toLowerCase().includes(q)));
    const chip = (id, name) => {
      const n = id === 'all' ? all.length : all.filter((o) => o.status === id).length;
      return `<button type="button" class="chip ${orderFilter.status === id ? 'chip--active' : ''}" data-order-filter="${id}" aria-pressed="${orderFilter.status === id}">${name} <span class="chip-count">${n}</span></button>`;
    };
    return `
      <div class="admin-toolbar">
        <label class="toolbar-search"><span class="visually-hidden">Поиск заказа</span>${FS.ui.icon.search}<input id="order-search" type="search" placeholder="Номер, имя или телефон" value="${esc(orderFilter.q)}" autocomplete="off"></label>
        ${serverMode() ? '<button class="btn btn--outline btn--sm" type="button" data-orders-refresh>Обновить</button>' : ''}
        <button class="btn btn--outline btn--sm" type="button" data-test-order>Добавить тестовый заказ</button>
      </div>
      <div class="chips admin-chips">${chip('all', 'Все')}${FS.api.STATUSES.map((s) => chip(s.id, s.name)).join('')}</div>
      <div data-order-list>${list.length ? `<div class="orders">${list.map(orderRow).join('')}</div>` : (all.length ? '<p class="panel-empty">Нет заказов с таким статусом или по такому запросу.</p>' : emptyOrders())}</div>`;
  }

  function testOrder() {
    const pool = FS.products.filter((p) => p.type === 'perfume' && FS.api.inStock(p));
    if (!pool.length) { toast('Нет товаров в наличии для тестового заказа'); return; }
    const picks = pool.sort(() => Math.random() - 0.5).slice(0, Math.min(2, pool.length));
    const items = picks.map((p) => { const v = p.volumes.find((x) => x.stock > 0); return { id: p.id, name: p.name, brand: p.brand, ml: v.ml, qty: 1, price: v.price }; });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const delivery = FS.delivery[1];
    const shipping = FS.shipping.quote(delivery.id, subtotal);
    FS.api.createOrder({
      test: true,
      customer: { firstName: 'Тестовый', lastName: 'Покупатель', phone: '+7 700 000 00 00', email: 'test@example.com', city: 'Город', address: 'Тестовая улица, 1' },
      items,
      delivery: { id: delivery.id, name: delivery.name },
      payment: { id: 'on_delivery', name: 'При получении' },
      comment: 'Пример заказа для проверки админ-панели',
      gift: false,
      consent: { offer: true, privacy: true, at: new Date().toISOString() },
      subtotal,
      shipping,
      total: subtotal + (shipping || 0)
    }).then((o) => { toast(`Тестовый заказ ${o.number} добавлен`); renderBody(); })
      .catch((err) => toast(`Тестовый заказ не создан: ${err.message}`));
  }

  /* ---------- Загрузка таблицы ---------- */
  const canPhotos = () => FS.api.remoteCatalog();
  function importPanel() {
    const plan = importPlan;
    if (!plan) return '';
    const names = (list) => list.slice(0, 12).map((p) => esc(`${p.brand} ${p.name}`)).join(', ') + (list.length > 12 ? ` и ещё ${list.length - 12}` : '');
    const d = plan.diff;
    const blocked = plan.errors.length > 0 || !plan.products.length;
    return `<section class="admin-panel import-panel">
        <h2>Таблица «${esc(plan.fileName)}»</h2>
        ${plan.errors.length ? `<div class="import-errors"><p><strong>Нужно исправить в таблице (${plan.errors.length}):</strong></p><ul>${plan.errors.slice(0, 30).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${plan.errors.length > 30 ? `<p>…и ещё ${plan.errors.length - 30}</p>` : ''}</div>` : ''}
        <dl class="import-sum">
          <div><dt>Товаров в таблице</dt><dd>${plan.products.length}</dd></div>
          <div><dt>Новые</dt><dd>${d.added.length}</dd></div>
          <div><dt>Изменятся</dt><dd>${d.changed.length}</dd></div>
          <div><dt>Без изменений</dt><dd>${d.same}</dd></div>
          <div><dt>Пропадут с сайта</dt><dd>${d.removed.length}</dd></div>
        </dl>
        ${d.added.length ? `<p><b>Новые:</b> ${names(d.added)}</p>` : ''}
        ${d.changed.length ? `<p><b>Изменятся:</b> ${names(d.changed)}</p>` : ''}
        ${d.removed.length ? `<p class="import-removed"><b>Пропадут с сайта</b> (их нет в таблице): ${names(d.removed)}</p>` : ''}
        ${plan.warnings.length ? `<details class="import-warnings"><summary>Замечания (${plan.warnings.length})</summary><ul>${plan.warnings.slice(0, 50).map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
        ${plan.missingPhotos ? `<p class="stat-note">У ${plan.missingPhotos} ${plural(plan.missingPhotos, 'товара', 'товаров', 'товаров')} в колонке «Фото» указан файл, которого ещё нет: загрузите фото кнопкой «Загрузить фото».</p>` : ''}
        <p class="stat-note">${FS.api.remoteCatalog() ? 'Каталог обновится на сервере и сразу станет виден всем покупателям.' : 'Сервер не подключён: каталог изменится только в этом браузере.'}</p>
        <div class="tg-actions">
          <button class="btn btn--primary btn--sm" type="button" data-import-apply ${blocked ? 'disabled' : ''}>${blocked ? 'Исправьте ошибки и загрузите снова' : 'Применить'}</button>
          <button class="btn btn--outline btn--sm" type="button" data-import-cancel>Отмена</button>
        </div>
      </section>`;
  }

  async function startImport(file) {
    toast('Читаем таблицу…');
    try {
      const rows = await FS.importer.read(file);
      const result = FS.importer.toProducts(rows, FS.products);
      const diff = FS.importer.diff(FS.products, result.products);
      const known = new Set(FS.products.map((p) => p.photo || (p.image || '').split('/').pop().toLowerCase()));
      const missingPhotos = result.products.filter((p) => p.photo && !p.image && !known.has(p.photo)).length;
      importPlan = { ...result, diff, fileName: file.name, missingPhotos };
    } catch (err) {
      importPlan = null;
      toast(`Не удалось прочитать файл: ${err.message}`, null, { duration: 8000 });
    }
    renderBody();
    window.scrollTo({ top: 0 });
  }

  async function applyImport(btn) {
    const plan = importPlan;
    btn.disabled = true;
    btn.textContent = 'Сохраняем…';
    try {
      const ok = await Promise.resolve(FS.api.replaceCatalog(plan.products));
      if (ok === false) throw new Error('браузер не сохранил каталог: закончилось место');
      importPlan = null;
      toast(`Каталог обновлён: ${FS.products.length} ${plural(FS.products.length, 'товар', 'товара', 'товаров')}`);
      renderBody();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Применить';
      toast(`Каталог не обновлён: ${err.message}`, null, { duration: 8000 });
    }
  }

  // Фото пачкой: имя файла = значение колонки «Фото» (или артикул товара).
  async function uploadPhotos(files) {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    let done = 0;
    let linked = 0;
    const failed = [];
    for (const file of list) {
      try {
        const name = file.name.toLowerCase(); // как в колонке «Фото»; внутри всегда сжатый JPEG
        const res = await sendPhoto(file, name);
        linked += res.linked;
        done++;
        if (done % 5 === 0 || done === list.length) toast(`Загружено фото: ${done} из ${list.length}`, null, { duration: 2500 });
      } catch (err) {
        failed.push(`${file.name}: ${err.message}`);
        if (err.status === 401) { expired(); return; }
      }
    }
    await FS.catalog.sync().then((changed) => changed && FS.api.refreshProducts());
    renderBody();
    toast(`Фото загружены: ${done}${linked ? `, подключены к ${linked} ${plural(linked, 'товару', 'товарам', 'товарам')}` : ''}${failed.length ? `. Ошибки: ${failed.length}` : ''}`, null, { duration: 9000 });
    if (failed.length) console.warn(failed);
  }

  async function sendPhoto(file, name) {
    const dataUrl = await loadPhoto(file, 1200);
    return FS.backend.call('POST', '/api/image', { name, type: 'image/jpeg', data: dataUrl.split(',')[1] }, { auth: true });
  }

  /* ---------- Товары ---------- */
  function productsBody() {
    const q = productFilter.q.trim().toLowerCase();
    const cat = FS.categories.find((c) => c.id === productFilter.category);
    const list = FS.products.filter((p) => (!cat || cat.match(p)) && (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q)));
    const flags = (p) => [p.niche && 'нишевая', p.bestseller && 'бестселлер', p.isNew && 'новинка', p.featured && 'на витрине'].filter(Boolean).map((f) => `<span class="tag">${f}</span>`).join('');
    return `
      <div class="admin-toolbar">
        <label class="toolbar-search"><span class="visually-hidden">Поиск товара</span>${FS.ui.icon.search}<input id="product-search" type="search" placeholder="Название или бренд" value="${esc(productFilter.q)}" autocomplete="off"></label>
        <label class="toolbar-sort"><span class="visually-hidden">Коллекция</span>
          <select id="product-category"><option value="">Все коллекции</option>${FS.categories.map((c) => `<option value="${c.id}" ${c.id === productFilter.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        </label>
        <a class="btn btn--primary btn--sm" href="#admin-new">Добавить товар</a>
      </div>
      <div class="admin-toolbar admin-toolbar--files">
        <label class="btn btn--outline btn--sm file-btn">Загрузить таблицу<input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-import-file></label>
        <button class="btn btn--outline btn--sm" type="button" data-export-xlsx>Скачать таблицу</button>
        ${canPhotos() ? '<label class="btn btn--outline btn--sm file-btn">Загрузить фото<input type="file" accept="image/*" multiple data-photos></label>' : ''}
        <a class="text-link" href="assets/files/5th-sense-catalog.xlsx" download>Шаблон таблицы</a>
      </div>
      ${importPanel()}
      <p class="result-count">${list.length} ${plural(list.length, 'товар', 'товара', 'товаров')}</p>
      ${list.length ? `<div class="ptable" role="table" aria-label="Товары">
        <div class="ptable-row ptable-head" role="row"><span role="columnheader">Фото</span><span role="columnheader">Товар</span><span role="columnheader">Объёмы, цены и остатки</span><span role="columnheader">Действия</span></div>
        ${list.map((p) => `
          <div class="ptable-row" role="row">
            <span class="ptable-thumb" role="cell">${FS.bottle.media(p, { style: 'blueprint' })}</span>
            <span class="ptable-name" role="cell"><em>${esc(p.brand)}</em><strong>${esc(p.name)}</strong><span class="ptable-flags">${flags(p)}</span></span>
            <span class="ptable-vols" role="cell">${p.volumes.map((v) => `<span><b>${esc(volumeLabel(v))}</b> ${money(v.price)} <span class="stock-pill ${v.stock > 2 ? '' : v.stock ? 'is-low' : 'is-out'}">${v.stock} шт.</span></span>`).join('')}</span>
            <span class="ptable-actions" role="cell"><a class="btn btn--outline btn--sm" href="#admin-edit-${p.id}">Редактировать</a><a class="link-btn" href="#product-${p.id}">На сайте</a></span>
          </div>`).join('')}
      </div>` : '<p class="panel-empty">Товары не найдены. Измените запрос или выберите другую коллекцию.</p>'}`;
  }

  /* ---------- Редактор товара ---------- */
  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  function slugify(s) {
    const base = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] || '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
    let id = base;
    let n = 2;
    while (FS.api.productSync(id)) id = `${base}-${n++}`;
    return id;
  }

  function blankProduct() {
    return {
      id: '', type: 'perfume', name: '', brand: '', gender: 'unisex', family: 'woody', concentration: 'EDP',
      year: new Date().getFullYear(), perfumer: '', country: '',
      niche: false, bestseller: false, isNew: true, featured: false,
      volumes: [{ ml: 50, price: 0, stock: 0 }], main: 50,
      short: '', description: '',
      notes: { top: [], heart: [], base: [] },
      longevity: 3, sillage: 3,
      bottle: { shape: 'block', cap: 'cube', liquid: '#c9a46a', capColor: 'gold', label: '' }
    };
  }

  const opt = (list, value) => list.map(([v, l]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const input = (id, label, value, extra) => `<div class="field ${extra && extra.wide ? 'field--wide' : ''}" data-field="${id}">
      <label for="pe-${id}">${label}${extra && extra.optional ? ' <span class="optional">необязательно</span>' : ''}</label>
      <input id="pe-${id}" name="${id}" type="${(extra && extra.type) || 'text'}" value="${esc(value == null ? '' : value)}" ${extra && extra.attrs ? extra.attrs : ''}>
      <p class="field-error" id="pe-${id}-error"></p></div>`;

  function volumeRows() {
    return draft.volumes.map((v, i) => `
      <div class="vol-row" data-vol="${i}">
        <label class="vol-main" title="Показывать этот объём в карточке"><input type="radio" name="main" value="${i}" ${v.ml === draft.main ? 'checked' : ''}><span class="visually-hidden">Показывать в карточке</span></label>
        <label><span>Объём, мл</span><input type="number" min="1" step="1" inputmode="numeric" data-vol-field="ml" value="${v.ml || ''}"></label>
        <label><span>Подпись</span><input type="text" data-vol-field="label" value="${esc(v.label || '')}" placeholder="5 × 10 мл"></label>
        <label><span>Цена, ${esc(FS.config.currency)}</span><input type="number" min="0" step="500" inputmode="numeric" data-vol-field="price" value="${v.price || ''}"></label>
        <label><span>Остаток, шт.</span><input type="number" min="0" step="1" inputmode="numeric" data-vol-field="stock" value="${v.stock}"></label>
        <button class="icon-btn" type="button" data-vol-remove="${i}" aria-label="Удалить объём ${v.ml || ''} мл" ${draft.volumes.length < 2 ? 'disabled' : ''}>${FS.ui.icon.close}</button>
      </div>`).join('');
  }

  function photoBlock() {
    return `<div class="photo-box">
        <span class="photo-preview">${draft.image ? FS.bottle.media(draft) : FS.bottle.blueprint(draft, {})}</span>
        <div class="photo-actions">
          <p>${draft.image ? 'Фото товара. На сайте оно заменяет рисунок флакона.' : 'Фото нет: на сайте показывается чертёж флакона.'}</p>
          <label class="btn btn--outline btn--sm file-btn">Загрузить фото<input type="file" accept="image/*" data-photo-input></label>
          ${draft.image ? '<button class="link-btn" type="button" data-photo-remove>Убрать фото</button>' : ''}
          <p class="field-error" data-photo-error></p>
        </div>
      </div>`;
  }

  function editBody() {
    const p = draft;
    const isNew = !p.id;
    const families = FS.families.map((f) => [f.id, f.name]);
    const genders = Object.entries(FS.genderLabel);
    const concs = Object.entries(FS.concentrationLabel);
    const scale = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
    return `
      <form class="editor" data-editor novalidate>
        <div class="editor-head">
          <a class="link-btn" href="#admin-products">Все товары</a>
          <h2>${isNew ? 'Новый товар' : esc(p.name)}</h2>
        </div>

        <fieldset class="co-step"><legend>Основное</legend>
          <div class="field-grid">
            ${input('name', 'Название', p.name)}
            ${input('brand', 'Бренд', p.brand)}
            <div class="field"><label for="pe-type">Тип</label><select id="pe-type" name="type">${opt([['perfume', 'Аромат'], ['set', 'Набор']], p.type)}</select></div>
            <div class="field"><label for="pe-gender">Для кого</label><select id="pe-gender" name="gender">${opt(genders, p.gender)}</select></div>
            <div class="field"><label for="pe-family">Семейство</label><select id="pe-family" name="family">${opt(families, p.family)}</select></div>
            <div class="field"><label for="pe-concentration">Концентрация</label><select id="pe-concentration" name="concentration">${opt(concs, p.concentration)}</select></div>
            ${input('year', 'Год', p.year, { type: 'number', optional: true, attrs: 'min="1800" max="2100"' })}
            ${input('country', 'Страна', p.country, { optional: true })}
            ${input('perfumer', 'Парфюмер', p.perfumer, { optional: true, wide: true })}
          </div>
        </fieldset>

        <fieldset class="co-step"><legend>Фото</legend>${photoBlock()}</fieldset>

        <fieldset class="co-step"><legend>Объёмы, цены и остатки</legend>
          <p class="co-hint">Отмеченный кружком объём показывается в карточке каталога.</p>
          <div class="vol-rows" data-vol-rows>${volumeRows()}</div>
          <button class="btn btn--outline btn--sm" type="button" data-vol-add>Добавить объём</button>
          <p class="field-error" data-vol-error></p>
        </fieldset>

        <fieldset class="co-step"><legend>Описание</legend>
          ${input('short', 'Коротко, для карточки', p.short, { wide: true, attrs: 'maxlength="90"' })}
          <div class="field field--wide"><label for="pe-description">Описание на странице товара</label><textarea id="pe-description" name="description" rows="5">${esc(p.description)}</textarea></div>
        </fieldset>

        <fieldset class="co-step"><legend>Ноты и характер</legend>
          <p class="co-hint">Перечисляйте ноты через запятую.</p>
          <div class="field-grid">
            ${input('top', 'Верхние ноты', p.notes.top.join(', '), { wide: true })}
            ${input('heart', 'Ноты сердца', p.notes.heart.join(', '), { wide: true })}
            ${input('base', 'Базовые ноты', p.notes.base.join(', '), { wide: true })}
            <div class="field"><label for="pe-longevity">Стойкость, от 1 до 5</label><select id="pe-longevity" name="longevity">${opt(scale, p.longevity)}</select></div>
            <div class="field"><label for="pe-sillage">Шлейф, от 1 до 5</label><select id="pe-sillage" name="sillage">${opt(scale, p.sillage)}</select></div>
            <div class="field"><label for="pe-shape">Форма флакона для чертежа</label><select id="pe-shape" name="shape">${opt(SHAPES, p.bottle.shape)}</select></div>
          </div>
        </fieldset>

        <fieldset class="co-step"><legend>Витрина</legend>
          <div class="flag-grid">
            ${[['niche', 'Нишевая парфюмерия'], ['bestseller', 'Бестселлер'], ['isNew', 'Новинка'], ['featured', 'Широкая карточка в каталоге']].map(([k, l]) => `
              <label class="check"><input type="checkbox" name="${k}" ${p[k] ? 'checked' : ''}><span class="check-box" aria-hidden="true"></span><span class="check-label">${l}</span></label>`).join('')}
          </div>
        </fieldset>

        <p class="form-error" data-form-error role="alert"></p>
        <div class="editor-actions">
          <button class="btn btn--primary" type="submit">${isNew ? 'Добавить товар' : 'Сохранить изменения'}</button>
          <a class="btn btn--outline" href="#admin-products">Отмена</a>
          ${isNew ? '' : '<button class="btn btn--danger" type="button" data-delete>Удалить товар</button>'}
        </div>
      </form>`;
  }

  // Считываем форму в черновик (без проверки).
  function readEditor() {
    const f = $('[data-editor]', root);
    const val = (n) => (f.elements[n] ? f.elements[n].value.trim() : '');
    const list = (n) => val(n).split(',').map((x) => x.trim()).filter(Boolean);
    draft.name = val('name');
    draft.brand = val('brand');
    draft.type = val('type');
    draft.gender = val('gender');
    draft.family = val('family');
    draft.concentration = val('concentration');
    draft.year = Number(val('year')) || undefined;
    draft.country = val('country');
    draft.perfumer = val('perfumer');
    draft.short = val('short');
    draft.description = val('description');
    draft.notes = { top: list('top'), heart: list('heart'), base: list('base') };
    draft.longevity = Number(val('longevity'));
    draft.sillage = Number(val('sillage'));
    draft.bottle = { ...draft.bottle, shape: draft.type === 'set' ? 'set' : val('shape'), count: draft.type === 'set' ? 3 : undefined, label: draft.bottle.label || draft.brand.toUpperCase().slice(0, 14) };
    ['niche', 'bestseller', 'isNew', 'featured'].forEach((k) => { draft[k] = f.elements[k].checked; });
    draft.volumes = $$('.vol-row', f).map((row) => {
      const get = (k) => $(`[data-vol-field="${k}"]`, row).value.trim();
      const v = { ml: Number(get('ml')) || 0, price: Number(get('price')) || 0, stock: Math.max(0, Math.floor(Number(get('stock')) || 0)) };
      if (get('label')) v.label = get('label');
      return v;
    });
    const mainIdx = Number((f.querySelector('input[name="main"]:checked') || {}).value || 0);
    draft.main = (draft.volumes[mainIdx] || draft.volumes[0]).ml;
  }

  function validateEditor() {
    const errors = {};
    if (!draft.name) errors.name = 'Укажите название';
    if (!draft.brand) errors.brand = 'Укажите бренд';
    if (!draft.short) errors.short = 'Добавьте короткое описание для карточки';
    if (!draft.notes.top.length) errors.top = 'Укажите хотя бы одну верхнюю ноту';
    if (!draft.notes.heart.length) errors.heart = 'Укажите хотя бы одну ноту сердца';
    if (!draft.notes.base.length) errors.base = 'Укажите хотя бы одну базовую ноту';
    const mls = draft.volumes.map((v) => v.ml);
    let volError = '';
    if (draft.volumes.some((v) => v.ml <= 0)) volError = 'У каждого объёма должно быть число миллилитров больше нуля.';
    else if (draft.volumes.some((v) => v.price <= 0)) volError = 'У каждого объёма должна быть цена больше нуля.';
    else if (new Set(mls).size !== mls.length) volError = 'Объёмы повторяются. Оставьте каждый объём один раз.';
    $$('[data-field]', root).forEach((el) => {
      const msg = errors[el.dataset.field];
      el.classList.toggle('has-error', Boolean(msg));
      const out = $('.field-error', el);
      if (out) out.textContent = msg || '';
    });
    $('[data-vol-error]', root).textContent = volError;
    return Object.keys(errors).length === 0 && !volError;
  }

  // Уменьшаем фото (по умолчанию до 900 px), чтобы оно было лёгким и поместилось в хранилище.
  function loadPhoto(file, maxSize) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('type')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode'));
        img.onload = () => {
          const scale = Math.min(1, (maxSize || 900) / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Данные ---------- */
  function dataBody() {
    const custom = FS.catalog.isCustom();
    const ordersCount = allOrders().length;
    const where = serverMode() ? 'На сервере' : 'В этом браузере';
    return `
      <div class="admin-cols">
        <section class="admin-panel">
          <h2>Каталог</h2>
          <p>${FS.catalog.source() === 'server'
    ? `Каталог хранится на сервере: ${FS.products.length} ${plural(FS.products.length, 'товар', 'товара', 'товаров')}. Его видят все покупатели, остатки списываются при заказе.`
    : custom ? 'Каталог изменён в админ-панели. На сайте в этом браузере показывается изменённая версия.' : 'Каталог не менялся: на сайте показываются исходные данные из assets/js/data.js.'}</p>
          <button class="btn btn--outline btn--sm" type="button" data-confirm="reset-catalog" ${custom ? '' : 'disabled'}>Вернуть исходный каталог</button>
        </section>
        <section class="admin-panel">
          <h2>Заказы</h2>
          <p>${ordersCount ? `${where} ${ordersCount} ${plural(ordersCount, 'заказ', 'заказа', 'заказов')}.` : 'Заказов пока нет.'} Удаление заказов не меняет остатки на складе.</p>
          <button class="btn btn--outline btn--sm" type="button" data-confirm="clear-orders" ${ordersCount ? '' : 'disabled'}>Удалить все заказы</button>
        </section>
      </div>
      ${serverMode() ? `<section class="admin-panel tg-panel">
        <h2>Telegram-бот</h2>
        <div data-telegram>${telegramBody()}</div>
      </section>` : ''}
      <section class="admin-panel">
        <h2>Экспорт каталога</h2>
        <p>Каталог в формате JSON. Его можно загрузить в базу данных, когда подключите сервер, или перенести в assets/js/data.js.</p>
        <label class="visually-hidden" for="export-json">Каталог в JSON</label>
        <textarea id="export-json" class="code-box" rows="8" readonly>${esc(JSON.stringify(FS.products, null, 2))}</textarea>
        <button class="btn btn--outline btn--sm" type="button" data-copy-export>Скопировать JSON</button>
      </section>
      <section class="admin-panel">
        <h2>Импорт каталога</h2>
        <p>Вставьте JSON со списком товаров в том же формате. Текущий каталог в этом браузере будет заменён.</p>
        <label class="visually-hidden" for="import-json">JSON для импорта</label>
        <textarea id="import-json" class="code-box" rows="6" placeholder="[ { &quot;id&quot;: &quot;...&quot;, &quot;name&quot;: &quot;...&quot;, ... } ]"></textarea>
        <p class="field-error" data-import-error></p>
        <button class="btn btn--outline btn--sm" type="button" data-import>Загрузить каталог</button>
      </section>`;
  }

  /* ---------- Telegram ---------- */
  let tg = null; // состояние с сервера: { token, tokenValid, bot, source, chats, storage, webhook }
  let tgInvite = null; // последняя ссылка-приглашение для сотрудника
  let tgError = '';

  function telegramBody() {
    if (tgError) return `<p class="field-error">${esc(tgError)}</p><button class="btn btn--outline btn--sm" type="button" data-tg="reload">Повторить</button>`;
    if (!tg) return '<p class="panel-empty">Проверяем настройки…</p>';
    if (!tg.token) {
      return `<ol class="tg-steps">
          <li>В Telegram откройте <a class="text-link" href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a>, отправьте команду /newbot и придумайте имя бота. BotFather пришлёт токен.</li>
          <li>На Vercel откройте проект → Settings → Environment Variables и добавьте переменную TELEGRAM_BOT_TOKEN с этим токеном.</li>
          <li>Deployments → Redeploy, затем вернитесь сюда.</li>
        </ol>`;
    }
    if (!tg.tokenValid) return '<p>Telegram не принял токен бота. Проверьте переменную TELEGRAM_BOT_TOKEN на Vercel и сделайте Redeploy.</p>';
    const bot = `<a class="text-link" href="https://t.me/${esc(tg.bot)}" target="_blank" rel="noopener">@${esc(tg.bot)}</a>`;
    if (!tg.storage) return `<p>Бот ${bot} найден, но для его работы нужно хранилище. Подключите Upstash Redis на Vercel (Storage) и сделайте Redeploy.</p>`;

    // Шаг 1: бот для покупателей.
    if (!tg.webhook || !tg.webhook.enabled) {
      return `<p>Бот ${bot} пока только присылает уведомления. Включите его для покупателей: в боте появятся меню, кнопка «Магазин» (сайт откроется прямо в Telegram), статусы заказов и вопросы консультанту.</p>
        <div class="tg-actions"><button class="btn btn--outline btn--sm" type="button" data-tg="enable">Включить бота</button></div>`;
    }

    // Шаг 2: чаты сотрудников.
    const staff = tg.chats.length
      ? `<p>Новые заказы и вопросы покупателей приходят ${tg.chats.length > 1 ? 'в эти чаты' : 'в этот чат'}:</p><ul class="tg-chats">${tg.chats.map((c) => `<li>${esc(c.title)}</li>`).join('')}</ul>`
      : '<p>Чат сотрудников ещё не подключён: заказы и вопросы покупателей пока никуда не приходят. Нажмите «Подключить сотрудника».</p>';
    const invite = tgInvite ? `<div class="tg-invite">
        <p>Откройте ссылку на телефоне сотрудника и нажмите «Старт». Ссылка работает ${tgInvite.minutes} минут и только один раз.</p>
        <p><a class="text-link selectable" href="${esc(tgInvite.private)}" target="_blank" rel="noopener">${esc(tgInvite.private)}</a></p>
        <p>Для общей группы сотрудников: <a class="text-link" href="${esc(tgInvite.group)}" target="_blank" rel="noopener">добавить бота в группу</a>.</p>
      </div>` : '';
    const actions = [];
    if (tg.source !== 'env') actions.push(`<button class="btn btn--outline btn--sm" type="button" data-tg="invite">${tg.chats.length ? 'Подключить ещё сотрудника' : 'Подключить сотрудника'}</button>`);
    if (tg.chats.length) actions.push('<button class="btn btn--outline btn--sm" type="button" data-tg="test">Отправить проверку</button>');
    if (tg.source === 'storage' && tg.chats.length) actions.push('<button class="btn btn--outline btn--sm" type="button" data-tg="disconnect">Отключить сотрудников</button>');
    actions.push('<button class="btn btn--outline btn--sm" type="button" data-tg="enable">Обновить настройки бота</button>');
    return `<p>Бот ${bot} работает: покупатели могут открыть магазин, следить за заказом и задать вопрос консультанту.</p>
      ${tg.webhook.lastError ? `<p class="field-error">Последняя ошибка Telegram: ${esc(tg.webhook.lastError)}</p>` : ''}
      ${staff}${tg.source === 'env' ? '<p class="stat-note">Чаты заданы переменной TELEGRAM_CHAT_ID на Vercel.</p>' : ''}
      ${invite}
      <div class="tg-actions">${actions.join('')}</div>
      <p class="stat-note">Чтобы ответить покупателю, просто напишите боту ответ после его вопроса. На более старый вопрос: нажмите на него в Telegram и выберите «Ответить».</p>`;
  }

  function paintTelegram() {
    const box = root && root.querySelector('[data-telegram]');
    if (box) box.innerHTML = telegramBody();
  }

  async function telegram(action, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Подождите…'; }
    try {
      tg = action === 'reload'
        ? await FS.backend.call('GET', '/api/telegram', null, { auth: true })
        : await FS.backend.call('POST', '/api/telegram', { action }, { auth: true });
      tgError = '';
      tgInvite = action === 'invite' ? tg.invite : (action === 'reload' ? tgInvite : null);
      if (action === 'enable') toast('Бот включён: откройте его в Telegram и нажмите «Старт»');
      if (action === 'invite') toast('Ссылка для сотрудника готова');
      if (action === 'test') toast('Проверочное сообщение отправлено');
      if (action === 'disconnect') toast('Чаты отключены');
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      if (action === 'reload') tgError = `Не удалось получить настройки: ${err.message}`;
      else toast(err.message);
    }
    paintTelegram();
  }

  /* ---------- Синхронизация с сервером ---------- */
  let loadError = '';
  const loading = () => (loadError
    ? `<div class="panel-empty"><p>Не удалось загрузить заказы: ${esc(loadError)}</p><button class="btn btn--outline btn--sm" type="button" data-orders-refresh>Повторить</button></div>`
    : '<p class="panel-empty">Загружаем заказы…</p>');

  function expired() {
    setAuthed(false);
    toast('Войдите снова: пароль не подошёл');
    FS.app.go('admin');
  }

  async function sync(force) {
    if (!serverMode() || !authed()) return;
    const before = FS.api.remoteOrders() ? JSON.stringify(FS.api.orders()) : null;
    try {
      await FS.api.loadOrders();
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      loadError = err.message;
      if (!FS.api.remoteOrders() && root && document.contains(root)) renderBody();
      else toast(`Не удалось обновить заказы: ${err.message}`);
      return;
    }
    loadError = '';
    const changed = force || before !== JSON.stringify(FS.api.orders());
    if (changed && root && document.contains(root) && ['overview', 'orders', 'data'].includes(route.tab)) renderBody();
  }

  function validCatalog(list) {
    return Array.isArray(list) && list.length > 0 && list.every((p) => p && typeof p.id === 'string' && p.name && p.brand &&
      Array.isArray(p.volumes) && p.volumes.length && p.volumes.every((v) => v.ml > 0 && v.price > 0 && v.stock >= 0) &&
      p.notes && Array.isArray(p.notes.top) && Array.isArray(p.notes.heart) && Array.isArray(p.notes.base));
  }

  /* ---------- Рендер ---------- */
  function body() {
    if (route.tab === 'orders') return ordersBody();
    if (route.tab === 'products') return productsBody();
    if (route.tab === 'data') return dataBody();
    if (route.tab === 'edit') return editBody();
    return overview();
  }

  // Перерисовка сохраняет раскрытые заказы.
  function renderBody() {
    const open = $$('.order[open]', root).map((d) => d.dataset.order);
    root.innerHTML = shell(ordersReady() || route.tab === 'products' || route.tab === 'edit' ? body() : loading());
    open.forEach((n) => { const d = root.querySelector(`.order[data-order="${CSS.escape(n)}"]`); if (d) d.open = true; });
  }

  function render(r) {
    route = r;
    if (!FS.backend.known()) return '<section class="admin-login"><p class="panel-empty">Загрузка…</p></section>';
    if (!authed()) return loginView();
    if (!ordersReady() && r.tab !== 'products' && r.tab !== 'edit') return shell(loading());
    if (r.tab === 'edit') {
      const existing = r.id && FS.api.productSync(r.id);
      if (r.id && !existing) return shell('<p class="panel-empty">Товар не найден. Возможно, его уже удалили. <a class="text-link" href="#admin-products">К списку товаров</a></p>');
      draft = existing ? JSON.parse(JSON.stringify(existing)) : blankProduct();
    }
    return shell(body());
  }

  function confirmButton(btn, label, run) {
    if (btn.dataset.armed) { run(); return; }
    btn.dataset.armed = '1';
    const original = btn.textContent;
    btn.textContent = label;
    btn.classList.add('btn--danger');
    setTimeout(() => { if (document.contains(btn)) { delete btn.dataset.armed; btn.textContent = original; btn.classList.remove('btn--danger'); } }, 4000);
  }

  function mount(el, r, params, signal) {
    root = el;

    el.addEventListener('submit', async (e) => {
      if (e.target.matches('[data-login]')) {
        e.preventDefault();
        const value = $('#admin-password', el).value;
        const error = $('#admin-password-error', el);
        if (serverMode()) {
          const btn = $('button[type="submit"]', e.target);
          btn.disabled = true;
          try {
            const st = await FS.backend.call('GET', '/api/status', null, { key: value });
            if (st.authorized) { FS.backend.setAdminKey(value); FS.app.go(r.key); return; }
            error.textContent = 'Неверный пароль';
          } catch (err) {
            error.textContent = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
          }
          btn.disabled = false;
          $('#admin-password', el).focus();
          return;
        }
        if (value === DEMO_PASSWORD) {
          setAuthed(true);
          FS.app.go(r.key);
        } else {
          error.textContent = `Неверный пароль. В демо-версии пароль: ${DEMO_PASSWORD}`;
          $('#admin-password', el).focus();
        }
        return;
      }
      if (e.target.matches('[data-editor]')) {
        e.preventDefault();
        readEditor();
        const formError = $('[data-form-error]', el);
        if (!validateEditor()) {
          formError.textContent = 'Проверьте отмеченные поля.';
          const first = $('.has-error input', el) || $('[data-vol-error]:not(:empty)', el);
          if (first && first.focus) first.focus();
          return;
        }
        const isNew = !draft.id;
        if (isNew) draft.id = slugify(`${draft.brand} ${draft.name}`);
        draft.volumes.sort((a, b) => a.ml - b.ml);
        const ok = FS.api.upsertProduct(draft);
        if (!ok) {
          formError.textContent = 'Изменения применены, но браузер не сохранил их: в хранилище закончилось место. Загрузите фото меньшего размера.';
          return;
        }
        toast(isNew ? `Товар «${draft.name}» добавлен` : `Изменения в «${draft.name}» сохранены`, { label: 'Открыть на сайте', run: () => FS.app.go(`product-${draft.id}`) });
        FS.app.go('admin-products');
      }
    }, { signal });

    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-admin-logout]')) { setAuthed(false); toast('Вы вышли из админ-панели'); FS.app.go('admin'); return; }
      if (t.closest('[data-test-order]')) { testOrder(); return; }
      if (t.closest('[data-import-cancel]')) { importPlan = null; renderBody(); return; }
      const applyBtn = t.closest('[data-import-apply]');
      if (applyBtn) { applyImport(applyBtn); return; }
      const exp = t.closest('[data-export-xlsx]');
      if (exp) {
        FS.importer.exportFile(FS.products).catch((err) => toast(err.message, null, { duration: 8000 }));
        return;
      }
      if (t.closest('[data-orders-refresh]')) { sync(true).then(() => { if (!loadError) toast('Список заказов обновлён'); }); return; }
      const tgBtn = t.closest('[data-tg]');
      if (tgBtn) { telegram(tgBtn.dataset.tg, tgBtn); return; }
      const of = t.closest('[data-order-filter]');
      if (of) { orderFilter.status = of.dataset.orderFilter; renderBody(); return; }
      const open = t.closest('[data-open-order]');
      if (open) { orderFilter = { status: 'all', q: open.dataset.openOrder }; return; }
      if (t.closest('[data-vol-add]')) {
        readEditor();
        const last = draft.volumes[draft.volumes.length - 1];
        draft.volumes.push({ ml: 0, price: 0, stock: 0 });
        if (!last) draft.main = 0;
        $('[data-vol-rows]', el).innerHTML = volumeRows();
        $$('.vol-row', el).pop().querySelector('[data-vol-field="ml"]').focus();
        return;
      }
      const rm = t.closest('[data-vol-remove]');
      if (rm) {
        readEditor();
        const i = Number(rm.dataset.volRemove);
        const removedMain = draft.volumes[i].ml === draft.main;
        draft.volumes.splice(i, 1);
        if (removedMain) draft.main = draft.volumes[0].ml;
        $('[data-vol-rows]', el).innerHTML = volumeRows();
        return;
      }
      if (t.closest('[data-photo-remove]')) {
        readEditor();
        delete draft.image;
        t.closest('fieldset').innerHTML = '<legend>Фото</legend>' + photoBlock();
        return;
      }
      const del = t.closest('[data-delete]');
      if (del) {
        confirmButton(del, 'Нажмите ещё раз, чтобы удалить', () => {
          FS.api.deleteProduct(draft.id);
          toast(`Товар «${draft.name}» удалён`);
          FS.app.go('admin-products');
        });
        return;
      }
      const conf = t.closest('[data-confirm]');
      if (conf) {
        const action = conf.dataset.confirm;
        confirmButton(conf, 'Нажмите ещё раз для подтверждения', () => {
          if (action === 'reset-catalog') {
            Promise.resolve(FS.api.resetCatalog())
              .then(() => { toast('Исходный каталог восстановлен'); renderBody(); })
              .catch((err) => toast(`Каталог не восстановлен: ${err.message}`));
            return;
          }
          if (action === 'clear-orders') {
            FS.api.clearOrders()
              .then(() => { toast('Все заказы удалены'); renderBody(); })
              .catch((err) => toast(`Заказы не удалены: ${err.message}`));
            return;
          }
          renderBody();
        });
        return;
      }
      if (t.closest('[data-copy-export]')) {
        const box = $('#export-json', el);
        const fallback = () => { box.focus(); box.select(); toast('Выделите текст и скопируйте его вручную'); };
        try {
          navigator.clipboard.writeText(box.value).then(() => toast('JSON скопирован'), fallback);
        } catch (err) { fallback(); }
        return;
      }
      if (t.closest('[data-import]')) {
        const out = $('[data-import-error]', el);
        let list;
        try { list = JSON.parse($('#import-json', el).value); } catch (err) { out.textContent = 'Это не JSON. Проверьте, что текст скопирован целиком.'; return; }
        if (!validCatalog(list)) { out.textContent = 'Формат не подходит: нужен список товаров с полями id, name, brand, volumes и notes, как в экспорте.'; return; }
        Promise.resolve(FS.api.replaceCatalog(list)).then((ok) => {
          if (ok === false) { out.textContent = 'Каталог применён, но браузер не сохранил его: закончилось место в хранилище.'; return; }
          toast(`Каталог загружен: ${list.length} ${plural(list.length, 'товар', 'товара', 'товаров')}`);
          renderBody();
        }).catch((err) => { out.textContent = `Каталог не загружен: ${err.message}`; });
      }
    }, { signal });

    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.orderStatus) {
        const o = FS.api.updateOrder(t.dataset.orderStatus, { status: t.value }, { error: saveFailed, saved: customerToast });
        toast(`Заказ ${o.number}: ${statusName(o.status).toLowerCase()}${o.status === 'cancelled' && !serverMode() ? ', товар вернулся на склад' : ''}`);
        rerenderOrderKeepOpen(o.number);
        return;
      }
      if (t.dataset.orderPayment) {
        const o = FS.api.updateOrder(t.dataset.orderPayment, { paymentStatus: t.value }, { error: saveFailed, saved: customerToast });
        toast(`Заказ ${o.number}: ${o.paymentStatus === 'paid' ? 'отмечен как оплаченный' : 'отмечен как неоплаченный'}`);
        rerenderOrderKeepOpen(o.number);
        return;
      }
      if (t.id === 'product-category') { productFilter.category = t.value; renderBody(); return; }
      if (t.matches('[data-import-file]') && t.files && t.files[0]) { startImport(t.files[0]); return; }
      if (t.matches('[data-photos]') && t.files && t.files.length) { uploadPhotos(t.files); return; }
      if (t.matches('[data-photo-input]') && t.files && t.files[0]) {
        const err = t.closest('.photo-actions').querySelector('[data-photo-error]');
        const file = t.files[0];
        // С сервером фото загружается туда, без сервера хранится в браузере.
        const upload = canPhotos()
          ? (() => { readEditor(); const name = `${draft.id || FS.importer.slug(`${draft.brand} ${draft.name}`) || 'product'}.jpg`; return sendPhoto(file, name).then((r) => { draft.photo = r.name; return r.url; }); })()
          : loadPhoto(file);
        upload.then((url) => {
          readEditor();
          draft.image = url;
          t.closest('fieldset').innerHTML = '<legend>Фото</legend>' + photoBlock();
        }).catch(() => { err.textContent = 'Не удалось прочитать файл. Выберите фото в формате JPG, PNG или WebP.'; });
      }
    }, { signal });

    let timer = null;
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id !== 'order-search' && t.id !== 'product-search') return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (t.id === 'order-search') orderFilter.q = t.value;
        else productFilter.q = t.value;
        const pos = t.selectionStart;
        renderBody();
        const again = $('#' + t.id, el);
        again.focus();
        try { again.setSelectionRange(pos, pos); } catch (err) { /* type=search */ }
      }, 200);
    }, { signal });

    if (route.tab === 'orders' && orderFilter.q) {
      const first = $('.order', el);
      if (first) first.open = true;
    }

    if (!FS.backend.known()) {
      // Сервер ещё не ответил: дорисуем, когда станет ясно, в каком режиме работаем.
      FS.backend.status().then(() => { if (document.contains(el)) { el.innerHTML = render(route); sync(); if (route.tab === 'data') telegram('reload'); } });
      return;
    }
    if (serverMode() && authed()) {
      sync();
      if (route.tab === 'data') telegram('reload');
      // Новые заказы появляются без перезагрузки страницы.
      const timer = setInterval(() => { if (!document.hidden) sync(); }, 60000);
      if (signal) signal.addEventListener('abort', () => clearInterval(timer));
    }
  }

  function customerToast(data, o) {
    if (data.customerNotified) toast(`Покупателю отправлено сообщение в Telegram о заказе ${o.number}`);
  }

  function saveFailed(err, o) {
    if (err.status === 401) { expired(); return; }
    toast(`Заказ ${o.number}: изменение не сохранено. ${err.message}`);
    if (root && document.contains(root)) renderBody();
  }

  function rerenderOrderKeepOpen(number) {
    renderBody();
    const d = root.querySelector(`.order[data-order="${CSS.escape(number)}"]`);
    if (d) { d.open = true; const s = d.querySelector('[data-order-status]'); if (s) s.focus(); }
  }

  function unmount() {
    // Поиск по заказу из обзора действует только на один переход.
    if (route && route.tab === 'orders') orderFilter.q = '';
  }

  return { render, mount, unmount, title: () => 'Админ-панель' };
})();
