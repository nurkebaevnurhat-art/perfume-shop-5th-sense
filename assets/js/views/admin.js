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
    { id: 'clients', token: 'admin-clients', name: 'Клиенты' },
    { id: 'products', token: 'admin-products', name: 'Товары' },
    { id: 'data', token: 'admin-data', name: 'Данные' }
  ];
  const SHAPES = [['block', 'Прямоугольный'], ['tower', 'Высокий'], ['cylinder', 'Цилиндр'], ['flask', 'Округлые плечи'], ['facet', 'Гранёный'], ['amphora', 'Капля']];

  let root = null;
  let route = null;
  let memorySession = false;
  let orderFilter = { status: 'all', q: '' };
  let orderLimit = 30; // сколько заказов показано («Показать ещё» добавляет)
  let ordersExport = null; // панель «Скачать в Excel»: { period, from, to }
  let productFilter = { q: '', category: '' };
  let draft = null; // товар в редакторе
  let importPlan = null; // загруженная таблица до подтверждения
  let priceTool = null; // «Изменить цены»: { brand, pct, plan }
  let priceEdit = null; // «Править цены»: { edits: Map(id → цена за 1 мл), picked: Set(id) }

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
  // Остатки не ведём: на обзоре вместо «Заканчиваются» — ароматы, скрытые с сайта.
  function hiddenPanel() {
    const list = FS.products.filter((p) => p.hidden);
    return `<section class="admin-panel">
        <div class="panel-head"><h2>Скрыты с сайта</h2><a class="text-link" href="#admin-products">Все товары</a></div>
        ${list.length ? `<ul class="mini-list">${list.slice(0, 8).map((p) => `
          <li><a href="#admin-edit-${p.id}">
            <span class="mini-main"><strong>${esc(p.name)}</strong> ${esc(p.brand)}</span>
            <span class="mini-meta"><span class="stock-pill is-out">скрыт</span></span>
          </a></li>`).join('')}</ul>${list.length > 8 ? `<p class="stat-note">…и ещё ${list.length - 8}</p>` : ''}` : '<p class="panel-empty">Все ароматы видны покупателям. Закончившийся надолго аромат можно скрыть в его карточке: «Скрыть с сайта».</p>'}
      </section>`;
  }

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
        ${!FS.api.tracking() ? hiddenPanel() : `<section class="admin-panel">
          <div class="panel-head"><h2>Заканчиваются</h2><a class="text-link" href="#admin-products">Все товары</a></div>
          ${low.length ? `<ul class="mini-list">${low.slice(0, 8).map(({ p, v }) => `
            <li><a href="#admin-edit-${p.id}">
              <span class="mini-main"><strong>${esc(p.name)}</strong> ${esc(volumeLabel(v))}</span>
              <span class="mini-meta"><span class="stock-pill ${v.stock ? 'is-low' : 'is-out'}">${v.stock ? `осталось ${v.stock}` : 'нет в наличии'}</span></span>
            </a></li>`).join('')}</ul>` : '<p class="panel-empty">Остатков достаточно по всем позициям.</p>'}
        </section>`}
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
    const items = o.items.map((i) => (i.full
      ? `<li class="order-full"><span>🧴 <b>Полноразмерный флакон</b>${i.fullMl ? ` ${i.fullMl}&nbsp;мл` : ''}: ${esc(i.brand)} ${esc(i.name)} × ${i.qty}</span><span>цена по запросу</span></li>`
      : `<li><span>${esc(i.brand)} ${esc(i.name)}, ${i.ml}&nbsp;мл × ${i.qty}</span><span>${money(i.price * i.qty)}</span></li>`)).join('');
    return `
      <details class="order" data-order="${esc(o.number)}">
        <summary>
          <span class="order-num"><strong>${esc(o.number)}</strong>${o.test ? '<span class="tag">тест</span>' : ''}${o.items.some((i) => i.full) ? '<span class="tag">флакон</span>' : ''}<em>${fmtDate(o.createdAt)}</em></span>
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
            ${serverMode() ? `<label class="field"><span>Оплачено, ${esc(FS.config.currency)}</span>
              <input type="number" min="0" step="1" inputmode="numeric" data-order-paid="${esc(o.number)}" value="${o.paidAmount || ''}" placeholder="${o.total}">
            </label>` : ''}
          </div>
          ${o.loyalty ? `<p class="order-loyalty">${o.loyalty.gift
    ? `🎁 <b>${o.loyalty.nextNumber}-я покупка клиента — положен подарок: ${esc(o.loyalty.gift)}</b>`
    : `<b>${o.loyalty.nextNumber}-я покупка клиента</b>${o.loyalty.giftAt ? `, подарок — на ${o.loyalty.giftAt}-й` : ''}`}${o.loyalty.open ? ` (учтены заказы в работе: ${o.loyalty.open})` : ''}. Сумма для подарков — «Оплачено» (если пусто, берётся итог заказа), засчитывается при статусе «Выполнен».</p>` : ''}
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

  /* Архив: выполненные и отменённые заказы, к которым не возвращались неделю.
     Они не мешают в работе, но хранятся и находятся поиском. */
  const ARCHIVE_DAYS = 7;
  function archived(o) {
    if (o.status !== 'done' && o.status !== 'cancelled') return false;
    const t = Date.parse(o.updatedAt || o.createdAt);
    return Number.isFinite(t) && Date.now() - t > ARCHIVE_DAYS * 86400000;
  }

  function ordersBody() {
    if (serverMode() && !serverInfo().storage) return '<p class="panel-empty">Заказы приходят в Telegram. Чтобы видеть и вести их здесь, подключите хранилище Upstash Redis (Vercel → Storage) и сделайте Redeploy.</p>';
    const all = allOrders().slice().reverse();
    const work = all.filter((o) => !archived(o));
    const archive = all.filter(archived);
    const q = orderFilter.q.trim().toLowerCase();
    const st = orderFilter.status;
    // Поиск ищет везде, включая архив; без поиска — вкладка «Архив» или заказы в работе по статусу.
    const list = q
      ? all.filter((o) => [o.number, o.customer.firstName, o.customer.lastName, o.customer.phone].join(' ').toLowerCase().includes(q))
      : st === 'archive' ? archive : work.filter((o) => st === 'all' || o.status === st);
    const shown = list.slice(0, orderLimit);
    const chip = (id, name, n) => `<button type="button" class="chip ${!q && st === id ? 'chip--active' : ''}" data-order-filter="${id}" aria-pressed="${!q && st === id}">${name} <span class="chip-count">${n}</span></button>`;
    const empty = q ? 'По этому запросу заказов нет, в том числе в архиве.'
      : st === 'archive' ? `Архив пуст. Сюда попадают выполненные и отменённые заказы через ${ARCHIVE_DAYS} дней.`
      : 'Нет заказов с таким статусом.';
    return `
      <div class="admin-toolbar">
        <label class="toolbar-search"><span class="visually-hidden">Поиск заказа</span>${FS.ui.icon.search}<input id="order-search" type="search" placeholder="Номер, имя или телефон" value="${esc(orderFilter.q)}" autocomplete="off"></label>
        ${serverMode() ? '<button class="btn btn--outline btn--sm" type="button" data-orders-refresh>Обновить</button>' : ''}
        ${all.length ? `<button class="btn btn--outline btn--sm" type="button" data-orders-export>Скачать в Excel</button>` : ''}
        <button class="btn btn--outline btn--sm" type="button" data-test-order>Добавить тестовый заказ</button>
      </div>
      ${ordersExportPanel(all)}
      <div class="chips admin-chips">${chip('all', 'В работе', work.length)}${FS.api.STATUSES.map((s) => chip(s.id, s.name, work.filter((o) => o.status === s.id).length)).join('')}${chip('archive', 'Архив', archive.length)}</div>
      ${q ? '<p class="stat-note orders-note">Поиск по всем заказам, включая архив.</p>' : st === 'archive' ? `<p class="stat-note orders-note">Выполненные и отменённые заказы старше ${ARCHIVE_DAYS} дней. Они хранятся и учитываются в подарках за покупки.</p>` : ''}
      <div data-order-list>${shown.length ? `<div class="orders">${shown.map(orderRow).join('')}</div>
        ${list.length > shown.length ? `<div class="orders-more"><button class="btn btn--outline btn--sm" type="button" data-orders-more>Показать ещё</button><span class="stat-note">Показано ${shown.length} из ${list.length}</span></div>` : ''}`
        : (all.length ? `<p class="panel-empty">${empty}</p>` : emptyOrders())}</div>`;
  }

  /* ---------- Скачать заказы в Excel за период ---------- */
  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function periodRange(period, from, to) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (period === 'month') return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    if (period === 'prev') return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    if (period === 'year') return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
    if (period === 'range') {
      const a = from ? new Date(`${from}T00:00:00`) : new Date(0);
      const b = to ? new Date(`${to}T00:00:00`) : now;
      b.setDate(b.getDate() + 1);
      return [a, b];
    }
    return [new Date(0), new Date(8.64e15)];
  }
  const inPeriod = (o, range) => { const t = new Date(o.createdAt); return t >= range[0] && t < range[1]; };

  function ordersExportPanel(all) {
    const ex = ordersExport;
    if (!ex) return '';
    const range = periodRange(ex.period, ex.from, ex.to);
    const n = all.filter((o) => inPeriod(o, range)).length;
    const opt = (id, name) => `<option value="${id}" ${ex.period === id ? 'selected' : ''}>${name}</option>`;
    return `<section class="admin-panel import-panel orders-export">
        <h2>Заказы в Excel</h2>
        <form class="orders-export-form" data-orders-export-form novalidate>
          <label class="field"><span>Период</span>
            <select name="period" data-export-period>${opt('month', 'Этот месяц')}${opt('prev', 'Прошлый месяц')}${opt('year', 'Этот год')}${opt('all', 'За всё время')}${opt('range', 'Выбрать даты')}</select></label>
          ${ex.period === 'range' ? `<label class="field"><span>С</span><input type="date" name="from" value="${esc(ex.from || '')}" data-export-date></label>
          <label class="field"><span>По</span><input type="date" name="to" value="${esc(ex.to || isoDay(new Date()))}" data-export-date></label>` : ''}
        </form>
        <p class="stat-note">Заказов за период: <b data-export-count>${n}</b>. Два листа: «Заказы» (строка на заказ) и «Позиции» (строка на каждый аромат в заказе). В файл попадают и заказы из архива.</p>
        <div class="tg-actions">
          <button class="btn btn--primary btn--sm" type="button" data-orders-export-go ${n ? '' : 'disabled'}>Скачать</button>
          <button class="btn btn--outline btn--sm" type="button" data-orders-export-close>Закрыть</button>
        </div>
      </section>`;
  }

  async function exportOrders(btn) {
    const ex = ordersExport;
    const range = periodRange(ex.period, ex.from, ex.to);
    const list = allOrders().filter((o) => inPeriod(o, range));
    const label = ex.period === 'range' ? `${ex.from || 'начало'}_${ex.to || isoDay(new Date())}` : ex.period === 'all' ? 'все' : isoDay(range[0]).slice(0, ex.period === 'year' ? 4 : 7);
    btn.disabled = true;
    try {
      await FS.importer.exportOrders(list, `5th-sense-zakazy-${label}.xlsx`, { status: statusName });
      toast(`Скачано заказов: ${list.length}`);
    } catch (err) {
      toast(err.message, null, { duration: 8000 });
    }
    btn.disabled = false;
  }


  function testOrder() {
    const pool = FS.products.filter((p) => p.type === 'perfume' && FS.api.inStock(p));
    if (!pool.length) { toast('Нет товаров в наличии для тестового заказа'); return; }
    const picks = pool.sort(() => Math.random() - 0.5).slice(0, Math.min(2, pool.length));
    const items = picks.map((p) => { const v = p.volumes.find((x) => x.stock > 0); return { id: p.id, name: p.name, brand: p.brand, ml: v.ml, qty: 1, price: v.price }; });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const delivery = FS.delivery.find((d) => d.id === 'courier') || FS.delivery[0];
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

  /* ---------- Клиенты: подарки за покупки ---------- */
  let loyaltyData = null; // { settings, clients }
  let loyaltyError = '';
  let clientQ = '';
  const SOURCES = [['boutique', 'Бутик'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp'], ['phone', 'Звонок'], ['site', 'Сайт'], ['other', 'Другое']];
  const sourceName = (id) => (SOURCES.find((x) => x[0] === id) || [id, id])[1];
  const prettyPhone = (k) => (k && k.length === 11 ? `+${k[0]} ${k.slice(1, 4)} ${k.slice(4, 7)} ${k.slice(7, 9)} ${k.slice(9)}` : `+${k}`);

  let kassaPinSet = null; // задан ли PIN-код кассы
  async function loadClients() {
    try {
      loyaltyData = await FS.backend.call('GET', '/api/loyalty', null, { auth: true });
      kassaPinSet = (await FS.backend.call('GET', '/api/kassa?pin=status', null, { auth: true }).catch(() => ({ pinSet: null }))).pinSet;
      loyaltyError = '';
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      loyaltyError = err.message;
    }
    if (root && document.contains(root) && route.tab === 'clients') renderBody();
  }

  function progress(st, every) {
    if (st.nextIsGift) return `<span class="status status--done">🎁 Следующая — подарок: ${esc(st.nextGift)}</span>`;
    return `<span class="status">до подарка ещё ${st.left}</span>`;
  }

  function clientRow(c, s) {
    const st = c.status;
    const giftNums = new Set(st.gifts.map((g) => g.number));
    const rows = c.purchases.map((p, i) => `<li><span>${giftNums.has(i + 1) ? '🎁 ' : ''}${i + 1}. ${fmtDate(p.date)} · ${esc(sourceName(p.source))}${p.order ? ` · заказ ${esc(p.order)}` : ''}${p.note ? ` · ${esc(p.note)}` : ''}${p.by ? ` <em>(${esc(p.by)})</em>` : ''}</span>
        <span>${money(p.amount)} ${p.order ? '' : `<button class="link-btn" type="button" data-lp-del="${esc(p.id)}" data-phone="${esc(c.phone)}">Удалить</button>`}</span></li>`).join('');
    return `<details class="order client" data-client="${esc(c.phone)}">
        <summary>
          <span class="order-num"><strong>${esc(c.name || 'Без имени')}</strong><em class="selectable">${esc(prettyPhone(c.phone))}</em></span>
          <span class="order-who">${st.count} ${plural(st.count, 'покупка', 'покупки', 'покупок')}<em>на ${money(st.total)}</em></span>
          <span class="order-sum">${progress(st, s.every)}</span>
        </summary>
        <div class="order-body">
          <ul class="order-items">${rows}</ul>
          ${st.gifts.length ? `<p><b>Подарки:</b> ${st.gifts.map((g) => `${g.number}-я покупка — ${esc(g.gift)} (за ${money(g.base)})`).join('; ')}</p>` : ''}
          ${st.nextIsGift ? `<p>Следующая, ${st.nextNumber}-я покупка — с подарком: <b>${esc(st.nextGift)}</b> (за ${s.every - 1} предыдущие — ${money(st.base)}).</p>` : ''}
        </div>
      </details>`;
  }

  function settingsForm(s) {
    const tiers = s.tiers.concat({ upTo: '', gift: '' });
    const chats = (tg && tg.chats) || [];
    return `<form class="lp-settings" data-lp-settings>
        <label class="field"><span>Подарок за каждую … покупку</span><input type="number" min="2" max="20" name="every" value="${s.every}"></label>
        <p class="stat-note">Подарок зависит от суммы ${s.every - 1} предыдущих покупок. Покупатели видят только правило «каждая ${s.every}-я — с подарком».</p>
        <div class="lp-tiers">${tiers.map((t, i) => `<div class="lp-tier">
            <label><span>${i === tiers.length - 1 ? 'Новый уровень: до, ₸' : 'До, ₸ (пусто = больше)'}</span><input type="number" min="0" step="1" name="upTo" value="${t.upTo == null ? '' : t.upTo}"></label>
            <label><span>Подарок</span><input type="text" name="gift" value="${esc(t.gift)}" placeholder="Например, распив 10 мл"></label>
          </div>`).join('')}</div>
        <label class="field"><span>Кто видит подсказку «Положен подарок» в Telegram</span>
          <select name="notify"><option value="all" ${s.notify !== 'owner' ? 'selected' : ''}>Все сотрудники</option><option value="owner" ${s.notify === 'owner' ? 'selected' : ''}>Только владелец</option></select>
        </label>
        <label class="field"><span>Чат владельца</span>
          <select name="ownerChat"><option value="">— выберите —</option>${chats.map((c) => `<option value="${esc(c.id)}" ${String(c.id) === String(s.ownerChat) ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>
        </label>
        <button class="btn btn--outline btn--sm" type="submit">Сохранить правила</button>
      </form>`;
  }

  function clientsBody() {
    if (!serverMode() || !serverInfo().storage) return '<p class="panel-empty">Подарки за покупки работают, когда подключены сервер и хранилище Upstash Redis.</p>';
    if (loyaltyError) return `<div class="panel-empty"><p>Не удалось загрузить клиентов: ${esc(loyaltyError)}</p><button class="btn btn--outline btn--sm" type="button" data-lp-reload>Повторить</button></div>`;
    if (!loyaltyData) return '<p class="panel-empty">Загружаем клиентов…</p>';
    const s = loyaltyData.settings;
    const q = clientQ.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const list = loyaltyData.clients.filter((c) => !q || (c.name || '').toLowerCase().includes(q) || (digits.length >= 3 && c.phone.includes(digits)));
    const due = loyaltyData.clients.filter((c) => c.status.nextIsGift).length;
    return `
      <div class="admin-cols">
        <section class="admin-panel">
          <h2>Добавить покупку</h2>
          <p>Покупка в бутике, через Instagram, WhatsApp или по звонку. Заказы с сайта засчитываются сами при статусе «Выполнен».</p>
          <form class="lp-add" data-lp-add>
            <label class="field"><span>Телефон</span><input name="phone" type="tel" placeholder="+7 701 123 45 67" required></label>
            <label class="field"><span>Имя</span><input name="name" type="text"></label>
            <label class="field"><span>Сумма, ${esc(FS.config.currency)}</span><input name="amount" type="number" min="1" step="1" inputmode="numeric" required></label>
            <label class="field"><span>Где купили</span><select name="source">${SOURCES.filter((x) => x[0] !== 'site').map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
            <label class="field"><span>Что купили</span><input name="note" type="text" placeholder="Baccarat 10 мл"></label>
            <label class="field"><span>Дата</span><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
            <button class="btn btn--primary btn--sm" type="submit">Записать покупку</button>
          </form>
          <p class="stat-note">Быстрее — на экране <a class="text-link" href="#kassa">«Касса»</a> или через бота: <code>/buy 87011234567 45000</code>.</p>
        </section>
        <section class="admin-panel">
          <h2>Правила подарков</h2>
          ${settingsForm(s)}
        </section>
        <section class="admin-panel kassa-panel">
          <div class="panel-head"><h2>Касса</h2><a class="text-link" href="#kassa">Открыть кассу</a></div>
          <p class="stat-note">Быстрая запись покупок в бутике с телефона или планшета: найти клиента по номеру или имени, вписать сумму, «Записать». Один PIN-код для владельца и сотрудников.</p>
          <div class="kassa-qr">
            <div class="ks-qr-code" data-kassa-qr>QR-код…</div>
            <p class="stat-note">Наведите камеру телефона бутика на этот QR-код — касса откроется в браузере. Затем: iPhone — «Поделиться» → «На экран „Домой“»; Android — ⋮ → «Добавить на главный экран». Появится значок «Касса».<br>Адрес: <span class="selectable">${esc(location.origin + location.pathname)}#kassa</span></p>
          </div>
          <form class="lp-settings kassa-pin-form" data-kassa-pin novalidate>
            <label class="field"><span>${kassaPinSet ? 'Новый PIN-код' : 'PIN-код'}, 4–8 цифр</span><input name="pin" type="text" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="Например, 2580"></label>
            <button class="btn btn--primary btn--sm" type="submit">${kassaPinSet ? 'Сменить PIN-код' : 'Сохранить PIN-код'}</button>
          </form>
          <p class="stat-note">${kassaPinSet ? 'PIN-код задан. После смены все телефоны, где открыта касса, выйдут — войдите заново с новым PIN-кодом.' : kassaPinSet === false ? '<b>PIN-код ещё не задан</b> — касса не откроется, пока вы его не сохраните.' : ''}</p>
        </section>
      </div>
      <div class="admin-toolbar">
        <label class="toolbar-search"><span class="visually-hidden">Поиск клиента</span>${FS.ui.icon.search}<input id="client-search" type="search" placeholder="Имя или телефон" value="${esc(clientQ)}" autocomplete="off"></label>
      </div>
      <p class="result-count">${loyaltyData.clients.length} ${plural(loyaltyData.clients.length, 'клиент', 'клиента', 'клиентов')}${due ? ` · у ${due} следующая покупка с подарком` : ''}</p>
      ${list.length ? `<div class="orders">${list.map((c) => clientRow(c, s)).join('')}</div>` : `<p class="panel-empty">${loyaltyData.clients.length ? 'Никого не нашли.' : 'Покупок пока нет. Они появятся, когда заказы с сайта станут «Выполнен» или вы запишете покупку из бутика.'}</p>`}`;
  }

  async function loyaltyAction(body, okText) {
    try {
      const data = await FS.backend.call('POST', '/api/loyalty', body, { auth: true });
      await loadClients();
      return data;
    } catch (err) {
      if (err.status === 401) { expired(); return null; }
      toast(err.message, null, { duration: 8000 });
      return null;
    }
  }

  /* ---------- Товары ---------- */
  function productList() {
    const q = productFilter.q.trim().toLowerCase();
    const cat = FS.categories.find((c) => c.id === productFilter.category);
    return FS.products.filter((p) => (!cat || cat.match(p)) && (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q)));
  }

  function productsBody() {
    const list = productList();
    const pe = priceEdit;
    const editable = (p) => pe && p.type !== 'set';
    const flags = (p) => (p.hidden ? '<span class="tag tag--off">скрыт с сайта</span>' : '') + [p.niche && 'нишевая', p.bestseller && 'бестселлер', p.isNew && 'новинка', p.featured && 'на витрине'].filter(Boolean).map((f) => `<span class="tag">${f}</span>`).join('');
    const track = FS.api.tracking();
    const vols = (p) => `${p.perMl ? `<span class="ptable-perml"><b>1 мл</b> ${money(p.perMl)}</span>` : ''}${p.volumes.map((v) => `<span><b>${esc(volumeLabel(v))}</b> ${money(v.price)}${track ? ` <span class="stock-pill ${v.stock > 2 ? '' : v.stock ? 'is-low' : 'is-out'}">${v.stock} шт.</span>` : ''}</span>`).join('')}`;
    const editVols = (p) => {
      const cur = pe.edits.has(p.id) ? pe.edits.get(p.id) : FS.api.perMl(p);
      return `<label class="perml-edit"><span>Цена за 1 мл, ${esc(FS.config.currency)}</span>
          <input type="number" min="1" step="1" inputmode="numeric" data-perml="${p.id}" value="${cur}" aria-label="Цена за 1 мл: ${esc(p.brand)} ${esc(p.name)}"></label>
        <span class="perml-calc" data-calc="${p.id}">${calcText(p, cur)}</span>`;
    };
    return `
      <div class="admin-toolbar">
        <label class="toolbar-search"><span class="visually-hidden">Поиск товара</span>${FS.ui.icon.search}<input id="product-search" type="search" placeholder="Название или бренд" value="${esc(productFilter.q)}" autocomplete="off"></label>
        <label class="toolbar-sort"><span class="visually-hidden">Коллекция</span>
          <select id="product-category"><option value="">Все коллекции</option>${FS.categories.map((c) => `<option value="${c.id}" ${c.id === productFilter.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        </label>
        <a class="btn btn--primary btn--sm" href="#admin-new">Добавить товар</a>
      </div>
      <div class="admin-toolbar admin-toolbar--files">
        <button class="btn ${pe ? 'btn--primary' : 'btn--outline'} btn--sm" type="button" data-price-edit>${pe ? 'Закончить правку цен' : 'Править цены'}</button>
        <label class="btn btn--outline btn--sm file-btn">Загрузить таблицу<input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-import-file></label>
        <button class="btn btn--outline btn--sm" type="button" data-export-xlsx>Скачать таблицу</button>
        ${canPhotos() ? '<label class="btn btn--outline btn--sm file-btn">Загрузить фото<input type="file" accept="image/*" multiple data-photos></label>' : ''}
        <button class="btn btn--outline btn--sm" type="button" data-price-open>Изменить цены</button>
        <a class="btn btn--outline btn--sm" href="assets/files/5th-sense-catalog.xlsx" download>Шаблон таблицы</a>
      </div>
      ${importPanel()}
      ${pricePanel()}
      ${pe ? '<p class="co-hint price-edit-hint">Меняйте цену за 1 мл прямо в списке, цены объёмов пересчитаются сами. Отметьте ароматы галочкой (можно нажать на фото), чтобы изменить им цену на одинаковый процент. Ничего не сохранится, пока вы не нажмёте «Сохранить цены».</p>' : ''}
      <p class="result-count">${list.length} ${plural(list.length, 'товар', 'товара', 'товаров')}</p>
      ${list.length ? `<div class="ptable ${pe ? 'ptable--edit' : ''}" role="table" aria-label="Товары">
        <div class="ptable-row ptable-head" role="row"><span role="columnheader">${pe ? 'Выбор' : 'Фото'}</span><span role="columnheader">Товар</span><span role="columnheader">${pe ? 'Цена за 1 мл и цены объёмов' : FS.api.tracking() ? 'Объёмы, цены и остатки' : 'Объёмы и цены'}</span><span role="columnheader">Действия</span></div>
        ${list.map((p) => `
          <div class="ptable-row ${pe && pe.edits.has(p.id) ? 'is-edited' : ''} ${pe && pe.picked.has(p.id) ? 'is-picked' : ''}" role="row" data-pid="${p.id}">
            ${editable(p)
              ? `<label class="ptable-thumb ptable-pick" role="cell"><input type="checkbox" data-pick="${p.id}" ${pe.picked.has(p.id) ? 'checked' : ''} aria-label="Выбрать ${esc(p.brand)} ${esc(p.name)}">${FS.bottle.media(p, { style: 'blueprint' })}</label>`
              : `<span class="ptable-thumb" role="cell">${FS.bottle.media(p, { style: 'blueprint' })}</span>`}
            <span class="ptable-name" role="cell"><em>${esc(p.brand)}</em><strong>${esc(p.name)}</strong><span class="ptable-flags">${flags(p)}</span></span>
            <span class="ptable-vols ${editable(p) ? 'ptable-vols--edit' : ''}" role="cell">${editable(p) ? editVols(p) : vols(p)}</span>
            <span class="ptable-actions" role="cell"><a class="btn btn--outline btn--sm" href="#admin-edit-${p.id}">Редактировать</a><a class="link-btn" href="#product-${p.id}">На сайте</a></span>
          </div>`).join('')}
      </div>` : '<p class="panel-empty">Товары не найдены. Измените запрос или выберите другую коллекцию.</p>'}
      ${pe ? priceBar() : ''}`;
  }

  /* ---------- Править цены: прямо в списке, с галочками ---------- */
  function calcText(p, perMl) {
    return Number(perMl) > 0 ? p.volumes.map((v) => `${esc(volumeLabel(v))} ${money(FS.api.priceFor(perMl, v.ml))}`).join(' · ') : 'Укажите цену за 1 мл';
  }

  function priceBar() {
    const pe = priceEdit;
    return `<div class="price-bar" data-price-bar>
        <div class="price-bar-group">
          <span class="price-bar-count" data-pick-count>Выбрано: ${pe.picked.size}</span>
          <button class="link-btn" type="button" data-pick-all>Выбрать найденные</button>
          <button class="link-btn" type="button" data-pick-none ${pe.picked.size ? '' : 'disabled'}>Снять выбор</button>
        </div>
        <form class="price-bar-group price-bar-pct" data-pick-pct novalidate>
          <label><span class="visually-hidden">На сколько процентов</span><input name="pct" type="text" inputmode="decimal" placeholder="%, напр. 10 или -5" autocomplete="off"></label>
          <button class="btn btn--outline btn--sm" type="submit" ${pe.picked.size ? '' : 'disabled'}>Применить к выбранным</button>
        </form>
        <div class="price-bar-group">
          <span class="price-bar-count" data-edit-count>Изменено: ${pe.edits.size}</span>
          <button class="btn btn--primary btn--sm" type="button" data-edits-save ${pe.edits.size ? '' : 'disabled'}>Сохранить цены</button>
          <button class="btn btn--outline btn--sm" type="button" data-edits-cancel ${pe.edits.size ? '' : 'disabled'}>Отменить</button>
        </div>
      </div>`;
  }

  // Счётчики и кнопки панели без перерисовки списка (чтобы не терять фокус в поле цены).
  function updatePriceBar() {
    const pe = priceEdit;
    const bar = $('[data-price-bar]', root);
    if (!pe || !bar) return;
    $('[data-pick-count]', bar).textContent = `Выбрано: ${pe.picked.size}`;
    $('[data-edit-count]', bar).textContent = `Изменено: ${pe.edits.size}`;
    $('[data-pick-none]', bar).disabled = !pe.picked.size;
    $('[data-pick-pct] button', bar).disabled = !pe.picked.size;
    $('[data-edits-save]', bar).disabled = !pe.edits.size;
    $('[data-edits-cancel]', bar).disabled = !pe.edits.size;
  }

  // Новая цена за 1 мл для товара: если совпала с прежней — правки нет.
  function setEdit(p, value) {
    const v = Math.round(Number(value));
    if (v > 0 && v !== FS.api.perMl(p)) priceEdit.edits.set(p.id, v); else priceEdit.edits.delete(p.id);
  }

  const withPerMl = (p, perMl) => ({ ...p, perMl, volumes: p.volumes.map((v) => ({ ...v, price: FS.api.priceFor(perMl, v.ml) })) });

  async function saveEdits(btn) {
    const pe = priceEdit;
    if (!pe || !pe.edits.size) return;
    const count = pe.edits.size;
    const list = FS.products.map((p) => (pe.edits.has(p.id) ? withPerMl(p, pe.edits.get(p.id)) : p));
    btn.disabled = true;
    btn.textContent = 'Сохраняем…';
    try {
      const ok = await Promise.resolve(FS.api.replaceCatalog(list));
      if (ok === false) throw new Error('браузер не сохранил каталог: закончилось место');
      priceEdit = { edits: new Map(), picked: new Set() };
      toast(`Цены сохранены у ${count} ${plural(count, 'аромата', 'ароматов', 'ароматов')}`);
      renderBody();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Сохранить цены';
      toast(`Цены не сохранены: ${err.message}`, null, { duration: 8000 });
    }
  }

  /* ---------- Изменить цены: все ароматы или один бренд на N % ---------- */
  // Процент к цене за 1 мл, результат округляется до 10 ₸ (пропорция объёмов сохраняется).
  const bumpPerMl = (perMl, pct) => Math.max(10, Math.round((perMl * (1 + pct / 100)) / 10) * 10);

  function withPercent(p, pct) {
    const perMl = bumpPerMl(FS.api.perMl(p), pct);
    return { ...p, perMl, volumes: p.volumes.map((v) => ({ ...v, price: FS.api.priceFor(perMl, v.ml) })) };
  }

  function pricePlan(brand, pct) {
    const match = (p) => p.type !== 'set' && (!brand || p.brand === brand);
    const list = FS.products.map((p) => (match(p) ? withPercent(p, pct) : p));
    const changed = list.filter((p, i) => p !== FS.products[i] && JSON.stringify(p.volumes) !== JSON.stringify(FS.products[i].volumes));
    return { brand, pct, list, changed, before: new Map(FS.products.map((p) => [p.id, p])) };
  }

  function pricePanel() {
    if (!priceTool) return '';
    const brands = [...new Set(FS.products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b));
    const count = (b) => FS.products.filter((p) => p.brand === b && p.type !== 'set').length;
    const plan = priceTool.plan;
    const example = (p) => {
      const was = plan.before.get(p.id);
      const v = p.volumes[0];
      const old = was.volumes.find((x) => x.ml === v.ml);
      return `<li><b>${esc(`${p.brand} ${p.name}`)}</b>: 1 мл ${money(FS.api.perMl(was))} → ${money(p.perMl)}; ${esc(volumeLabel(v))} ${money(old ? old.price : 0)} → ${money(v.price)}</li>`;
    };
    return `<section class="admin-panel import-panel price-panel">
        <h2>Изменить цены</h2>
        <p class="co-hint">Цена за 1 мл меняется на указанный процент и округляется до 10 ₸, цены всех объёмов пересчитываются по ней. Чтобы снизить цены, напишите минус, например −5.</p>
        <form class="price-form" data-price-form novalidate>
          <div class="field"><span class="field-label" id="pp-brand-label">Какие ароматы</span>${brandPicker(brands, count)}</div>
          <div class="field"><label for="pp-pct">На сколько процентов</label>
            <input id="pp-pct" name="pct" type="text" inputmode="decimal" placeholder="Например 10 или -5" value="${esc(priceTool.pct)}" autocomplete="off">
            <p class="field-error" data-price-error></p></div>
          <button class="btn btn--outline btn--sm" type="submit">Показать, что изменится</button>
        </form>
        ${plan ? `<div class="price-preview">
          <p><b>${plan.changed.length ? `Изменятся цены у ${plan.changed.length} ${plural(plan.changed.length, 'аромата', 'ароматов', 'ароматов')}` : 'Цены не изменятся'}</b>${plan.brand ? ` бренда ${esc(plan.brand)}` : ''}: ${plan.pct > 0 ? '+' : ''}${plan.pct}%.</p>
          ${plan.changed.length ? `<ul>${plan.changed.slice(0, 8).map(example).join('')}</ul>${plan.changed.length > 8 ? `<p>…и ещё ${plan.changed.length - 8}</p>` : ''}` : ''}
          <p class="stat-note">${FS.api.remoteCatalog() ? 'Новые цены сразу увидят все покупатели.' : 'Сервер не подключён: цены изменятся только в этом браузере.'}</p>
        </div>` : ''}
        <div class="tg-actions">
          ${plan && plan.changed.length ? '<button class="btn btn--primary btn--sm" type="button" data-price-apply>Применить</button>' : ''}
          <button class="btn btn--outline btn--sm" type="button" data-price-close>${plan ? 'Отмена' : 'Закрыть'}</button>
        </div>
      </section>`;
  }

  // Выбор бренда: свой список вместо системного (шрифт сайта, поиск по брендам).
  function brandPicker(brands, count) {
    const all = FS.products.filter((p) => p.type !== 'set').length;
    const cur = priceTool.brand;
    const opt = (value, name, n) => `<li><button class="brand-opt ${value === cur ? 'is-selected' : ''}" type="button" role="option" aria-selected="${value === cur}" data-brand-opt="${esc(value)}"><span class="brand-opt-name">${esc(name)}</span><span class="brand-opt-count">${n}</span></button></li>`;
    return `<div class="brand-pick" data-brand-pick>
        <input type="hidden" name="brand" value="${esc(cur)}">
        <button class="brand-pick-btn" id="pp-brand" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="pp-brand-label pp-brand" data-brand-toggle><span data-brand-current>${esc(cur || 'Все ароматы')}</span></button>
        <div class="brand-pick-pop" hidden>
          <label class="brand-pick-search"><span class="visually-hidden">Найти бренд</span>${FS.ui.icon.search}<input type="search" placeholder="Найти бренд" autocomplete="off" data-brand-filter></label>
          <ul class="brand-pick-list" role="listbox" aria-labelledby="pp-brand-label">
            ${opt('', 'Все ароматы', all)}
            ${brands.map((b) => opt(b, b, count(b))).join('')}
          </ul>
          <p class="brand-pick-empty" hidden>Бренд не найден</p>
        </div>
      </div>`;
  }

  function closeBrandPicker(pick, focusButton) {
    if (!pick) return;
    $('.brand-pick-pop', pick).hidden = true;
    $('[data-brand-toggle]', pick).setAttribute('aria-expanded', 'false');
    if (focusButton) $('[data-brand-toggle]', pick).focus();
  }

  async function applyPrices(btn) {
    const plan = priceTool && priceTool.plan;
    if (!plan) return;
    btn.disabled = true;
    btn.textContent = 'Сохраняем…';
    try {
      const ok = await Promise.resolve(FS.api.replaceCatalog(plan.list));
      if (ok === false) throw new Error('браузер не сохранил каталог: закончилось место');
      priceTool = null;
      toast(`Цены обновлены у ${plan.changed.length} ${plural(plan.changed.length, 'аромата', 'ароматов', 'ароматов')}`);
      renderBody();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Применить';
      toast(`Цены не обновлены: ${err.message}`, null, { duration: 8000 });
    }
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
      perMl: '', volumes: FS.config.decants.volumes.map((ml) => ({ ml, price: 0, stock: FS.api.tracking() ? 0 : 99 })), main: FS.config.decants.volumes[0],
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
      <div class="vol-row ${FS.api.tracking() ? '' : 'vol-row--nostock'}" data-vol="${i}">
        <label class="vol-main" title="Показывать этот объём в карточке"><input type="radio" name="main" value="${i}" ${v.ml === draft.main ? 'checked' : ''}><span class="visually-hidden">Показывать в карточке</span></label>
        <label><span>Объём, мл</span><input type="number" min="1" step="1" inputmode="numeric" data-vol-field="ml" value="${v.ml || ''}"></label>
        <label><span>Подпись</span><input type="text" data-vol-field="label" value="${esc(v.label || '')}" placeholder="5 × 10 мл"></label>
        <label><span>Цена, ${esc(FS.config.currency)}</span><input type="number" min="0" step="1" inputmode="numeric" data-vol-field="price" value="${draft.perMl > 0 && v.ml ? FS.api.priceFor(draft.perMl, v.ml) : v.price || ''}" ${draft.perMl > 0 ? 'readonly title="Считается из цены за 1 мл"' : ''}></label>
        ${FS.api.tracking() ? `<label><span>Остаток, шт.</span><input type="number" min="0" step="1" inputmode="numeric" data-vol-field="stock" value="${v.stock}"></label>` : `<input type="hidden" data-vol-field="stock" value="${v.stock}">`}
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

        <fieldset class="co-step"><legend>${FS.api.tracking() ? 'Объёмы, цены и остатки' : 'Объёмы и цены'}</legend>
          <div class="field perml-field" data-field="perMl">
            <label for="pe-perMl">Цена за 1 мл, ${esc(FS.config.currency)}</label>
            <input id="pe-perMl" name="perMl" type="number" min="0" step="1" inputmode="numeric" value="${p.perMl > 0 ? p.perMl : ''}">
            <p class="co-hint">Цены объёмов считаются сами: цена за 1 мл × миллилитры, без скидок. Оставьте поле пустым, чтобы вписать цены вручную.</p>
            <p class="field-error" id="pe-perMl-error"></p>
          </div>
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
            ${[['niche', 'Нишевая парфюмерия'], ['bestseller', 'Бестселлер'], ['isNew', 'Новинка'], ['featured', 'Широкая карточка в каталоге'], ['hidden', 'Скрыть с сайта (закончился надолго)']].map(([k, l]) => `
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
    ['niche', 'bestseller', 'isNew', 'featured', 'hidden'].forEach((k) => { if (f.elements[k].checked) draft[k] = true; else delete draft[k]; });
    const perMl = Number(val('perMl'));
    if (perMl > 0) draft.perMl = perMl; else delete draft.perMl;
    draft.volumes = $$('.vol-row', f).map((row) => {
      const get = (k) => $(`[data-vol-field="${k}"]`, row).value.trim();
      const ml = Number(get('ml')) || 0;
      const v = { ml, price: perMl > 0 ? FS.api.priceFor(perMl, ml) : Number(get('price')) || 0, stock: Math.max(0, Math.floor(Number(get('stock')) || 0)) };
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
    // Вкладка «Клиенты»: список чатов для выбора чата владельца (форму не перерисовываем).
    const owner = root && root.querySelector('[data-lp-settings] select[name="ownerChat"]');
    if (owner && tg && tg.chats) {
      const current = owner.value || (loyaltyData && loyaltyData.settings.ownerChat) || '';
      owner.innerHTML = '<option value="">— выберите —</option>' + tg.chats.map((c) => `<option value="${esc(c.id)}" ${String(c.id) === String(current) ? 'selected' : ''}>${esc(c.title)}</option>`).join('');
    }
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
    if (route.tab === 'clients') return clientsBody();
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
    fillKassaQr();
  }

  // QR-код кассы в блоке «Касса»: навести камеру телефона бутика.
  function fillKassaQr() {
    const box = root && root.querySelector('[data-kassa-qr]');
    if (!box || !FS.qr) return;
    FS.qr.svg(`${location.origin}${location.pathname}#kassa`, 'QR-код: адрес кассы').then((svg) => { box.innerHTML = svg; }, (err) => { box.textContent = err.message; });
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
    fillKassaQr();

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
      if (e.target.matches('[data-kassa-pin]')) {
        e.preventDefault();
        const input = e.target.elements.pin;
        const pin = input.value.trim();
        if (!/^\d{4,8}$/.test(pin)) { toast('PIN-код — от 4 до 8 цифр'); input.focus(); return; }
        try {
          await FS.backend.call('POST', '/api/kassa', { action: 'setPin', pin }, { auth: true });
          kassaPinSet = true;
          toast('PIN-код кассы сохранён');
          renderBody();
        } catch (err) {
          if (err.status === 401) { expired(); return; }
          toast(err.message, null, { duration: 8000 });
        }
        return;
      }
      if (e.target.matches('[data-lp-add]')) {
        e.preventDefault();
        const f = e.target;
        const v = (n) => f.elements[n].value.trim();
        const btn = $('button[type="submit"]', f);
        btn.disabled = true;
        const data = await loyaltyAction({ action: 'add', phone: v('phone'), name: v('name'), amount: v('amount'), source: v('source'), note: v('note'), date: v('date') });
        btn.disabled = false;
        if (data && data.client) {
          const st = data.client.status;
          const g = st.gifts.length && st.gifts[st.gifts.length - 1].number === st.count ? st.gifts[st.gifts.length - 1] : null;
          toast(g ? `🎁 Это ${g.number}-я покупка — положен подарок: ${g.gift}` : `Покупка записана. ${st.nextIsGift ? 'Следующая — с подарком' : `До подарка ещё ${st.left}`}`, null, { duration: 9000 });
        }
        return;
      }
      if (e.target.matches('[data-lp-settings]')) {
        e.preventDefault();
        const f = e.target;
        const tiers = $$('.lp-tier', f).map((row) => ({ upTo: $('[name="upTo"]', row).value.trim(), gift: $('[name="gift"]', row).value.trim() })).filter((t) => t.gift);
        const data = await loyaltyAction({ action: 'settings', settings: { every: f.elements.every.value, tiers: tiers.map((t) => ({ upTo: t.upTo === '' ? null : Number(t.upTo), gift: t.gift })), notify: f.elements.notify.value, ownerChat: f.elements.ownerChat.value || null } });
        if (data) toast('Правила подарков сохранены');
        return;
      }
      if (e.target.matches('[data-pick-pct]')) {
        e.preventDefault();
        const input = e.target.elements.pct;
        const raw = input.value.trim().replace(',', '.').replace(/[−–—]/g, '-').replace(/[%\s]/g, '');
        const pct = Number(raw);
        if (!raw || !Number.isFinite(pct) || pct === 0 || pct <= -90 || pct > 300) {
          toast('Напишите процент числом, например 10 или -5.');
          input.focus();
          return;
        }
        let n = 0;
        priceEdit.picked.forEach((id) => {
          const p = FS.api.productSync(id);
          if (!p) return;
          const base = priceEdit.edits.has(id) ? priceEdit.edits.get(id) : FS.api.perMl(p);
          setEdit(p, bumpPerMl(base, pct));
          n++;
        });
        renderBody();
        toast(`Цена за 1 мл изменена у ${n} ${plural(n, 'аромата', 'ароматов', 'ароматов')} на ${pct > 0 ? '+' : ''}${pct}%. Проверьте и нажмите «Сохранить цены».`);
        return;
      }
      if (e.target.matches('[data-price-form]')) {
        e.preventDefault();
        const f = e.target;
        const raw = f.elements.pct.value.trim().replace(',', '.').replace(/[−–—]/g, '-').replace(/[%\s]/g, '');
        const pct = Number(raw);
        priceTool = { ...priceTool, brand: f.elements.brand.value, pct: f.elements.pct.value, plan: null };
        if (!raw || !Number.isFinite(pct) || pct === 0 || pct <= -90 || pct > 300) {
          renderBody();
          $('[data-price-error]', el).textContent = 'Напишите процент числом, например 10 или -5.';
          $('#pp-pct', el).focus();
          return;
        }
        priceTool.plan = pricePlan(priceTool.brand, pct);
        renderBody();
        $('.price-panel', el).scrollIntoView({ block: 'start' });
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
      // Список брендов в «Изменить цены».
      const openPick = $('[data-brand-pick] .brand-pick-pop:not([hidden])', el);
      if (openPick && !t.closest('[data-brand-pick]')) closeBrandPicker(openPick.closest('[data-brand-pick]'));
      const toggle = t.closest('[data-brand-toggle]');
      if (toggle) {
        const pick = toggle.closest('[data-brand-pick]');
        const pop = $('.brand-pick-pop', pick);
        if (!pop.hidden) { closeBrandPicker(pick); return; }
        pop.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        const filter = $('[data-brand-filter]', pick);
        filter.value = '';
        filter.dispatchEvent(new Event('input', { bubbles: true }));
        filter.focus();
        const sel = $('.brand-opt.is-selected', pick);
        if (sel) sel.scrollIntoView({ block: 'nearest' });
        return;
      }
      const brandOpt = t.closest('[data-brand-opt]');
      if (brandOpt) {
        const pick = brandOpt.closest('[data-brand-pick]');
        const value = brandOpt.dataset.brandOpt;
        $('input[name="brand"]', pick).value = value;
        $('[data-brand-current]', pick).textContent = value || 'Все ароматы';
        $$('.brand-opt', pick).forEach((b) => { const on = b === brandOpt; b.classList.toggle('is-selected', on); b.setAttribute('aria-selected', String(on)); });
        if (priceTool) { priceTool.brand = value; }
        closeBrandPicker(pick, true);
        return;
      }
      const peBtn = t.closest('[data-price-edit]');
      if (peBtn) {
        if (!priceEdit) { priceEdit = { edits: new Map(), picked: new Set() }; renderBody(); return; }
        const leave = () => { priceEdit = null; renderBody(); };
        if (priceEdit.edits.size) confirmButton(peBtn, 'Выйти без сохранения?', leave); else leave();
        return;
      }
      if (priceEdit && t.closest('[data-pick-all]')) { productList().forEach((p) => { if (p.type !== 'set') priceEdit.picked.add(p.id); }); renderBody(); return; }
      if (priceEdit && t.closest('[data-pick-none]')) { priceEdit.picked.clear(); renderBody(); return; }
      const cancelEdits = t.closest('[data-edits-cancel]');
      if (priceEdit && cancelEdits) { confirmButton(cancelEdits, 'Точно отменить?', () => { priceEdit.edits.clear(); renderBody(); }); return; }
      const saveBtn = t.closest('[data-edits-save]');
      if (priceEdit && saveBtn) { saveEdits(saveBtn); return; }
      if (t.closest('[data-price-open]')) { priceTool = priceTool || { brand: '', pct: '', plan: null }; renderBody(); $('#pp-pct', el).focus(); return; }
      if (t.closest('[data-price-close]')) { priceTool = null; renderBody(); return; }
      const priceApply = t.closest('[data-price-apply]');
      if (priceApply) { applyPrices(priceApply); return; }
      if (t.closest('[data-lp-reload]')) { loyaltyError = ''; loyaltyData = null; renderBody(); loadClients(); return; }
      const lpDel = t.closest('[data-lp-del]');
      if (lpDel) {
        confirmButton(lpDel, 'Точно удалить?', () => loyaltyAction({ action: 'delete', phone: lpDel.dataset.phone, id: lpDel.dataset.lpDel }).then((d) => d && toast('Покупка удалена')));
        return;
      }
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
      if (of) { orderFilter.status = of.dataset.orderFilter; orderFilter.q = ''; orderLimit = 30; renderBody(); return; }
      if (t.closest('[data-orders-more]')) { orderLimit += 30; renderBody(); return; }
      if (t.closest('[data-orders-export]')) { ordersExport = ordersExport ? null : { period: 'month', from: '', to: '' }; renderBody(); return; }
      if (t.closest('[data-orders-export-close]')) { ordersExport = null; renderBody(); return; }
      const exGo = t.closest('[data-orders-export-go]');
      if (exGo && ordersExport) { exportOrders(exGo); return; }
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
      if ((t.matches('[data-export-period]') || t.matches('[data-export-date]')) && ordersExport) {
        const f = t.form;
        ordersExport = { period: f.elements.period.value, from: f.elements.from ? f.elements.from.value : ordersExport.from, to: f.elements.to ? f.elements.to.value : ordersExport.to };
        renderBody();
        const again = $(t.matches('[data-export-period]') ? '[data-export-period]' : `[name="${t.name}"]`, el);
        if (again) again.focus();
        return;
      }
      if (t.dataset.pick && priceEdit) {
        if (t.checked) priceEdit.picked.add(t.dataset.pick); else priceEdit.picked.delete(t.dataset.pick);
        const row = t.closest('.ptable-row');
        if (row) row.classList.toggle('is-picked', t.checked);
        updatePriceBar();
        return;
      }
      if (t.dataset.orderStatus) {
        const o = FS.api.updateOrder(t.dataset.orderStatus, { status: t.value }, { error: saveFailed, saved: customerToast });
        toast(`Заказ ${o.number}: ${statusName(o.status).toLowerCase()}${o.status === 'cancelled' && !serverMode() ? ', товар вернулся на склад' : ''}`);
        rerenderOrderKeepOpen(o.number);
        return;
      }
      if (t.dataset.orderPaid) {
        const v = t.value.trim();
        const o = FS.api.updateOrder(t.dataset.orderPaid, { paidAmount: v ? Number(v) : null }, { error: saveFailed, saved: () => toast(`Заказ ${t.dataset.orderPaid}: сумма оплаты сохранена`) });
        if (!o) toast('Заказ не найден');
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

    // Список брендов: Esc закрывает, стрелки ходят по вариантам, Enter в поиске выбирает первый.
    el.addEventListener('keydown', (e) => {
      const pick = e.target.closest && e.target.closest('[data-brand-pick]');
      if (!pick || $('.brand-pick-pop', pick).hidden) return;
      const opts = $$('.brand-pick-list li:not([hidden]) .brand-opt', pick);
      const i = opts.indexOf(e.target);
      if (e.key === 'Escape') { e.preventDefault(); closeBrandPicker(pick, true); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || opts[0] || e.target).focus(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) $('[data-brand-filter]', pick).focus(); else opts[i - 1].focus(); return; }
      if (e.key === 'Enter' && e.target.matches('[data-brand-filter]')) { e.preventDefault(); if (opts[0]) opts[0].click(); }
    }, { signal });

    let timer = null;
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('[data-brand-filter]')) {
        const pick = t.closest('[data-brand-pick]');
        const q = t.value.trim().toLowerCase();
        let shown = 0;
        $$('.brand-pick-list li', pick).forEach((li) => {
          const name = li.textContent.toLowerCase();
          const ok = !q || name.includes(q);
          li.hidden = !ok;
          if (ok) shown++;
        });
        $('.brand-pick-empty', pick).hidden = shown > 0;
        return;
      }
      // «Править цены»: новая цена за 1 мл в списке.
      if (t.dataset.perml && priceEdit) {
        const p = FS.api.productSync(t.dataset.perml);
        if (!p) return;
        setEdit(p, t.value);
        const row = t.closest('.ptable-row');
        if (row) row.classList.toggle('is-edited', priceEdit.edits.has(p.id));
        const calc = $(`[data-calc="${p.id}"]`, el);
        if (calc) calc.innerHTML = calcText(p, t.value);
        updatePriceBar();
        return;
      }
      // Редактор: цена за 1 мл или объём изменились — пересчитываем цены объёмов.
      if (t.id === 'pe-perMl' || (t.matches('[data-vol-field="ml"]') && $('#pe-perMl', el))) {
        const perMl = Number($('#pe-perMl', el).value);
        $$('.vol-row', el).forEach((row) => {
          const price = $('[data-vol-field="price"]', row);
          const ml = Number($('[data-vol-field="ml"]', row).value);
          price.readOnly = perMl > 0;
          if (perMl > 0) price.value = ml > 0 ? FS.api.priceFor(perMl, ml) : '';
        });
        return;
      }
      if (t.id !== 'order-search' && t.id !== 'product-search' && t.id !== 'client-search') return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (t.id === 'order-search') { orderFilter.q = t.value; orderLimit = 30; }
        else if (t.id === 'client-search') clientQ = t.value;
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
      FS.backend.status().then(() => { if (document.contains(el)) { el.innerHTML = render(route); sync(); if (route.tab === 'data') telegram('reload'); if (route.tab === 'clients') { loadClients(); telegram('reload'); } } });
      return;
    }
    if (serverMode() && authed()) {
      sync();
      if (route.tab === 'data') telegram('reload');
      if (route.tab === 'clients' && serverInfo().storage) { loadClients(); telegram('reload'); }
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
