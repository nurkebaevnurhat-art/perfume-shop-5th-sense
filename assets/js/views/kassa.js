/* 5th SENSE — «Касса»: быстрая запись покупок из бутика (#kassa).
   Один общий PIN-код для владельца и сотрудников. Нашли клиента по телефону
   или имени → вписали сумму → «Записать». Покупка сразу идёт в подарки за
   покупки, в Telegram приходит уведомление. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.kassa = (function () {
  const TOKEN_KEY = 'fs.kassa.token';
  let root = null;
  let screen = 'search'; // pin | search | client | done
  let pin = '';
  let query = '';
  let results = [];
  let client = null; // карточка с сервера
  let isNew = false;
  let done = null; // результат записи
  let form = { name: '', amount: '', note: '' }; // введённое в карточке (не теряется при перерисовке)
  let busy = false;
  let error = '';
  let timer = null;
  let seq = 0;

  const esc = (s) => FS.ui.esc(s);
  const money = (n) => FS.ui.money(n);
  const token = () => FS.storage.get(TOKEN_KEY, '');
  const plural = (n, a, b, c) => FS.ui.plural(n, a, b, c);
  const digits = (s) => String(s || '').replace(/\D/g, '');
  // Номер так же, как на сервере: 8 701… → 7701…
  const phoneKey = (s) => {
    let d = digits(s);
    if (d.length === 10) d = '7' + d;
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    return d.length === 11 ? d : '';
  };
  const pretty = (k) => `+${k[0]} ${k.slice(1, 4)} ${k.slice(4, 7)} ${k.slice(7, 9)} ${k.slice(9)}`;

  function api(method, path, body) {
    return FS.backend.call(method, path, body, { key: token() || FS.backend.adminKey() || '' });
  }

  function failed(err) {
    if (err.status === 401) { FS.storage.remove(TOKEN_KEY); screen = 'pin'; pin = ''; }
    error = err.message;
    busy = false;
    draw();
  }

  /* ---------- Экраны ---------- */
  function pinScreen() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    return `
      <div class="ks-pin">
        <p class="ks-lead">Введите PIN-код кассы</p>
        <div class="ks-dots" aria-label="Введено цифр: ${pin.length}">${Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<span class="${i < pin.length ? 'is-on' : ''}"></span>`).join('')}</div>
        <p class="ks-error" role="alert">${esc(error)}</p>
        <div class="ks-keypad">${keys.map((k) => (k ? `<button type="button" class="ks-key" data-pin-key="${k}" aria-label="${k === '⌫' ? 'Стереть' : k}">${k}</button>` : '<span></span>')).join('')}</div>
        <button class="btn btn--primary ks-wide" type="button" data-pin-go ${pin.length >= 4 && !busy ? '' : 'disabled'}>${busy ? 'Проверяем…' : 'Войти'}</button>
      </div>`;
  }

  function status(c) {
    if (!c.count) return 'Новый клиент: это первая покупка.';
    if (c.nextIsGift) return `${c.count} ${plural(c.count, 'покупка', 'покупки', 'покупок')}. <b>Эта покупка — с подарком${c.gift ? `: ${esc(c.gift)}` : ''}</b>`;
    return `${c.count} ${plural(c.count, 'покупка', 'покупки', 'покупок')} · до подарка ещё ${c.left}`;
  }

  function resultRow(c) {
    return `<li><button type="button" class="ks-result" data-pick="${c.phone}">
        <span class="ks-result-name">${esc(c.name || 'Без имени')}</span>
        <span class="ks-result-phone">${esc(c.pretty)}</span>
        <span class="ks-result-meta">${c.nextIsGift ? '🎁 следующая — с подарком' : `${c.count} ${plural(c.count, 'покупка', 'покупки', 'покупок')}`}</span>
      </button></li>`;
  }

  function searchScreen() {
    const key = phoneKey(query);
    const known = results.some((c) => c.phone === key);
    return `
      <div class="ks-search">
        <label class="ks-label" for="ks-q">Телефон или имя клиента</label>
        <input class="ks-input" id="ks-q" type="search" inputmode="search" autocomplete="off" placeholder="8 701 123 45 67 или Айгерим" value="${esc(query)}" data-q>
        <p class="ks-hint">Можно ввести последние 4 цифры номера.</p>
        <p class="ks-error" role="alert">${esc(error)}</p>
        ${key && !known ? `<button type="button" class="ks-result ks-result--new" data-pick="${key}"><span class="ks-result-name">Новый клиент</span><span class="ks-result-phone">${pretty(key)}</span><span class="ks-result-meta">записать первую покупку →</span></button>` : ''}
        ${results.length ? `<ul class="ks-results">${results.map(resultRow).join('')}</ul>` : (query.trim() && !key && (digits(query).length >= 3 || query.trim().length >= 2) ? '<p class="ks-hint">Не нашли. Для нового клиента введите номер полностью.</p>' : '')}
      </div>`;
  }

  function clientScreen() {
    const c = client;
    return `
      <form class="ks-client" data-buy novalidate>
        <button type="button" class="link-btn ks-back" data-back>← Другой клиент</button>
        <div class="ks-card ${c.nextIsGift ? 'is-gift' : ''}">
          ${isNew || !c.name
            ? `<label class="ks-label" for="ks-name">Имя клиента</label><input class="ks-input" id="ks-name" name="name" type="text" autocomplete="off" placeholder="Например, Айгерим" value="${esc(form.name || c.name)}">`
            : `<p class="ks-name">${esc(c.name)} <button type="button" class="link-btn" data-rename>Изменить имя</button></p>`}
          <p class="ks-phone">${esc(c.pretty)}</p>
          <p class="ks-status">${status(c)}</p>
          ${c.recent.length ? `<ul class="ks-recent">${c.recent.map((p) => `<li>${new Date(p.date).toLocaleDateString('ru-RU')}${p.amount !== null ? ` — ${money(p.amount)}` : ''}${p.note ? ` · ${esc(p.note)}` : ''}</li>`).join('')}</ul>` : ''}
        </div>
        <label class="ks-label" for="ks-amount">Сумма покупки, ${esc(FS.config.currency)}</label>
        <input class="ks-input ks-amount" id="ks-amount" name="amount" type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="${esc(form.amount)}">
        <label class="ks-label" for="ks-note">Что купили <span class="optional">необязательно</span></label>
        <input class="ks-input" id="ks-note" name="note" type="text" autocomplete="off" placeholder="Например, Baccarat 10 мл" value="${esc(form.note)}">
        <p class="ks-error" role="alert">${esc(error)}</p>
        <button class="btn btn--primary ks-wide" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Записываем…' : 'Записать покупку'}</button>
      </form>`;
  }

  function doneScreen() {
    const d = done;
    const c = d.client;
    const n = `${c.count}-я покупка`;
    return `
      <div class="ks-done">
        <p class="ks-check" aria-hidden="true">✓</p>
        <p class="ks-done-title">Записано: ${money(d.amount)}</p>
        <p class="ks-done-who">${esc(c.name || 'Без имени')} · ${esc(c.pretty)}</p>
        ${d.giftNow
          ? `<p class="ks-gift">🎁 ${n} — положен подарок${d.giftName ? `: <b>${esc(d.giftName)}</b>` : '. Уточните у владельца.'}</p>`
          : `<p class="ks-status">${n}. ${c.nextIsGift ? '<b>Следующая — с подарком!</b>' : `До подарка ещё ${c.left}.`}</p>`}
        <p class="ks-error" role="alert">${esc(error)}</p>
        <button class="btn btn--primary ks-wide" type="button" data-next>Следующий клиент</button>
        <button class="link-btn ks-undo" type="button" data-undo ${busy ? 'disabled' : ''}>Отменить эту запись</button>
      </div>`;
  }

  function body() {
    if (!FS.backend.usable) {
      return '<p class="panel-empty">Касса работает на сайте с подключённым сервером (Vercel и хранилище). В этой копии сайта сервера нет.</p>';
    }
    if (screen === 'pin') return pinScreen();
    if (screen === 'client' && client) return clientScreen();
    if (screen === 'done' && done) return doneScreen();
    return searchScreen();
  }

  function draw() {
    if (!root) return;
    const box = root.querySelector('[data-kassa]');
    if (!box) return;
    box.innerHTML = body();
    const out = root.querySelector('[data-kassa-out]');
    if (out) out.hidden = screen === 'pin' || !FS.backend.usable;
    const focus = screen === 'search' ? '#ks-q' : screen === 'client' ? (client && (isNew || !client.name) && !form.name.trim() ? '#ks-name' : '#ks-amount') : null;
    if (focus) {
      const el = box.querySelector(focus);
      if (el) { el.focus(); if (el.value && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); }
    }
  }

  /* ---------- Действия ---------- */
  async function login() {
    if (pin.length < 4 || busy) return;
    busy = true; error = ''; draw();
    try {
      const data = await FS.backend.call('POST', '/api/kassa', { action: 'login', pin });
      FS.storage.set(TOKEN_KEY, data.token);
      busy = false; pin = ''; screen = 'search'; draw();
    } catch (err) {
      pin = '';
      failed(err);
    }
  }

  function search() {
    clearTimeout(timer);
    const q = query.trim();
    const d = digits(q);
    if (d.length < 3 && q.length < 2) { results = []; draw(); return; }
    timer = setTimeout(async () => {
      const my = ++seq;
      try {
        const data = await api('GET', `/api/kassa?q=${encodeURIComponent(q)}`);
        if (my !== seq) return;
        results = data.clients || [];
        error = '';
        draw();
      } catch (err) { failed(err); }
    }, 250);
  }

  async function pick(phone) {
    busy = true; error = '';
    try {
      const data = await api('GET', `/api/kassa?phone=${encodeURIComponent(phone)}`);
      client = data.client;
      isNew = !data.known;
      form = { name: '', amount: '', note: '' };
      screen = 'client';
    } catch (err) { failed(err); return; }
    busy = false;
    draw();
  }

  async function buy(form) {
    const amount = Number(digits(form.elements.amount.value));
    const name = form.elements.name ? form.elements.name.value.trim() : '';
    error = '';
    if (form.elements.name && !name) { error = 'Впишите имя клиента'; draw(); return; }
    if (!(amount > 0)) { error = 'Впишите сумму покупки'; draw(); root.querySelector('#ks-amount').focus(); return; }
    busy = true; draw();
    try {
      const data = await api('POST', '/api/kassa', { action: 'buy', phone: client.phone, name, amount, note: form.elements.note.value.trim() });
      done = { amount: data.purchase.amount, id: data.purchase.id, client: data.client, giftNow: data.giftNow, giftName: data.giftName };
      screen = 'done';
    } catch (err) { failed(err); return; }
    busy = false;
    draw();
  }

  async function undo() {
    busy = true; error = ''; draw();
    try {
      const data = await api('POST', '/api/kassa', { action: 'undo', phone: done.client.phone, id: done.id });
      client = data.client;
      isNew = false;
      done = null;
      form = { name: '', amount: '', note: '' };
      screen = 'client';
      FS.ui.toast('Запись отменена');
    } catch (err) { failed(err); return; }
    busy = false;
    draw();
  }

  async function rename() {
    const name = window.prompt('Имя клиента', client.name || '');
    if (name === null || !name.trim()) return;
    try {
      const data = await api('POST', '/api/kassa', { action: 'name', phone: client.phone, name: name.trim() });
      client = data.client;
      draw();
    } catch (err) { failed(err); }
  }

  function reset() {
    screen = token() || FS.backend.adminKey() ? 'search' : 'pin';
    query = ''; results = []; client = null; done = null; error = ''; busy = false; pin = '';
    form = { name: '', amount: '', note: '' };
  }

  return {
    title: () => 'Касса',
    render() {
      reset();
      return `
        <section class="page-head ks-head">
          <h1>Касса</h1>
          <p class="page-lead">Запись покупок из бутика. Покупки сразу считаются в подарках за покупки.</p>
          <button class="link-btn ks-out" type="button" data-kassa-out hidden>Выйти</button>
        </section>
        <div class="kassa" data-kassa></div>`;
    },
    mount(el, route, params, signal) {
      root = el;
      FS.backend.status().then(() => { if (document.contains(el)) { if (!FS.backend.usable) screen = 'search'; draw(); } });
      draw();
      el.addEventListener('click', (e) => {
        const t = e.target;
        const k = t.closest('[data-pin-key]');
        if (k) {
          const v = k.dataset.pinKey;
          pin = v === '⌫' ? pin.slice(0, -1) : (pin + v).slice(0, 8);
          error = '';
          draw();
          return;
        }
        if (t.closest('[data-pin-go]')) { login(); return; }
        const p = t.closest('[data-pick]');
        if (p) { pick(p.dataset.pick); return; }
        if (t.closest('[data-back]') || t.closest('[data-next]')) { const keep = screen === 'client' ? query : ''; reset(); query = keep; draw(); if (keep) search(); return; }
        if (t.closest('[data-undo]')) { undo(); return; }
        if (t.closest('[data-rename]')) { rename(); return; }
        if (t.closest('[data-kassa-out]')) { FS.storage.remove(TOKEN_KEY); reset(); screen = 'pin'; draw(); }
      }, { signal });
      el.addEventListener('input', (e) => {
        const t = e.target;
        if (t.matches('[data-q]')) { query = t.value; error = ''; const key = phoneKey(query); search(); if (key || !query.trim()) draw(); return; }
        if (t.id === 'ks-amount') {
          const d = digits(t.value).slice(0, 9);
          t.value = d ? Number(d).toLocaleString('ru-RU').replace(/\u00a0/g, ' ') : '';
          form.amount = t.value;
        }
        if (t.id === 'ks-name') form.name = t.value;
        if (error && (t.id === 'ks-name' || t.id === 'ks-amount')) { error = ''; const out = el.querySelector('.ks-error'); if (out) out.textContent = ''; }
        if (t.id === 'ks-note') form.note = t.value;
      }, { signal });
      el.addEventListener('submit', (e) => {
        if (e.target.matches('[data-buy]')) { e.preventDefault(); buy(e.target); }
      }, { signal });
      // PIN с клавиатуры компьютера.
      document.addEventListener('keydown', (e) => {
        if (screen !== 'pin' || !document.contains(el)) return;
        if (/^\d$/.test(e.key)) { pin = (pin + e.key).slice(0, 8); error = ''; draw(); }
        else if (e.key === 'Backspace') { pin = pin.slice(0, -1); draw(); }
        else if (e.key === 'Enter') login();
      }, { signal });
    },
    unmount() { clearTimeout(timer); root = null; }
  };
})();
