/* 5th SENSE — страница аромата. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.product = (function () {
  const { $, $$, esc, money, card, icon, stepper, volumeLabel } = FS.ui;

  let product = null;
  let selected = null;
  let qty = 1;
  let root = null;

  // С фото: фото, чертёж, силуэт. Без фото: чертёж, объёмный флакон, силуэт.
  function views() {
    return product.image
      ? [{ id: 'photo', label: 'Фото' }, { id: 'blueprint', label: 'Чертёж' }, { id: 'ink', label: 'Силуэт' }]
      : [{ id: 'blueprint', label: 'Чертёж' }, { id: 'bottle', label: 'Флакон' }, { id: 'ink', label: 'Силуэт' }];
  }

  function art(view, large) {
    const title = large ? `${product.brand} ${product.name}` : '';
    if (view === 'ink') return FS.bottle.silhouette(product);
    if (view === 'photo') return FS.bottle.media(product, { title });
    if (view === 'bottle') return FS.bottle.render(product, { title });
    return FS.bottle.blueprint(product, { annotate: large, title });
  }

  function scale(value, labels) {
    return `<div class="scale" role="img" aria-label="${value} из 5: ${labels[value - 1]}">
      ${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= value ? 'is-on' : ''}"></span>`).join('')}
      <em>${labels[value - 1]}</em>
    </div>`;
  }

  function stockText(v) {
    if (v.stock <= 0) return { cls: 'is-out', text: 'Нет в наличии. Оставьте заявку по телефону, и мы сообщим о поступлении.' };
    if (v.stock <= 2) return { cls: 'is-low', text: `В наличии, осталось ${v.stock} шт.` };
    return { cls: 'is-in', text: 'В наличии в бутике и на складе' };
  }

  function stage(view) {
    const fam = FS.families.find((f) => f.id === product.family);
    return `<div class="stage stage--${view}" data-zoom>
      ${view === 'blueprint' ? `<span class="stage-meta stage-meta--tl">${esc(product.brand.toLowerCase())}<br>${esc(product.name.toLowerCase())}</span>
      <span class="stage-meta stage-meta--tr">${esc(fam.name.toLowerCase())}<br>${product.year || ''}</span>` : ''}
      ${view === 'ink' ? `<span class="stage-word" aria-hidden="true">${esc(product.name)}</span>` : ''}
      <div class="stage-media ${view === 'ink' ? 'rough' : ''}">${art(view, true)}</div>
    </div>`;
  }

  function buyBox() {
    const v = selected;
    const s = stockText(v);
    const max = FS.store.maxQty(product.id, v.ml);
    qty = Math.max(1, Math.min(qty, max || 1));
    return `
      <div class="buy-price">
        <span class="price price--lg">${money(v.price)}</span>
        <span class="buy-vol">${esc(volumeLabel(v))}</span>
      </div>
      <p class="stock ${s.cls}"><span class="stock-dot" aria-hidden="true"></span>${s.text}</p>
      <div class="buy-row">
        ${stepper(qty, max, 'data-qty', product.name)}
        <button class="btn btn--primary btn--grow" type="button" data-buy="add" ${v.stock > 0 ? '' : 'disabled'}>Добавить в корзину</button>
        <button class="fav-btn fav-btn--inline ${FS.store.isFavorite(product.id) ? 'is-on' : ''}" type="button" data-fav="${product.id}" aria-pressed="${FS.store.isFavorite(product.id)}" aria-label="В избранное: ${esc(product.name)}">${icon.heart}</button>
      </div>
      <button class="btn btn--outline btn--block" type="button" data-buy="now" ${v.stock > 0 ? '' : 'disabled'}>Купить сейчас</button>`;
  }

  function render(route) {
    product = FS.api.productSync(route.id);
    if (!product) return FS.views.notfound.render();
    selected = FS.api.mainVolume(product);
    qty = 1;
    const fam = FS.families.find((f) => f.id === product.family);
    const isSet = product.type === 'set';
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

    return `
      <div class="product">
        <nav class="crumbs" aria-label="Навигационная цепочка">
          <a href="#home">Главная</a><span aria-hidden="true">/</span>
          <a href="#catalog">Каталог</a><span aria-hidden="true">/</span>
          <a href="#catalog-${isSet ? 'gifts' : product.gender}">${esc(isSet ? 'Подарочные наборы' : FS.categories.find((c) => c.id === product.gender).name)}</a><span aria-hidden="true">/</span>
          <span aria-current="page">${esc(product.name)}</span>
        </nav>

        <div class="product-top">
          <div class="gallery">
            <div class="gallery-main" data-gallery-main>${stage(views()[0].id)}</div>
            <div class="gallery-thumbs" role="tablist" aria-label="Изображения">
              ${views().map((v, i) => `
                <button class="thumb ${i === 0 ? 'is-active' : ''}" type="button" role="tab" aria-selected="${i === 0}" data-view="${v.id}">
                  <span class="thumb-art thumb-art--${v.id}">${art(v.id, false)}</span>
                  <span class="thumb-label">${v.label}</span>
                </button>`).join('')}
            </div>
          </div>

          <div class="product-info">
            <a class="product-brand" href="#catalog">${esc(product.brand)}</a>
            <h1 class="product-name">${esc(product.name)}</h1>
            <p class="product-sub">${esc(conc)}, ${esc(FS.genderLabel[product.gender].toLowerCase())}, ${esc(fam.name.toLowerCase())}</p>
            <p class="product-lead">${esc(product.short)}</p>

            <fieldset class="volumes">
              <legend>Объём</legend>
              <div class="volume-list">
                ${product.volumes.map((v) => `
                  <label class="volume ${v.stock <= 0 ? 'is-out' : ''}">
                    <input type="radio" name="volume" value="${v.ml}" ${v.ml === selected.ml ? 'checked' : ''}>
                    <span class="volume-ml">${esc(volumeLabel(v))}</span>
                    <span class="volume-price">${money(v.price)}</span>
                  </label>`).join('')}
              </div>
            </fieldset>

            <div class="buy" data-buy-box>${buyBox()}</div>

            <ul class="perks">
              <li>Бесплатная доставка курьером от ${money(FS.config.freeShippingFrom)}</li>
              <li>Пробник в подарок к каждому заказу</li>
              <li>Фирменная упаковка бутика</li>
            </ul>
          </div>
        </div>

        <section class="product-story" aria-labelledby="story-title">
          <div class="story-text">
            <h2 id="story-title">Об аромате</h2>
            <p>${esc(product.description)}</p>
            <dl class="specs">
              ${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
              <div><dt>Стойкость</dt><dd>${scale(product.longevity, ['до 2 часов', '3–4 часа', '5–6 часов', '7–9 часов', 'более 10 часов'])}</dd></div>
              <div><dt>Шлейф</dt><dd>${scale(product.sillage, ['близкий к коже', 'лёгкий', 'умеренный', 'заметный', 'очень сильный'])}</dd></div>
            </dl>
          </div>

          <div class="pyramid" aria-labelledby="pyramid-title">
            <h2 id="pyramid-title">Пирамида аромата</h2>
            <div class="pyramid-tier pyramid-tier--top">
              <h3>Верхние ноты</h3>
              <p>${esc(product.notes.top.join(', '))}</p>
              <span>первые 15 минут</span>
            </div>
            <div class="pyramid-tier pyramid-tier--heart">
              <h3>Ноты сердца</h3>
              <p>${esc(product.notes.heart.join(', '))}</p>
              <span>от 30 минут до 3 часов</span>
            </div>
            <div class="pyramid-tier pyramid-tier--base">
              <h3>Базовые ноты</h3>
              <p>${esc(product.notes.base.join(', '))}</p>
              <span>шлейф, который остаётся</span>
            </div>
          </div>
        </section>

        <section class="section pairs-section" aria-labelledby="pairs-title">
          <div class="section-head">
            <h2 id="pairs-title">С чем сочетается этот аромат</h2>
            <p>Ароматы с похожими нотами и характером. Их можно носить по очереди или собрать в гардероб ароматов.</p>
          </div>
          <div class="shelf-grid">${related.map((p, i) => card(p, { index: i })).join('')}</div>
        </section>
      </div>`;
  }

  function refreshBuy() {
    $('[data-buy-box]', root).innerHTML = buyBox();
  }

  function mount(el, route, params, signal) {
    root = el;
    if (!product) return;

    $$('input[name="volume"]', root).forEach((input) => input.addEventListener('change', () => {
      selected = product.volumes.find((v) => v.ml === Number(input.value));
      refreshBuy();
    }));

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
