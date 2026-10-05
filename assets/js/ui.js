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

  /* ---------- Логотип ---------- */
  const logo = (cls) => `<span class="logo ${cls || ''}">5<span class="logo-th">th</span> SENSE</span>`;

  /* ---------- Шапка ---------- */
  function renderHeader() {
    const header = $('#site-header');
    header.innerHTML = `
      <div class="header-inner">
        <button class="icon-btn header-burger" type="button" data-action="menu" aria-label="Открыть меню" aria-expanded="false" aria-controls="site-menu">${icon.menu}</button>
        <nav class="header-nav" aria-label="Основная навигация">
          <a href="#catalog" data-nav="catalog">Каталог</a>
          <a href="#catalog-men" data-nav="catalog-men">Мужское</a>
          <a href="#catalog-women" data-nav="catalog-women">Женское</a>
          <a href="#catalog-niche" data-nav="catalog-niche">Нишевое</a>
          <a href="#catalog-gifts" data-nav="catalog-gifts">Наборы</a>
        </nav>
        <a class="header-logo" href="#home" aria-label="5th SENSE, на главную">${logo()}</a>
        <div class="header-actions">
          <button class="icon-btn" type="button" data-action="search" aria-label="Поиск">${icon.search}</button>
          <a class="icon-btn" href="#favorites" aria-label="Избранное">${icon.heart}<span class="count" data-fav-count hidden></span></a>
          <button class="icon-btn" type="button" data-action="cart" aria-label="Корзина">${icon.bag}<span class="count" data-cart-count hidden></span></button>
        </div>
      </div>`;

    const menu = $('#site-menu');
    menu.innerHTML = `
      <div class="menu-panel" role="dialog" aria-modal="true" aria-label="Меню">
        <div class="menu-head">${logo()}<button class="icon-btn" type="button" data-action="close-menu" aria-label="Закрыть меню">${icon.close}</button></div>
        <nav class="menu-links" aria-label="Разделы">
          <a href="#catalog">Весь каталог</a>
          ${FS.categories.map((c) => `<a href="#catalog-${c.id}">${esc(c.name)}</a>`).join('')}
        </nav>
        <div class="menu-foot">
          <a href="#aromaty">Исследовать ароматы</a>
          <a href="#delivery">Доставка и оплата</a>
          <a href="#favorites">Избранное</a>
          <p class="menu-contact">${esc(FS.config.contacts.phone)}<br>${esc(FS.config.contacts.hours)}</p>
        </div>
      </div>`;

    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('is-solid', y > 24 || !document.body.classList.contains('route-home'));
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    FS.ui.refreshHeader = onScroll;

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
      <div class="footer-inner">
        <div class="footer-brand">
          <a href="#home" aria-label="5th SENSE, на главную">${logo('logo--footer')}</a>
          <p>Бутик селективной и нишевой парфюмерии. Только оригинальные ароматы, консультация и бережная упаковка.</p>
        </div>
        <nav class="footer-col" aria-label="Каталог">
          <h2>Каталог</h2>
          ${FS.categories.map((cat) => `<a href="#catalog-${cat.id}">${esc(cat.name)}</a>`).join('')}
        </nav>
        <nav class="footer-col" aria-label="Покупателям">
          <h2>Покупателям</h2>
          <a href="#delivery">Доставка и оплата</a>
          <a href="#delivery">Возврат и обмен</a>
          <a href="#delivery">Подлинность</a>
          <a href="#favorites">Избранное</a>
        </nav>
        <div class="footer-col">
          <h2>Бутик</h2>
          <p class="selectable">${esc(c.phone)}</p>
          <p class="selectable">${esc(c.email)}</p>
          <p>${esc(c.address)}</p>
          <p>${esc(c.hours)}</p>
        </div>
      </div>
      <div class="footer-base">
        <span>© ${new Date().getFullYear()} 5th SENSE</span>
        <span>Premium Perfume Boutique</span>
      </div>`;
  }

  /* ---------- Карточка товара ---------- */
  function badges(p) {
    const out = [];
    if (p.isNew) out.push('<span class="badge">Новинка</span>');
    if (p.bestseller) out.push('<span class="badge badge--soft">Бестселлер</span>');
    if (!FS.api.inStock(p)) out.push('<span class="badge badge--out">Нет в наличии</span>');
    return out.join('');
  }

  function card(p, opts) {
    const o = opts || {};
    const v = FS.api.mainVolume(p);
    const fav = FS.store.isFavorite(p.id);
    const available = v.stock > 0;
    const conc = FS.concentrationLabel[p.concentration] || '';
    const meta = p.type === 'set' ? volumeLabel(v) : `${conc}, ${volumeLabel(v)}`;
    const family = FS.families.find((f) => f.id === p.family);
    return `
      <article class="pcard ${o.wide ? 'pcard--wide' : ''}" style="--i:${o.index || 0}">
        <a class="pcard-stage" href="#product-${p.id}" tabindex="-1" aria-hidden="true">
          <span class="sheet-meta"><span>${esc(family ? family.name.toLowerCase() : '')}</span><span>${esc(volumeLabel(v))}</span></span>
          <span class="pcard-bottle">${FS.bottle.media(p, { style: 'blueprint' })}</span>
        </a>
        <div class="pcard-badges">${badges(p)}</div>
        <button class="fav-btn ${fav ? 'is-on' : ''}" type="button" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${fav ? 'Убрать из избранного' : 'В избранное'}: ${esc(p.name)}">${icon.heart}</button>
        <div class="pcard-body">
          <p class="pcard-brand">${esc(p.brand)}</p>
          <h3 class="pcard-name"><a href="#product-${p.id}">${esc(p.name)}</a></h3>
          <p class="pcard-desc">${esc(p.short)}</p>
          <div class="pcard-price">
            <span class="price">${money(v.price)}</span>
            <span class="pcard-meta">${esc(meta)}</span>
          </div>
          <div class="pcard-actions">
            <button class="btn btn--primary btn--sm" type="button" data-add="${p.id}" data-ml="${v.ml}" ${available ? '' : 'disabled'}>${available ? 'В корзину' : 'Нет в наличии'}</button>
            <a class="btn btn--outline btn--sm" href="#product-${p.id}">Подробнее</a>
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
          <h2 id="cart-title">Корзина${count ? ` <span class="drawer-count">${count}</span>` : ''}</h2>
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
    $, $$, esc, money, plural, icon, logo, volumeLabel,
    renderHeader, renderFooter, setActiveNav, card, stepper, toast,
    open, close, openCart, renderCart, bind, pulse,
    setStructuredData, productSchema,
    refreshHeader: () => {}
  };
})();
