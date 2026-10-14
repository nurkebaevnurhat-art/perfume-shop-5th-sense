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
  let wrong = false; // неверный PIN: точки вздрагивают
  let shown = ''; // экран, показанный в прошлый раз (анимация появления — только при входе на экран)
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
  const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11v12H9l-6-6z"/><path d="m12.5 9.5 5 5m0-5-5 5"/></svg>';
  const ENTER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5"/></svg>';

  function pinScreen() {
    const ready = pin.length >= 4 && !busy;
    const key = (k) => `<button type="button" class="ks-key" data-pin-key="${k}">${k}</button>`;
    return `
      <div class="ks-pin ${wrong ? 'is-wrong' : ''} ${shown !== 'pin' ? 'is-enter' : ''}">
        <img class="ks-pin-logo" src="${FS.assetUrl('assets/img/logo-intro.png')}" alt="5th SENSE" width="520" height="962" decoding="async">
        <p class="ks-pin-kicker">Касса бутика</p>
        <h2 class="ks-pin-title">Введите PIN-код</h2>
        <div class="ks-dots" role="status" aria-label="Введено цифр: ${pin.length}">${Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<span class="${i < pin.length ? 'is-on' : ''}"></span>`).join('')}</div>
        <p class="ks-error ks-pin-error" role="alert">${esc(error)}</p>
        <div class="ks-keypad">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key).join('')}
          <button type="button" class="ks-key ks-key--icon" data-pin-key="⌫" aria-label="Стереть" ${pin ? '' : 'disabled'}>${BACK}</button>
          ${key('0')}
          <button type="button" class="ks-key ks-key--go" data-pin-go aria-label="Войти" ${ready ? '' : 'disabled'}>${busy ? '<span class="ks-spin" aria-hidden="true"></span>' : ENTER}</button>
        </div>
        <p class="ks-pin-foot">Один PIN-код для владельца и сотрудников. Задаётся в админке: «Клиенты» → «Касса».</p>
      </div>`;
  }

  // Ввод цифр: обновляем только точки и кнопки, без перерисовки экрана (логотип не мигает).
  function updatePin() {
    const box = root && root.querySelector('.ks-pin');
    if (!box) { draw(); return; }
    const dots = box.querySelector('.ks-dots');
    dots.innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<span class="${i < pin.length ? 'is-on' : ''}"></span>`).join('');
    dots.setAttribute('aria-label', `Введено цифр: ${pin.length}`);
    box.querySelector('.ks-error').textContent = error;
    box.querySelector('[data-pin-key="⌫"]').disabled = !pin;
    box.querySelector('[data-pin-go]').disabled = !(pin.length >= 4 && !busy);
  }

  function status(c) {
    if (!c.count) return 'Новый клиент: это первая покупка.';
    if (c.nextIsGift) return `${c.count} ${plural(c.count, 'покупка', 'покупки', 'покупок')}. <b>Эта покупка — с подарком${c.gift ? `: ${esc(c.gift)}` : ''}</b>`;
    return `${c.count} ${plural(c.count, 'покупка', 'покупки', 'покупок')} · подарок — на ${c.count + c.left + 1}-й`;
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
          ${c.count ? '<button type="button" class="link-btn ks-card-link" data-show-card>Карта клиента: QR-код и отправка</button>' : ''}
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
          : `<p class="ks-status">${n}. ${c.nextIsGift ? '<b>Следующая — с подарком!</b>' : `Подарок — на ${c.count + c.left + 1}-й покупке.`}</p>`}
        ${d.cardToken ? shareBlock(c, cardUrl(d.cardToken), purchaseText(c, d.cardToken, d.giftNow)) : ''}
        <p class="ks-error" role="alert">${esc(error)}</p>
        <button class="btn btn--primary ks-wide" type="button" data-next>Следующий клиент</button>
        <button class="link-btn ks-undo" type="button" data-undo ${busy ? 'disabled' : ''}>Отменить эту запись</button>
      </div>`;
  }

  /* ---------- Карта клиента: QR-код на экране, WhatsApp и SMS ---------- */
  const cardUrl = (t) => `${location.origin}${location.pathname}#card-${t}`;
  const firstName = (c) => (c.name || '').trim().split(/\s+/)[0];
  function purchaseText(c, token, giftNow) {
    const n = `${c.count}-я покупка`;
    const line = giftNow ? `Это ваша ${n} — она с подарком 🎁` : c.nextIsGift ? `Это ваша ${n} — следующая будет с подарком 🎁` : `Это ваша ${n}. Подарок — на ${c.count + c.left + 1}-й покупке 🎁`;
    return `${firstName(c) ? `${firstName(c)}, с` : 'С'}пасибо за покупку в 5th SENSE! ${line} Ваша карта клиента: ${cardUrl(token)}`;
  }
  const cardText = (c, token) => `${firstName(c) ? `${firstName(c)}, в` : 'В'}аша карта клиента 5th SENSE: ${cardUrl(token)} — там видно, сколько покупок осталось до подарка 🎁`;
  // Кнопки отправки: номер клиента уже известен. SMS: «?&body=» понимают и iPhone, и Android.
  function shareLinks(c, text) {
    const t = encodeURIComponent(text);
    return `<div class="ks-share-btns">
        <a class="btn btn--outline btn--sm" href="https://wa.me/${c.phone}?text=${t}" target="_blank" rel="noopener">Отправить в WhatsApp</a>
        <a class="btn btn--outline btn--sm" href="sms:+${c.phone}?&body=${t}">Отправить SMS</a>
      </div>`;
  }
  function shareBlock(c, url, text) {
    return `<div class="ks-share">
        <p class="ks-share-title">Карта клиента</p>
        <div class="ks-qr-code ks-share-qr" data-card-qr="${esc(url)}">QR-код…</div>
        <p class="ks-hint">Клиент наводит камеру своего телефона на код — откроется его карта: сколько покупок и когда подарок. Или отправьте ссылку:</p>
        ${shareLinks(c, text)}
      </div>`;
  }
  function fillCardQr() {
    const box = root && root.querySelector('[data-card-qr]');
    if (box) FS.qr.svg(box.dataset.cardQr, 'QR-код: карта клиента').then((svg) => { box.innerHTML = svg; }, (err) => { box.textContent = err.message; });
  }
  // С карточки клиента (без покупки): получить ссылку и показать QR и отправку.
  async function showCard() {
    try {
      const data = await api('POST', '/api/kassa', { action: 'card', phone: client.phone });
      showQr({ kicker: `Карта клиента · ${client.name || client.pretty}`, url: cardUrl(data.cardToken), label: 'QR-код: карта клиента',
        text: 'Клиент наводит камеру своего телефона на код — откроется его карта. Или отправьте ссылку:', extra: shareLinks(client, cardText(client, data.cardToken)) });
    } catch (err) { failed(err); }
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
    shown = FS.backend.usable ? screen : '';
    if (screen === 'done') fillCardQr();
    const stage = root.querySelector('[data-stage]');
    const isPin = screen === 'pin' && FS.backend.usable;
    if (stage) { stage.classList.toggle('is-pin', isPin); stage.dataset.head = isPin ? 'dark' : 'light'; }
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
      wrong = err.status === 401;
      failed(err);
      if (wrong) setTimeout(() => { wrong = false; const el = root && root.querySelector('.ks-pin'); if (el) el.classList.remove('is-wrong'); }, 600);
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
      done = { amount: data.purchase.amount, id: data.purchase.id, client: data.client, giftNow: data.giftNow, giftName: data.giftName, cardToken: data.cardToken };
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

  /* Внутри установленного приложения 5th SENSE нет меню браузера, и кассу не установить.
     На Android ссылка intent:// открывает её в Chrome, на iPhone — подсказка про Safari. */
  function browserLink() {
    if (!FS.pwa || !FS.pwa.standalone()) return '';
    const url = `${location.origin}${location.pathname}?app=kassa`;
    if (/android/i.test(navigator.userAgent)) {
      const intent = `intent://${location.host}${location.pathname}?app=kassa#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
      return `<a class="btn btn--primary btn--sm ks-browser" href="${esc(intent)}">Открыть в Chrome</a>
        <p class="ks-browser-note">Чтобы поставить кассу отдельным значком, откройте её в Chrome и там нажмите ⋮ → «Добавить на главный экран».</p>`;
    }
    return `<button class="btn btn--primary btn--sm ks-browser" type="button" data-copy-kassa>Скопировать адрес кассы</button>
      <p class="ks-browser-note">Откройте Safari, вставьте адрес в строку сверху, затем «Поделиться» → «На экран „Домой“». Или наведите камеру другого телефона на QR-код.</p>`;
  }

  const kassaUrl = () => `${location.origin}${location.pathname}#kassa`;

  // QR-код кассы на весь экран: навести камеру другого телефона.
  async function showQr(opts) {
    const o = opts || { kicker: 'Касса 5th SENSE', url: kassaUrl(), label: 'QR-код: адрес кассы',
      text: 'Наведите камеру телефона на код — касса откроется в браузере. Затем «Поделиться» → «На экран „Домой“» (iPhone) или ⋮ → «Добавить на главный экран» (Android).' };
    const layer = document.createElement('div');
    layer.className = 'ks-qr-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', o.label);
    layer.innerHTML = `<div class="ks-qr-card"><p class="ks-pin-kicker">${esc(o.kicker)}</p><div class="ks-qr-code" data-qr>Загружаем…</div>
      <p class="ks-qr-text">${esc(o.text)}</p>${o.extra || ''}
      <button class="btn btn--outline btn--sm" type="button" data-qr-close>Закрыть</button></div>`;
    document.body.appendChild(layer);
    const close = () => { layer.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    layer.addEventListener('click', (e) => { if (e.target === layer || e.target.closest('[data-qr-close]')) close(); });
    layer.querySelector('[data-qr-close]').focus();
    try { layer.querySelector('[data-qr]').innerHTML = await FS.qr.svg(o.url, o.label); }
    catch (err) { layer.querySelector('[data-qr]').textContent = err.message; }
  }

  return {
    title: () => 'Касса',
    render() {
      reset();
      return `
        <div class="ks-stage" data-stage data-head="dark">
          <section class="ks-top" data-head="dark">
            <div class="ks-top-inner">
              <h1 class="ks-title">Касса</h1>
              <p class="ks-sub">Запись покупок из бутика — они сразу считаются в подарках за покупки.</p>
              <div class="ks-head-actions">
                <button class="install-btn ks-install" type="button" data-action="install">Установить кассу как приложение</button>
                ${browserLink()}
                <button class="link-btn ks-link" type="button" data-show-qr>QR-код для другого телефона</button>
                <button class="link-btn ks-link ks-out" type="button" data-kassa-out hidden>Выйти</button>
              </div>
            </div>
          </section>
          <div class="kassa" data-kassa></div>
        </div>`;
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
          updatePin();
          return;
        }
        if (t.closest('[data-pin-go]')) { login(); return; }
        if (t.closest('[data-show-qr]')) { showQr(); return; }
        if (t.closest('[data-show-card]')) { showCard(); return; }
        if (t.closest('[data-copy-kassa]')) {
          const done = () => FS.ui.toast('Адрес кассы скопирован. Откройте Safari и вставьте его в строку адреса.', null, { duration: 8000 });
          if (navigator.clipboard) navigator.clipboard.writeText(kassaUrl()).then(done, () => window.prompt('Скопируйте адрес кассы', kassaUrl()));
          else window.prompt('Скопируйте адрес кассы', kassaUrl());
          return;
        }
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
        if (/^\d$/.test(e.key)) { pin = (pin + e.key).slice(0, 8); error = ''; updatePin(); }
        else if (e.key === 'Backspace') { pin = pin.slice(0, -1); updatePin(); }
        else if (e.key === 'Enter') login();
      }, { signal });
    },
    unmount() { clearTimeout(timer); root = null; }
  };
})();
