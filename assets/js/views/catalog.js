/* 5th SENSE — каталог: поиск, фильтры, сортировка. Также избранное. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.catalog = (function () {
  const { $, $$, esc, plural, card, icon } = FS.ui;

  const SORTS = [
    ['popular', 'Сначала популярные'],
    ['new', 'Сначала новинки'],
    ['price-asc', 'Сначала дешевле'],
    ['price-desc', 'Сначала дороже'],
    ['name', 'По названию']
  ];

  let state = null;
  let root = null;
  // Большой каталог показываем порциями, чтобы страница не тормозила на телефоне.
  const PAGE = 24;
  let shown = PAGE;

  function freshState(route, params) {
    return {
      category: route.category || null,
      // Страница бренда (#brand-…): фильтр по бренду задан адресом.
      brand: route.brand || null,
      brandMissing: Boolean(route.brandMissing),
      families: route.family ? [route.family] : [],
      brands: route.brand ? [route.brand] : [],
      genders: [],
      priceMin: null,
      priceMax: null,
      inStock: false,
      q: (params && params.q) || '',
      sort: 'popular'
    };
  }

  // Бренд страницы бренда — не фильтр покупателя: не считаем его в «Фильтры (N)».
  const userBrands = () => state.brands.filter((b) => b !== state.brand).length;

  function heading() {
    if (state.brandMissing) return { title: 'Бренд не найден', lead: 'Возможно, его уже нет в каталоге. Посмотрите все бренды бутика.' };
    if (state.brand) {
      const n = FS.api.filter({ brands: [state.brand] }).length;
      return { title: state.brand, lead: `${n} ${plural(n, 'аромат', 'аромата', 'ароматов')} бренда в бутике 5th SENSE.` };
    }
    const cat = FS.categories.find((c) => c.id === state.category);
    if (cat) return { title: cat.name, lead: cat.lead };
    if (state.families.length === 1) {
      const f = FS.families.find((x) => x.id === state.families[0]);
      return { title: `${f.name} ароматы`, lead: `Семейство с нотами: ${f.notes}.` };
    }
    return { title: 'Каталог ароматов', lead: 'Все ароматы бутика. Ищите по бренду, названию или ноте — например, «сандал».' };
  }

  function checkboxGroup(name, legend, options, selected) {
    return `<fieldset class="filter-group">
      <legend>${legend}</legend>
      <div class="filter-options">
        ${options.map(([value, label, count]) => `
          <label class="check">
            <input type="checkbox" name="${name}" value="${esc(value)}" ${selected.includes(value) ? 'checked' : ''}>
            <span class="check-box" aria-hidden="true"></span>
            <span class="check-label">${esc(label)}</span>
            <span class="check-count">${count}</span>
          </label>`).join('')}
      </div>
    </fieldset>`;
  }

  function filtersMarkup() {
    const inCategory = FS.api.filter({ category: state.category });
    const countBy = (fn) => (v) => inCategory.filter((p) => fn(p) === v).length;
    const families = FS.families.map((f) => [f.id, f.name, countBy((p) => p.family)(f.id)]).filter((x) => x[2] > 0);
    const brands = FS.api.brands().map((b) => [b, b, countBy((p) => p.brand)(b)]).filter((x) => x[2] > 0);
    const genderCat = ['men', 'women', 'unisex'].includes(state.category);
    const genders = genderCat ? [] : Object.entries(FS.genderLabel).map(([k, v]) => [k, v, countBy((p) => p.gender)(k)]).filter((x) => x[2] > 0);
    return `
      <div class="filters-head">
        <h2>Фильтры</h2>
        <button class="icon-btn filters-close" type="button" data-filters-toggle aria-label="Закрыть фильтры">${icon.close}</button>
      </div>
      ${checkboxGroup('families', 'Семейство', families, state.families)}
      ${genders.length ? checkboxGroup('genders', 'Для кого', genders, state.genders) : ''}
      <fieldset class="filter-group">
        <legend>Цена, ${esc(FS.config.currency)}</legend>
        <div class="price-range">
          <label><span class="visually-hidden">Цена от</span><input id="price-min" type="number" inputmode="numeric" min="0" step="1000" placeholder="от" value="${state.priceMin || ''}" name="priceMin"></label>
          <span aria-hidden="true">–</span>
          <label><span class="visually-hidden">Цена до</span><input id="price-max" type="number" inputmode="numeric" min="0" step="1000" placeholder="до" value="${state.priceMax || ''}" name="priceMax"></label>
        </div>
      </fieldset>
      ${state.brand ? '' : brands.length > 12
    ? checkboxGroup('brands', 'Бренд', brands, state.brands).replace('<div class="filter-options">', `<label class="brand-search"><span class="visually-hidden">Найти бренд</span><input type="search" placeholder="Найти бренд" data-brand-search autocomplete="off"></label><div class="filter-options filter-options--scroll">`)
    : checkboxGroup('brands', 'Бренд', brands, state.brands)}
      <label class="check check--switch">
        <input type="checkbox" name="inStock" ${state.inStock ? 'checked' : ''}>
        <span class="check-box" aria-hidden="true"></span>
        <span class="check-label">Только в наличии</span>
      </label>
      <button class="line-link filters-reset" type="button" data-reset>Сбросить фильтры</button>
      <button class="line-link line-link--lg filters-apply" type="button" data-filters-toggle>Показать ароматы</button>`;
  }

  function activeChips() {
    const chips = [];
    if (state.q) chips.push(['q', '', `«${state.q}»`]);
    state.families.forEach((id) => chips.push(['families', id, FS.families.find((f) => f.id === id).name]));
    state.genders.forEach((id) => chips.push(['genders', id, FS.genderLabel[id]]));
    state.brands.filter((b) => b !== state.brand).forEach((b) => chips.push(['brands', b, b]));
    if (state.priceMin) chips.push(['priceMin', '', `от ${FS.ui.money(state.priceMin)}`]);
    if (state.priceMax) chips.push(['priceMax', '', `до ${FS.ui.money(state.priceMax)}`]);
    if (state.inStock) chips.push(['inStock', '', 'В наличии']);
    return chips.map(([k, v, label]) => `<button type="button" class="chip chip--active" data-unset="${k}" data-value="${esc(v)}" aria-label="Убрать фильтр: ${esc(label)}">${esc(label)}${icon.close}</button>`).join('');
  }

  function results() {
    const list = state.brandMissing ? [] : FS.api.filter(state);
    const filtered = state.families.length + userBrands() + state.genders.length + (state.q ? 1 : 0) + (state.priceMin ? 1 : 0) + (state.priceMax ? 1 : 0) + (state.inStock ? 1 : 0);
    const allowWide = list.length >= 5 && !filtered;
    let wideUsed = 0;
    const grid = list.length ? list.slice(0, shown).map((p, i) => {
      const wide = allowWide && p.featured && wideUsed < 2 && (wideUsed += 1);
      return card(p, { wide, index: Math.min(i % PAGE, 8) });
    }).join('') : state.brandMissing ? `
      <div class="empty">
        <p class="empty-title">Такого бренда сейчас нет</p>
        <p>Посмотрите все бренды бутика или найдите аромат через поиск.</p>
        <a class="line-link" href="#brands">Все бренды</a>
      </div>` : `
      <div class="empty">
        <p class="empty-title">Ничего не нашлось</p>
        <p>Уберите часть фильтров или измените запрос. Можно искать по бренду, названию или ноте, например «сандал».</p>
        <button class="line-link" type="button" data-reset>Сбросить фильтры</button>
      </div>`;
    return { list, grid };
  }

  // Перерисовываем только при реальном изменении фильтров: иначе потеря фокуса
  // полем цены перерисует чипы прямо во время клика и клик «потеряется».
  let lastKey = null;
  function updateResults(force) {
    const key = JSON.stringify(state);
    if (!force && key === lastKey) return;
    lastKey = key;
    shown = PAGE;
    const { list, grid } = results();
    $('[data-grid]', root).innerHTML = grid;
    renderMore(list.length);
    $('[data-count]', root).textContent = `${list.length} ${plural(list.length, 'аромат', 'аромата', 'ароматов')}`;
    $('[data-chips]', root).innerHTML = activeChips();
    const n = state.families.length + userBrands() + state.genders.length + (state.priceMin ? 1 : 0) + (state.priceMax ? 1 : 0) + (state.inStock ? 1 : 0);
    const badge = $('[data-filter-count]', root);
    badge.hidden = !n;
    badge.textContent = n;
    FS.ui.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: heading().title,
      itemListElement: list.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `#product-${p.id}`, name: p.name }))
    });
  }

  // Витрины над каталогом: «Весь каталог», затем категории. active — id категории или 'all'.
  // Вкладку «Бренды» владелец попросил убрать: к брендам ведут полоса над ароматами и «Все бренды».
  function plaques(active) {
    const tabs = [{ href: '#catalog', id: 'all', short: 'Весь каталог' }]
      .concat(FS.categories.map((c) => ({ href: `#catalog-${c.id}`, id: c.id, short: c.short })));
    return `<nav class="plaques" aria-label="Витрины">
        ${tabs.map((t) => `<a class="plaque-tab ${t.id === active ? 'is-active' : ''}" href="${t.href}" ${t.id === active ? 'aria-current="page"' : ''}>${esc(t.short)}</a>`).join('')}
      </nav>`;
  }

  // Бренды текущей витрины одной полосой над ароматами: нажал — открылась страница бренда.
  function brandStrip() {
    if (state.brand || state.brandMissing) return '';
    const counts = new Map();
    FS.api.filter({ category: state.category, families: state.families }).forEach((p) => counts.set(p.brand, (counts.get(p.brand) || 0) + 1));
    if (counts.size < 2) return '';
    const list = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return `<section class="brand-strip" aria-label="Бренды">
        <div class="brand-strip-head"><h2 class="brand-strip-title">Бренды</h2><a class="line-link brand-strip-all" href="#brands">Все бренды (${FS.api.brands().length})</a></div>
        <div class="brand-strip-row">${list.map(([b, n]) => `<a class="brand-chip" href="#brand-${FS.api.brandSlug(b)}"><span>${esc(b)}</span><span class="brand-chip-count">${n}</span></a>`).join('')}</div>
      </section>`;
  }

  function render(route, params) {
    const brand = route.brandSlug ? FS.api.brandBySlug(route.brandSlug) : null;
    state = freshState({ ...route, brand, brandMissing: Boolean(route.brandSlug && !brand) }, params);
    const h = heading();
    const byBrand = state.brand || state.brandMissing;
    const crumbs = byBrand ? '<a href="#catalog">Каталог</a><span aria-hidden="true">/</span><a href="#brands">Бренды</a><span aria-hidden="true">/</span>'
      : state.category || state.families.length ? '<a href="#catalog">Каталог</a><span aria-hidden="true">/</span>' : '';
    const active = byBrand ? 'brands' : state.category || (state.families.length ? '' : 'all');
    return `
      <section class="page-head">
        <nav class="crumbs" aria-label="Навигационная цепочка"><a href="#home">Главная</a><span aria-hidden="true">/</span>${crumbs}<span aria-current="page">${esc(h.title)}</span></nav>
        <h1>${esc(h.title)}</h1>
        <p class="page-lead">${esc(h.lead)}${state.brandMissing ? ' <a class="line-link" href="#brands">Все бренды</a>' : ''}</p>
      </section>
      ${plaques(active)}
      <div class="catalog">
        <aside class="filters" id="catalog-filters" aria-label="Фильтры">${filtersMarkup()}</aside>
        <div class="filters-scrim" data-filters-toggle aria-hidden="true"></div>
        <div class="catalog-main">
          ${brandStrip()}
          <div class="toolbar">
            <label class="toolbar-search">
              <span class="visually-hidden">Поиск в каталоге</span>
              ${icon.search}
              <input id="catalog-search" type="search" placeholder="Поиск: бренд, аромат, нота" value="${esc(state.q)}" autocomplete="off">
            </label>
            <button class="btn btn--outline btn--sm filters-open" type="button" data-filters-toggle aria-controls="catalog-filters" aria-expanded="false">${icon.filter}Фильтры<span class="count count--inline" data-filter-count hidden></span></button>
            <label class="toolbar-sort">
              <span class="visually-hidden">Сортировка</span>
              <select id="catalog-sort">${SORTS.map(([v, l]) => `<option value="${v}" ${v === state.sort ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </label>
          </div>
          <div class="toolbar-meta">
            <p class="result-count" data-count aria-live="polite"></p>
            <div class="chips" data-chips></div>
          </div>
          <div class="shelf-grid shelf-grid--catalog" data-grid></div>
          <div class="catalog-more" data-more></div>
        </div>
      </div>`;
  }

  function renderMore(total) {
    const left = total - shown;
    $('[data-more]', root).innerHTML = left > 0
      ? `<button class="line-link line-link--lg" type="button" data-show-more>Показать ещё ${Math.min(left, PAGE)}</button><p class="result-count">Показано ${shown} из ${total}</p>`
      : '';
  }

  // Следующая порция карточек добавляется в конец, уже показанные не перерисовываются.
  function showMore() {
    const list = FS.api.filter(state);
    const next = list.slice(shown, shown + PAGE);
    const start = shown;
    shown += next.length;
    const tmp = document.createElement('div');
    tmp.innerHTML = next.map((p, i) => card(p, { index: Math.min(i, 8) })).join('');
    const grid = $('[data-grid]', root);
    const added = [...tmp.children];
    added.forEach((el) => grid.appendChild(el));
    FS.motion.reveals(grid);
    renderMore(list.length);
    const firstNew = added[0] && added[0].querySelector('.pcard-name a');
    if (firstNew && start) firstNew.focus({ preventScroll: true });
  }

  function readFilters() {
    const form = $('.filters', root);
    const values = (name) => $$(`input[name="${name}"]:checked`, form).map((i) => i.value);
    state.families = values('families');
    state.brands = state.brand ? [state.brand] : values('brands');
    state.genders = values('genders');
    state.inStock = $('input[name="inStock"]', form).checked;
    const min = Number($('#price-min', form).value);
    const max = Number($('#price-max', form).value);
    state.priceMin = min > 0 ? min : null;
    state.priceMax = max > 0 ? max : null;
  }

  function toggleFilters(force) {
    const panel = $('.filters', root);
    const openNow = force !== undefined ? force : !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', openNow);
    document.body.classList.toggle('filters-locked', openNow);
    $('.filters-open', root).setAttribute('aria-expanded', String(openNow));
    if (openNow) setTimeout(() => $('.filters-close', panel).focus(), 50);
    else $('.filters-open', root).focus({ preventScroll: true });
  }

  function mount(el, route, params, signal) {
    root = el;
    lastKey = null;
    updateResults();
    let t = null;
    $('#catalog-search', root).addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = e.target.value.trim(); updateResults(); }, 180);
    });
    $('#catalog-sort', root).addEventListener('change', (e) => { state.sort = e.target.value; updateResults(); });
    $('.filters', root).addEventListener('change', (e) => { if (e.target.matches('[data-brand-search]')) return; readFilters(); updateResults(); });
    // Поиск по длинному списку брендов: скрываем неподходящие, отметки сохраняются.
    $('.filters', root).addEventListener('input', (e) => {
      if (!e.target.matches('[data-brand-search]')) return;
      const q = e.target.value.trim().toLowerCase();
      $$('input[name="brands"]', root).forEach((i) => { i.closest('.check').hidden = q && !i.value.toLowerCase().includes(q); });
    });
    root.addEventListener('click', (e) => {
      const unset = e.target.closest('[data-unset]');
      if (unset) {
        const k = unset.dataset.unset;
        const v = unset.dataset.value;
        if (Array.isArray(state[k])) state[k] = state[k].filter((x) => x !== v);
        else state[k] = k === 'q' ? '' : (k === 'inStock' ? false : null);
        if (k === 'q') $('#catalog-search', root).value = '';
        $('.filters', root).innerHTML = filtersMarkup();
        updateResults();
        return;
      }
      if (e.target.closest('[data-reset]')) {
        state = freshState({ category: state.category, brand: state.brand, brandMissing: state.brandMissing }, {});
        $('#catalog-search', root).value = '';
        $('#catalog-sort', root).value = 'popular';
        $('.filters', root).innerHTML = filtersMarkup();
        updateResults();
        return;
      }
      if (e.target.closest('[data-show-more]')) { showMore(); return; }
      if (e.target.closest('[data-filters-toggle]')) toggleFilters();
    }, { signal });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('.filters', root).classList.contains('is-open')) toggleFilters(false);
    }, { signal });
  }

  function unmount() {
    document.body.classList.remove('filters-locked');
  }

  function title(route) {
    if (route.brandSlug) return FS.api.brandBySlug(route.brandSlug) || 'Бренд';
    const cat = FS.categories.find((c) => c.id === route.category);
    if (cat) return cat.name;
    const f = FS.families.find((x) => x.id === route.family);
    return f ? `${f.name} ароматы` : 'Каталог';
  }

  return { render, mount, unmount, title, plaques };
})();

/* Бренды: все бренды бутика по алфавиту, поиск по названию. Нажал — открылись ароматы бренда. */
FS.views.brands = (function () {
  const { $, $$, esc, plural } = FS.ui;
  const letterOf = (b) => { const ch = b.trim().charAt(0).toUpperCase(); return /\d/.test(ch) ? '0–9' : /[A-ZА-ЯЁ]/.test(ch) ? ch : '#'; };

  function groups() {
    const counts = new Map();
    FS.api.visible().forEach((p) => counts.set(p.brand, (counts.get(p.brand) || 0) + 1));
    const out = [];
    FS.api.brands().forEach((b) => {
      const letter = letterOf(b);
      let g = out[out.length - 1];
      if (!g || g.letter !== letter) { g = { letter, items: [] }; out.push(g); }
      g.items.push({ name: b, n: counts.get(b) || 0 });
    });
    return out;
  }

  function render() {
    const gs = groups();
    const total = gs.reduce((s, g) => s + g.items.length, 0);
    return `
      <section class="page-head">
        <nav class="crumbs" aria-label="Навигационная цепочка"><a href="#home">Главная</a><span aria-hidden="true">/</span><a href="#catalog">Каталог</a><span aria-hidden="true">/</span><span aria-current="page">Бренды</span></nav>
        <h1>Бренды</h1>
        <p class="page-lead">${total} ${plural(total, 'бренд', 'бренда', 'брендов')} в бутике 5th SENSE. Выберите бренд — откроются все его ароматы.</p>
      </section>
      ${FS.views.catalog.plaques('brands')}
      <div class="page-body brands-page">
        <div class="brands-tools">
          <label class="toolbar-search brands-search">
            <span class="visually-hidden">Найти бренд</span>${FS.ui.icon.search}
            <input id="brand-find" type="search" placeholder="Найти бренд" autocomplete="off">
          </label>
          ${gs.length > 3 ? `<nav class="brand-letters" aria-label="Бренды по буквам">${gs.map((g) => `<button type="button" class="brand-letter-btn" data-letter="${esc(g.letter)}">${esc(g.letter)}</button>`).join('')}</nav>` : ''}
        </div>
        <div class="brand-groups">
          ${gs.map((g) => `<section class="brand-group" data-group="${esc(g.letter)}">
              <h2 class="brand-group-letter">${esc(g.letter)}</h2>
              <ul class="brand-list">${g.items.map((b) => `<li data-name="${esc(b.name.toLowerCase())}"><a class="brand-row" href="#brand-${FS.api.brandSlug(b.name)}"><span class="brand-row-name">${esc(b.name)}</span><span class="brand-row-count">${b.n} ${plural(b.n, 'аромат', 'аромата', 'ароматов')}</span></a></li>`).join('')}</ul>
            </section>`).join('')}
        </div>
        <div class="empty" data-brands-empty hidden>
          <p class="empty-title">Такого бренда нет</p>
          <p>Проверьте написание или поищите аромат в каталоге: там поиск идёт и по названиям, и по нотам.</p>
          <a class="line-link" href="#catalog">Перейти в каталог</a>
        </div>
      </div>`;
  }

  function mount(root, route, params, signal) {
    const input = $('#brand-find', root);
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      let any = false;
      $$('.brand-group', root).forEach((g) => {
        let shown = 0;
        $$('li', g).forEach((li) => { const on = !q || li.dataset.name.includes(q); li.hidden = !on; if (on) shown++; });
        g.hidden = !shown;
        if (shown) any = true;
      });
      $('[data-brands-empty]', root).hidden = any;
      const letters = $('.brand-letters', root);
      if (letters) letters.hidden = Boolean(q);
    }, { signal });
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-letter]');
      if (!btn) return;
      const g = $(`.brand-group[data-group="${CSS.escape(btn.dataset.letter)}"]`, root);
      if (!g) return;
      const top = g.getBoundingClientRect().top + window.scrollY - (document.querySelector('.site-header').offsetHeight + 12);
      window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, { signal });
  }

  return { render, mount, title: () => 'Бренды' };
})();

FS.views.favorites = (function () {
  const { plural, card } = FS.ui;
  let unsubscribe = null;

  function body() {
    const ids = FS.store.favorites();
    const list = FS.api.visible().filter((p) => ids.includes(p.id));
    if (!list.length) {
      return `<div class="empty">
        <p class="empty-title">Здесь появятся ароматы, которые вы отметите</p>
        <p>Нажмите на сердце на карточке аромата, чтобы сохранить его и вернуться к нему позже.</p>
        <a class="line-link" href="#catalog">Перейти в каталог</a>
      </div>`;
    }
    return `<p class="result-count">${list.length} ${plural(list.length, 'аромат', 'аромата', 'ароматов')}</p>
      <div class="shelf-grid shelf-grid--catalog">${list.map((p, i) => card(p, { index: i })).join('')}</div>`;
  }

  return {
    title: () => 'Избранное',
    render() {
      return `<section class="page-head">
          <nav class="crumbs" aria-label="Навигационная цепочка"><a href="#home">Главная</a><span aria-hidden="true">/</span><span aria-current="page">Избранное</span></nav>
          <h1>Избранное</h1>
          <p class="page-lead">Ароматы, которые вы отложили. Список хранится в этом браузере.</p>
        </section>
        <div class="page-body" data-fav-body>${body()}</div>`;
    },
    mount(root) {
      unsubscribe = FS.store.subscribe((kind) => {
        if (kind === 'favorites') root.querySelector('[data-fav-body]').innerHTML = body();
      });
    },
    unmount() { if (unsubscribe) unsubscribe(); }
  };
})();
