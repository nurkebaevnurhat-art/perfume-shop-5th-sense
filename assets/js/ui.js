/* 5th SENSE — общие компоненты интерфейса. */
window.FS = window.FS || {};

FS.ui = (function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const money = (n) => (n == null ? 'по запросу' : Number(n).toLocaleString(FS.config.locale).replace(/,/g, ' ') + ' ' + FS.config.currency);

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  const volumeLabel = (v) => v.label || v.ml + ' мл';

  const icon = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>',
    filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>'
  };

  /* ---------- Знаки бренда ---------- */
  const logo = (cls) => `<span class="logo ${cls || ''}"><span class="logo-word">5<span class="logo-th">th</span> SENSE</span><span class="logo-sub">Perfume Bar</span></span>`;

  // Гигантский логотип; data-fit растягивает его на всю ширину контейнера.
  const wordmark = (cls) => `<span class="wordmark ${cls || ''}" data-fit aria-hidden="true"><span class="wm-5">5</span><span class="wm-th">th</span><span class="wm-gap"> </span>SENSE</span>`;

  // Подпись под логотипом: PERFUME BAR между двумя тонкими линиями, как на логотипе.
  const brandLine = (cls) => `<span class="brand-line ${cls || ''}" aria-hidden="true"><i></i>${FS.config.tagline}<i></i></span>`;
  const est = () => `Est. ${FS.config.founded}`;

  // Эмблема по логотипу: двойная рамка-капсула, массивная 5, под ней TH, звёзды и боковые точки.
  const emblem = (cls) => `<svg class="emblem ${cls || ''}" viewBox="0 0 48 76" aria-hidden="true" focusable="false">
      <rect class="em-frame" x="2" y="2" width="44" height="72" rx="22"/>
      <rect class="em-frame em-frame--in" x="5.5" y="5.5" width="37" height="65" rx="18.5"/>
      <circle class="em-dot" cx="2" cy="42" r="2"/><circle class="em-dot" cx="46" cy="42" r="2"/>
      <path class="em-star" d="M24 9.5l1 3.5 3.5 1-3.5 1-1 3.5-1-3.5-3.5-1 3.5-1z"/>
      <text class="em-5" x="24" y="49" text-anchor="middle">5</text>
      <text class="em-th" x="24" y="59.5" text-anchor="middle">TH</text>
      <path class="em-star" d="M24 62l.8 2.6 2.6.8-2.6.8-.8 2.6-.8-2.6-2.6-.8 2.6-.8z"/>
    </svg>`;

  // Светлый тон фона для товара: цвет жидкости, сильно разбавленный тёплым камнем.
  function hexMix(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = p(a); const y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const tint = (p, amount) => {
    const liquid = (p.bottle && /^#[0-9a-f]{6}$/i.test(p.bottle.liquid)) ? p.bottle.liquid : '#b59a7a';
    return hexMix(liquid, '#ece6db', amount == null ? 0.9 : amount);
  };

  /* ---------- Шапка и меню ---------- */
  function renderHeader() {
    const header = $('#site-header');
    header.innerHTML = `
      <div class="header-inner">
        <div class="header-left">
          <button class="hl hl--menu" type="button" data-action="menu" aria-expanded="false" aria-controls="site-menu">Меню</button>
          <a class="hl hl--wide" href="#catalog" data-nav="catalog">Коллекция</a>
        </div>
        <a class="header-mark" href="#home" aria-label="5th SENSE, на главную"><span class="header-word">${logo()}</span></a>
        <div class="header-right">
          <button class="hl hl--wide" type="button" data-action="search">Поиск</button>
          <a class="hl hl--wide" href="#favorites">Избранное<span class="hl-count" data-fav-count hidden></span></a>
          <button class="hl" type="button" data-action="cart">Корзина<span class="hl-count" data-cart-count hidden></span></button>
        </div>
      </div>`;

    const menuItems = [{ href: '#catalog', name: 'Вся коллекция', id: null }].concat(FS.categories.map((c) => ({ href: `#catalog-${c.id}`, name: c.name, id: c.id })));
    const preview = (item) => {
      const list = item.id ? FS.products.filter(FS.categories.find((c) => c.id === item.id).match) : FS.products;
      const p = list.find((x) => x.image) || list[0];
      return p ? `<span class="menu-shot" style="--tint:${tint(p)}">${FS.bottle.media(p, { title: '' })}</span>` : '';
    };
    $('#site-menu').innerHTML = `
      <div class="menu-panel" role="dialog" aria-modal="true" aria-label="Меню">
        <div class="menu-top">
          <span class="menu-note">5th SENSE · ${FS.config.tagline}<span class="menu-note-est"> · ${est()}</span></span>
          <button class="hl" type="button" data-action="close-menu" data-autofocus>Закрыть</button>
        </div>
        <div class="menu-grid">
          <nav class="menu-links" aria-label="Разделы">
            ${menuItems.map((m, i) => `<a href="${m.href}" style="--i:${i}" data-menu-shot="${i}"><span class="menu-num">${String(i + 1).padStart(2, '0')}</span><span class="menu-name">${esc(m.name)}</span></a>`).join('')}
          </nav>
          <div class="menu-shots" aria-hidden="true">${menuItems.map((m, i) => `<span class="menu-shot-wrap ${i === 0 ? 'is-on' : ''}" data-shot="${i}">${preview(m)}</span>`).join('')}</div>
        </div>
        <div class="menu-foot">
          <button type="button" data-action="search">Поиск</button>
          <a href="#aromaty">Исследовать ароматы</a>
          <a href="#favorites">Избранное</a>
          <a href="#delivery">Доставка и оплата</a>
          <a href="#admin">Вход для сотрудников</a>
          <span class="selectable">${esc(FS.config.contacts.phone)}</span>
        </div>
      </div>`;
    $('#site-menu').addEventListener('pointerover', (e) => {
      const a = e.target.closest('[data-menu-shot]');
      if (!a) return;
      $$('.menu-shot-wrap').forEach((s) => s.classList.toggle('is-on', s.dataset.shot === a.dataset.menuShot));
    });

    FS.ui.refreshHeader = () => FS.motion.refresh();
    updateCounts();
    FS.store.subscribe(updateCounts);
  }

  function updateCounts() {
    const c = FS.store.count();
    const f = FS.store.favorites().length;
    $$('[data-cart-count]').forEach((el) => { el.hidden = !c; el.textContent = c; });
    $$('[data-fav-count]').forEach((el) => { el.hidden = !f; el.textContent = f; });
  }

  function setActiveNav(route) {
    $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === route));
  }

  /* ---------- Подвал ---------- */
  function renderFooter() {
    const c = FS.config.contacts;
    $('#site-footer').innerHTML = `
      <div class="footer-top">
        <div class="footer-col">
          <h2>Контакты</h2>
          <p class="selectable">${esc(c.phone)}</p>
          <p class="selectable">${esc(c.email)}</p>
          <p>${esc(c.hours)}</p>
        </div>
        <div class="footer-col">
          <h2>Соцсети</h2>
          <p class="selectable">${esc(c.instagram)}</p>
          <p>${esc(c.address)}</p>
        </div>
        <nav class="footer-col" aria-label="Коллекция">
          <h2>Коллекция</h2>
          ${FS.categories.map((cat) => `<a href="#catalog-${cat.id}">${esc(cat.name)}</a>`).join('')}
        </nav>
        <nav class="footer-col" aria-label="Покупателям">
          <h2>Покупателям</h2>
          <a href="#delivery">Доставка и оплата</a>
          <a href="#delivery">Возврат и обмен</a>
          <a href="#favorites">Избранное</a>
          <a href="#admin">Вход для сотрудников</a>
        </nav>
      </div>
      <a class="footer-mark" href="#home" aria-label="5th SENSE, на главную">${wordmark()}</a>
      ${brandLine('footer-sub')}
      <p class="footer-est">${est()}</p>`;
  }

  /* ---------- Карточка товара ---------- */
  function badges(p) {
    const out = [];
    if (p.isNew) out.push('<span class="tag-chip">Новинка</span>');
    if (p.bestseller) out.push('<span class="tag-chip tag-chip--brand">Бестселлер</span>');
    if (!FS.api.inStock(p)) out.push('<span class="tag-chip tag-chip--out">Нет в наличии</span>');
    return out.join('');
  }

  function card(p, opts) {
    const o = opts || {};
    const v = FS.api.mainVolume(p);
    const fav = FS.store.isFavorite(p.id);
    const available = v.stock > 0;
    const conc = FS.concentrationLabel[p.concentration] || '';
    const meta = p.type === 'set' ? volumeLabel(v) : `${conc}, ${volumeLabel(v)}`;
    return `
      <article class="pcard ${o.wide ? 'pcard--wide' : ''} ${o.reveal === false ? '' : 'reveal'}" style="--i:${o.index || 0};--tint:${tint(p)}">
        <a class="pcard-media" href="#product-${p.id}" tabindex="-1" aria-hidden="true" data-cursor="Смотреть">
          <span class="pcard-img">${FS.bottle.media(p)}</span>
          <span class="pcard-tags">${badges(p)}</span>
        </a>
        <button class="fav-btn ${fav ? 'is-on' : ''}" type="button" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${fav ? 'Убрать из избранного' : 'В избранное'}: ${esc(p.name)}">${icon.heart}</button>
        <div class="pcard-body">
          <p class="pcard-brand">${esc(p.brand)}</p>
          <h3 class="pcard-name"><a href="#product-${p.id}">${esc(p.name)}</a></h3>
          <p class="pcard-desc">${esc(p.short)}</p>
          <p class="pcard-meta">${esc(meta)}</p>
          <div class="pcard-price">
            <span class="price">${money(v.price)}</span>
            <div class="pcard-actions">
              <button class="line-link" type="button" data-add="${p.id}" data-ml="${v.ml}" ${available ? '' : 'disabled'}>${available ? 'В корзину' : 'Нет в наличии'}</button>
              <a class="line-link line-link--soft" href="#product-${p.id}">Смотреть</a>
            </div>
          </div>
        </div>
      </article>`;
  }

  /* ---------- Уведомления ---------- */
  function toast(message, action) {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ''}`;
    if (action) $('.toast-action', el).addEventListener('click', () => { action.run(); dismiss(); });
    host.appendChild(el);
    // Не больше двух уведомлений одновременно.
    const all = host.querySelectorAll('.toast');
    if (all.length > 2) all[0].remove();
    requestAnimationFrame(() => el.classList.add('is-in'));
    const timer = setTimeout(dismiss, 3600);
    function dismiss() {
      clearTimeout(timer);
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 500);
    }
  }

  /* ---------- Слои: меню, корзина, поиск ---------- */
  let openLayer = null;
  let returnFocus = null;

  function open(id) {
    close(true);
    const layer = $('#' + id);
    returnFocus = document.activeElement;
    layer.hidden = false;
    document.body.classList.add('has-layer');
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('is-open')));
    openLayer = layer;
    if (id === 'site-menu') $('[data-action="menu"]').setAttribute('aria-expanded', 'true');
    const focusTarget = $('[data-autofocus]', layer) || $('button, a, input', layer);
    setTimeout(() => focusTarget && focusTarget.focus({ preventScroll: true }), 60);
  }

  function close(immediate) {
    if (!openLayer) return;
    const layer = openLayer;
    openLayer = null;
    layer.classList.remove('is-open');
    document.body.classList.remove('has-layer');
    const burger = $('[data-action="menu"]');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    const hide = () => { if (!layer.classList.contains('is-open')) layer.hidden = true; };
    if (immediate) hide(); else setTimeout(hide, 520);
    if (returnFocus && document.contains(returnFocus) && !immediate) returnFocus.focus({ preventScroll: true });
  }

  /* ---------- Корзина ---------- */
  function renderCart() {
    const drawer = $('#cart-drawer');
    const lines = FS.store.lines();
    const subtotal = FS.store.subtotal();
    const freeFrom = FS.config.freeShippingFrom;
    const left = Math.max(0, freeFrom - subtotal);
    const progress = Math.min(100, (subtotal / freeFrom) * 100);
    const count = FS.store.count();

    const body = lines.length ? `
      <div class="cart-ship">
        <p>${left ? `До бесплатной доставки курьером: <strong>${money(left)}</strong>` : 'Доставка курьером по городу бесплатна'}</p>
        <div class="cart-ship-bar"><span style="width:${progress}%"></span></div>
      </div>
      <ul class="cart-lines">
        ${lines.map((l) => `
          <li class="cart-line">
            <a class="cart-thumb" href="#product-${l.product.id}" tabindex="-1" aria-hidden="true">${FS.bottle.media(l.product)}</a>
            <div class="cart-info">
              <p class="cart-brand">${esc(l.product.brand)}</p>
              <a class="cart-name" href="#product-${l.product.id}">${esc(l.product.name)}</a>
              <p class="cart-vol">${esc(volumeLabel(l.volume))}, ${money(l.volume.price)} за шт.</p>
              <div class="cart-row">
                ${stepper(l.qty, FS.store.maxQty(l.product.id, l.ml), `data-line="${l.product.id}" data-ml="${l.ml}"`, l.product.name)}
                <span class="cart-total">${money(l.total)}</span>
              </div>
              <button class="link-btn" type="button" data-remove="${l.product.id}" data-ml="${l.ml}">Удалить</button>
            </div>
          </li>`).join('')}
      </ul>` : `
      <div class="cart-empty">
        <p class="cart-empty-title">В корзине пока пусто</p>
        <p>Выберите аромат на витринах бутика или загляните в бестселлеры.</p>
        <a class="btn btn--primary" href="#catalog" data-action="close-cart">Перейти в каталог</a>
      </div>`;

    drawer.innerHTML = `
      <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div class="drawer-head">
          <h2 id="cart-title">Корзина${count ? ` <span class="drawer-count">(${count})</span>` : ''}</h2>
          <button class="icon-btn" type="button" data-action="close-cart" aria-label="Закрыть корзину">${icon.close}</button>
        </div>
        <div class="drawer-body">${body}</div>
        ${lines.length ? `
        <div class="drawer-foot">
          <div class="sum-row"><span>Товары</span><span>${money(subtotal)}</span></div>
          <p class="drawer-note">Стоимость доставки рассчитается при оформлении.</p>
          <a class="btn btn--primary btn--block" href="#checkout" data-action="close-cart" data-autofocus>Оформить заказ</a>
          <button class="btn btn--outline btn--block" type="button" data-action="close-cart">Продолжить покупки</button>
        </div>` : ''}
      </div>`;
  }

  function stepper(value, max, attrs, name) {
    return `<div class="stepper" ${attrs}>
      <button type="button" data-step="-1" aria-label="Уменьшить количество${name ? ': ' + esc(name) : ''}" ${value <= 1 ? 'disabled' : ''}>${icon.minus}</button>
      <output aria-live="polite">${value}</output>
      <button type="button" data-step="1" aria-label="Увеличить количество${name ? ': ' + esc(name) : ''}" ${value >= max ? 'disabled' : ''}>${icon.plus}</button>
    </div>`;
  }

  function openCart() {
    renderCart();
    open('cart-drawer');
  }

  /* ---------- Поиск ---------- */
  function renderSearch() {
    $('#search-layer').innerHTML = `
      <div class="search-panel" role="dialog" aria-modal="true" aria-label="Поиск по каталогу">
        <form class="search-form" role="search" data-search-form>
          <label class="visually-hidden" for="search-input">Название, бренд или нота</label>
          ${icon.search}
          <input id="search-input" type="search" placeholder="Название, бренд или нота" autocomplete="off" data-autofocus>
          <button class="icon-btn" type="button" data-action="close-search" aria-label="Закрыть поиск">${icon.close}</button>
        </form>
        <div class="search-results" data-search-results aria-live="polite"></div>
      </div>`;
    const input = $('#search-input');
    input.addEventListener('input', () => updateSearch(input.value));
    $('[data-search-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      close(true);
      FS.app.go('catalog', { q });
    });
    updateSearch('');
  }

  function updateSearch(q) {
    const host = $('[data-search-results]');
    const query = q.trim();
    if (!query) {
      host.innerHTML = `<p class="search-hint">Часто ищут</p>
        <div class="search-tags">${['уд', 'роза', 'ваниль', 'Tom Ford', 'сандал', 'Creed'].map((t) => `<button type="button" class="chip" data-search-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
      return;
    }
    const found = FS.api.filter({ q: query });
    if (!found.length) {
      host.innerHTML = `<p class="search-empty">По запросу «${esc(query)}» ничего не нашлось. Попробуйте бренд, название или ноту, например «жасмин».</p>`;
      return;
    }
    host.innerHTML = `<ul class="search-list">${found.slice(0, 6).map((p) => `
      <li><a href="#product-${p.id}" class="search-item">
        <span class="search-thumb">${FS.bottle.media(p)}</span>
        <span><span class="search-brand">${esc(p.brand)}</span><span class="search-name">${esc(p.name)}</span></span>
        <span class="search-price">${money(FS.api.mainVolume(p).price)}</span>
      </a></li>`).join('')}</ul>
      <button class="btn btn--outline btn--block" type="button" data-search-all>Все результаты: ${found.length}</button>`;
  }

  /* ---------- Структурированные данные (schema.org) ---------- */
  function setStructuredData(data) {
    let el = $('#ld-page');
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = 'ld-page';
      document.head.appendChild(el);
    }
    el.textContent = data ? JSON.stringify(data) : '';
  }

  function productSchema(p) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      sku: p.id,
      name: p.name,
      brand: { '@type': 'Brand', name: p.brand },
      description: p.description,
      category: FS.genderLabel[p.gender] + ' парфюм',
      offers: p.volumes.map((v) => ({
        '@type': 'Offer',
        sku: `${p.id}-${v.ml}`,
        name: `${p.name}, ${volumeLabel(v)}`,
        price: v.price,
        priceCurrency: 'KZT',
        availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
      }))
    };
  }

  /* ---------- Глобальные обработчики ---------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action], [data-add], [data-fav], [data-remove], [data-step], [data-search-tag], [data-search-all]');
      if (!t) return;

      if (t.dataset.searchTag) {
        const input = $('#search-input');
        input.value = t.dataset.searchTag;
        updateSearch(input.value);
        input.focus();
        return;
      }
      if (t.hasAttribute('data-search-all')) {
        e.preventDefault();
        const q = $('#search-input').value.trim();
        close(true);
        FS.app.go('catalog', { q });
        return;
      }
      if (t.dataset.add) {
        const p = FS.api.productSync(t.dataset.add);
        const added = FS.store.add(t.dataset.add, Number(t.dataset.ml), 1);
        if (added) {
          pulse(t);
          toast(`${p.name} в корзине`, { label: 'Открыть', run: openCart });
        } else {
          toast('Больше нет на складе: в корзине уже весь остаток');
        }
        return;
      }
      if (t.dataset.fav) {
        const on = FS.store.toggleFavorite(t.dataset.fav);
        $$(`[data-fav="${t.dataset.fav}"]`).forEach((b) => {
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', String(on));
        });
        toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
        return;
      }
      if (t.dataset.remove) {
        const p = FS.api.productSync(t.dataset.remove);
        const ml = Number(t.dataset.ml);
        const line = FS.store.lines().find((l) => l.id === p.id && l.ml === ml);
        FS.store.remove(p.id, ml);
        toast(`${p.name} удалён из корзины`, { label: 'Вернуть', run: () => FS.store.add(p.id, ml, line ? line.qty : 1) });
        return;
      }
      if (t.dataset.step) {
        const box = t.closest('.stepper');
        if (box && box.dataset.line) {
          const line = FS.store.lines().find((l) => l.id === box.dataset.line && l.ml === Number(box.dataset.ml));
          if (line) FS.store.setQty(line.id, line.ml, line.qty + Number(t.dataset.step));
        }
        return;
      }
      switch (t.dataset.action) {
        case 'menu': open('site-menu'); break;
        case 'close-menu': close(); break;
        case 'cart': openCart(); break;
        case 'close-cart':
          if (t.tagName !== 'A') e.preventDefault();
          close(t.tagName === 'A');
          break;
        case 'search': renderSearch(); open('search-layer'); break;
        case 'close-search': close(); break;
        default: break;
      }
    });

    // Переход по ссылке внутри меню или поиска закрывает слой.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a && openLayer && openLayer.contains(a)) close(true);
    });

    // Клик по затемнению закрывает слой.
    $$('.layer').forEach((layer) => layer.addEventListener('click', (e) => { if (e.target === layer) close(); }));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openLayer) close();
      if (e.key === 'Tab' && openLayer) trapFocus(e);
    });

    FS.store.subscribe((kind) => {
      if (kind === 'cart' && openLayer && openLayer.id === 'cart-drawer') {
        const focusedStep = document.activeElement && document.activeElement.closest('.stepper');
        const key = focusedStep ? `${focusedStep.dataset.line}|${focusedStep.dataset.ml}|${document.activeElement.dataset.step}` : null;
        renderCart();
        if (key) {
          const [id, ml, step] = key.split('|');
          const btn = $(`.stepper[data-line="${id}"][data-ml="${ml}"] [data-step="${step}"]`);
          if (btn && !btn.disabled) btn.focus();
          else { const out = $(`.stepper[data-line="${id}"][data-ml="${ml}"] output`); if (out) out.parentElement.querySelector('button:not([disabled])')?.focus(); }
        } else {
          const panel = $('.drawer-panel');
          if (panel && !panel.contains(document.activeElement)) $('[data-action="close-cart"]', panel)?.focus();
        }
      }
    });
  }

  function trapFocus(e) {
    const focusables = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea', openLayer).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function pulse(el) {
    el.classList.remove('is-pulse');
    void el.offsetWidth;
    el.classList.add('is-pulse');
  }

  return {
    $, $$, esc, money, plural, icon, logo, wordmark, brandLine, est, emblem, tint, hexMix, volumeLabel,
    renderHeader, renderFooter, setActiveNav, card, stepper, toast,
    open, close, openCart, renderCart, bind, pulse,
    setStructuredData, productSchema,
    refreshHeader: () => {}
  };
})();
