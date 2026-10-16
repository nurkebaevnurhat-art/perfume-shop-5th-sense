/* 5th SENSE — страница аромата. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.product = (function () {
  const { $, $$, esc, money, card, icon, stepper, volumeLabel, tint } = FS.ui;

  let product = null;
  let selected = null;
  let qty = 1;
  let root = null;

  // Один вид: фото флакона целиком, без фото — объёмная иллюстрация.
  // Миниатюры появляются, только если видов больше одного (например, при добавлении фото упаковки).
  function views() {
    return product.image ? [{ id: 'photo', label: 'Флакон' }] : [{ id: 'bottle', label: 'Флакон' }];
  }

  function art(view, large) {
    const title = large ? `${product.brand} ${product.name}` : '';
    if (view === 'detail' && !product.image) return FS.bottle.render(product, { view: 'detail', title });
    if (view === 'bottle') return FS.bottle.render(product, { title });
    return FS.bottle.media(product, { title });
  }

  function scale(value, labels) {
    return `<div class="scale" role="img" aria-label="${value} из 5: ${labels[value - 1]}">
      ${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= value ? 'is-on' : ''}"></span>`).join('')}
      <em>${labels[value - 1]}</em>
    </div>`;
  }

  function stockText(v) {
    if (v.full) return { cls: 'is-in', text: FS.config.fullBottle.note };
    if (v.stock <= 0) return { cls: 'is-out', text: 'Нет в наличии. Оставьте заявку по телефону, и мы сообщим о поступлении.' };
    if (v.stock <= 2) return { cls: 'is-low', text: `Осталось ${v.stock} шт.` };
    return null; // в наличии — без лишней строки
  }

  function stage(view) {
    return `<div class="stage stage--${view}" data-zoom>
      <div class="stage-media">${art(view, true)}</div>
    </div>`;
  }

  function buyBox() {
    const v = selected;
    const s = stockText(v);
    const max = FS.store.maxQty(product.id, v.ml);
    qty = Math.max(1, Math.min(qty, max || 1));
    return `
      <div class="buy-price">
        <span class="price price--lg">${v.full ? 'Цена по запросу' : money(v.price)}</span>
        <span class="buy-vol">${esc(volumeLabel(v))}${v.full && v.fullMl ? `, ${v.fullMl} мл` : ''}</span>
      </div>
      ${product.hidden ? `<p class="stock is-out"><span class="stock-dot" aria-hidden="true"></span>Сейчас не продаётся. Уточните у менеджера: ${FS.ui.managerLinks('text-link')}</p>` : s ? `<p class="stock ${s.cls}"><span class="stock-dot" aria-hidden="true"></span>${s.text}</p>` : ''}
      <div class="buy-row">
        ${stepper(qty, max, 'data-qty', product.name)}
        <button class="fav-btn fav-btn--inline ${FS.store.isFavorite(product.id) ? 'is-on' : ''}" type="button" data-fav="${product.id}" aria-pressed="${FS.store.isFavorite(product.id)}" aria-label="В избранное: ${esc(product.name)}">${icon.heart}</button>
      </div>
      <div class="buy-actions">
        <button class="buy-main" type="button" data-buy="add" ${v.stock > 0 && !product.hidden ? '' : 'disabled'}>Добавить в корзину</button>
        <button class="line-link line-link--lg line-link--gold" type="button" data-buy="now" ${v.stock > 0 && !product.hidden ? '' : 'disabled'}>${v.full ? 'Заказать флакон' : 'Купить сейчас'}</button>
      </div>
      ${v.full ? `<p class="buy-note">Менеджер свяжется с вами, подтвердит цену и срок поставки. Вопросы: ${FS.ui.managerLinks('text-link')}</p>` : ''}`;
  }

  // Телефон: цена и кнопка закреплены внизу экрана, пока основной блок покупки не виден.
  function stickyBar() {
    const v = selected;
    const off = !(v.stock > 0) || product.hidden;
    return `<div class="pd-sticky-info"><span class="pd-sticky-price">${v.full ? 'Цена по запросу' : money(v.price)}</span><span class="pd-sticky-vol">${esc(volumeLabel(v))}</span></div>
      <button class="buy-main buy-main--sm" type="button" data-buy="${v.full ? 'now' : 'add'}" ${off ? 'disabled' : ''}>${v.full ? 'Заказать флакон' : 'В корзину'}</button>`;
  }

  function render(route) {
    product = FS.api.productSync(route.id);
    if (!product) return FS.views.notfound.render();
    selected = FS.api.mainVolume(product);
    qty = 1;
    const fam = FS.families.find((f) => f.id === product.family);
    const related = FS.api.related(product, 4);
    const conc = FS.concentrationLabel[product.concentration];

    FS.ui.setStructuredData(FS.ui.productSchema(product));

    const specs = [
      ['Семейство', `<a href="#family-${fam.id}">${esc(fam.name)}</a>`],
      ['Для кого', esc(FS.genderLabel[product.gender])],
      ['Концентрация', esc(conc)],
      product.year ? ['Год', product.year] : null,
      product.perfumer ? ['Парфюмер', esc(product.perfumer)] : null,
      product.country ? ['Страна', esc(product.country)] : null
    ].filter(Boolean);

    const category = FS.categories.find((c) => c.id === product.gender);
    const tier = (cls, name, notes, when) => `
      <div class="tier reveal ${cls}">
        <p class="tier-when">${when}</p>
        <h3>${name}</h3>
        <p class="tier-notes">${esc(notes.join(', '))}</p>
      </div>`;

    return `
      <article class="pd" style="--tint:${tint(product)}">
        <div class="pd-top" data-head="light">
          <div class="pd-gallery">
            <div class="pd-stage" data-gallery-main data-cursor="Ближе">${stage(views()[0].id)}</div>
            ${views().length > 1 ? `<div class="pd-thumbs" role="tablist" aria-label="Изображения">
              ${views().map((v, i) => `
                <button class="thumb ${i === 0 ? 'is-active' : ''}" type="button" role="tab" aria-selected="${i === 0}" data-view="${v.id}">
                  <span class="thumb-art thumb-art--${v.id}">${art(v.id, false)}</span>
                  <span class="thumb-label">${v.label}</span>
                </button>`).join('')}
            </div>` : ''}
          </div>

          <div class="pd-info">
            <nav class="crumbs" aria-label="Навигационная цепочка">
              <a href="#home">Главная</a><span aria-hidden="true">/</span>
              <a href="#catalog">Коллекция</a><span aria-hidden="true">/</span>
              <a href="#catalog-${category.id}">${esc(category.name)}</a>
            </nav>
            <a class="pd-brand" href="#brand-${FS.api.brandSlug(product.brand)}">${esc(product.brand)}</a>
            <h1 class="pd-name">${esc(product.name)}</h1>
            <p class="pd-sub">${esc(conc)}, ${esc(FS.genderLabel[product.gender].toLowerCase())}, ${esc(fam.name.toLowerCase())}</p>
            <p class="pd-lead">${esc(product.short)}</p>

            <fieldset class="volumes">
              <legend>Объём на распив</legend>
              <p class="volumes-note">Парфюмерия на распив от ${Math.min(...product.volumes.map((v) => v.ml))} мл: разливаем из оригинального флакона.</p>
              <div class="volume-list">
                ${FS.api.variants(product).map((v) => `
                  <label class="volume ${v.stock <= 0 ? 'is-out' : ''} ${v.full ? 'volume--full' : ''}">
                    <input type="radio" name="volume" value="${v.ml}" ${v.ml === selected.ml ? 'checked' : ''}>
                    <span class="volume-ml">${esc(volumeLabel(v))}</span>
                    <span class="volume-price">${v.full ? 'цена по запросу' : money(v.price)}</span>
                  </label>`).join('')}
              </div>
            </fieldset>

            <div class="buy" data-buy-box>${buyBox()}</div>
            <div class="pd-sticky" data-pd-sticky aria-label="Купить: ${esc(product.name)}">${stickyBar()}</div>

            <ul class="perks">
              <li>Доставка курьером по городу в день заказа</li>
              <li><a class="text-link" href="#gifts">Каждая ${FS.config.gifts.every}-я покупка — с подарком</a></li>
              <li>Фирменная упаковка бутика</li>
            </ul>
          </div>
        </div>

        <section class="pd-notes" data-head="dark" aria-labelledby="pyramid-title">
          <p class="kicker reveal">Пирамида аромата</p>
          <h2 id="pyramid-title" class="pd-notes-title reveal">Как раскрывается ${esc(product.name)}</h2>
          <div class="tiers">
            ${tier('tier--top', 'Верхние ноты', product.notes.top, 'первые 15 минут')}
            ${tier('tier--heart', 'Ноты сердца', product.notes.heart, 'от 30 минут до 3 часов')}
            ${tier('tier--base', 'Базовые ноты', product.notes.base, 'шлейф, который остаётся')}
          </div>
        </section>

        <section class="pd-about" data-head="light" aria-labelledby="story-title">
          <div class="pd-about-text">
            <p class="kicker reveal">Об аромате</p>
            <h2 id="story-title" class="visually-hidden">Об аромате</h2>
            <p class="pd-desc reveal">${esc(product.description)}</p>
          </div>
          <dl class="specs reveal">
            ${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
            <div><dt>Категория</dt><dd><a href="#catalog-${category.id}">${esc(category.name)}</a></dd></div>
            <div><dt>Стойкость</dt><dd>${scale(product.longevity, ['до 2 часов', '3–4 часа', '5–6 часов', '7–9 часов', 'более 10 часов'])}</dd></div>
            <div><dt>Шлейф</dt><dd>${scale(product.sillage, ['близкий к коже', 'лёгкий', 'умеренный', 'заметный', 'очень сильный'])}</dd></div>
          </dl>
        </section>

        <section class="pd-pairs" data-head="light" aria-labelledby="pairs-title">
          <div class="pd-pairs-head">
            <h2 id="pairs-title" class="reveal">С чем сочетается этот аромат</h2>
            <p class="reveal">Ароматы с похожими нотами и характером. Их можно носить по очереди или собрать в гардероб ароматов.</p>
          </div>
          <div class="shelf-grid shelf-grid--four">${related.map((p, i) => card(p, { index: i })).join('')}</div>
        </section>
      </article>`;
  }

  function refreshBuy() {
    $('[data-buy-box]', root).innerHTML = buyBox();
    const bar = $('[data-pd-sticky]', root);
    if (bar) bar.innerHTML = stickyBar();
  }

  function mount(el, route, params, signal) {
    root = el;
    if (!product) return;
    requestAnimationFrame(() => requestAnimationFrame(() => $('.pd', root).classList.add('is-in')));

    $$('input[name="volume"]', root).forEach((input) => input.addEventListener('change', () => {
      selected = FS.api.variant(product, input.value);
      refreshBuy();
    }));

    // Полоска «цена — В корзину» появляется, когда основной блок покупки ушёл с экрана.
    const bar = $('[data-pd-sticky]', root);
    if (bar && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => bar.classList.toggle('is-on', !entry.isIntersecting), { rootMargin: '0px 0px -40px 0px' });
      io.observe($('[data-buy-box]', root));
      signal.addEventListener('abort', () => io.disconnect());
    }

    root.addEventListener('click', (e) => {
      const thumb = e.target.closest('[data-view]');
      if (thumb) {
        $$('.thumb', root).forEach((t) => { t.classList.toggle('is-active', t === thumb); t.setAttribute('aria-selected', String(t === thumb)); });
        const main = $('[data-gallery-main]', root);
        main.classList.add('is-swapping');
        setTimeout(() => { main.innerHTML = stage(thumb.dataset.view); main.classList.remove('is-swapping'); }, 260);
        return;
      }
      const step = e.target.closest('[data-qty] [data-step]');
      if (step) {
        qty += Number(step.dataset.step);
        refreshBuy();
        const again = $(`[data-qty] [data-step="${step.dataset.step}"]`, root);
        if (again && !again.disabled) again.focus();
        else $('[data-qty] button:not([disabled])', root)?.focus();
        return;
      }
      const buy = e.target.closest('[data-buy]');
      if (buy) {
        const added = FS.store.add(product.id, selected.ml, qty);
        if (!added) {
          FS.ui.toast('Больше нет на складе: в корзине уже весь остаток');
          if (buy.dataset.buy === 'now' && FS.store.count()) FS.app.go('checkout');
          return;
        }
        if (buy.dataset.buy === 'now') { FS.app.go('checkout'); return; }
        FS.ui.pulse(buy);
        FS.ui.toast(`${product.name}, ${volumeLabel(selected)} в корзине`, { label: 'Открыть', run: FS.ui.openCart });
        qty = 1;
        refreshBuy();
      }
    }, { signal });

    // Плавное увеличение флакона за курсором.
    const main = $('[data-gallery-main]', root);
    main.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const zoom = main.querySelector('[data-zoom]');
      if (!zoom) return;
      const r = zoom.getBoundingClientRect();
      zoom.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
      zoom.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
      zoom.classList.add('is-zoom');
    });
    main.addEventListener('pointerleave', () => {
      const zoom = main.querySelector('[data-zoom]');
      if (zoom) zoom.classList.remove('is-zoom');
    });
  }

  return { render, mount, title: (route) => { const p = FS.api.productSync(route.id); return p ? `${p.name}, ${p.brand}` : 'Аромат не найден'; } };
})();
