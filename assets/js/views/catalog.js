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

  function freshState(route, params) {
    return {
      category: route.category || null,
      families: route.family ? [route.family] : [],
      brands: [],
      genders: [],
      priceMin: null,
      priceMax: null,
      inStock: false,
      q: (params && params.q) || '',
      sort: 'popular'
    };
  }

  function heading() {
    const cat = FS.categories.find((c) => c.id === state.category);
    if (cat) return { title: cat.name, lead: cat.lead };
    if (state.families.length === 1) {
      const f = FS.families.find((x) => x.id === state.families[0]);
      return { title: `${f.name} ароматы`, lead: `Семейство с нотами: ${f.notes}.` };
    }
    return { title: 'Каталог ароматов', lead: 'Все ароматы бутика 5th SENSE. Используйте поиск и фильтры, чтобы найти свой.' };
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
      ${checkboxGroup('brands', 'Бренд', brands, state.brands)}
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
    state.brands.forEach((b) => chips.push(['brands', b, b]));
    if (state.priceMin) chips.push(['priceMin', '', `от ${FS.ui.money(state.priceMin)}`]);
    if (state.priceMax) chips.push(['priceMax', '', `до ${FS.ui.money(state.priceMax)}`]);
    if (state.inStock) chips.push(['inStock', '', 'В наличии']);
    return chips.map(([k, v, label]) => `<button type="button" class="chip chip--active" data-unset="${k}" data-value="${esc(v)}" aria-label="Убрать фильтр: ${esc(label)}">${esc(label)}${icon.close}</button>`).join('');
  }

  function results() {
    const list = FS.api.filter(state);
    const filtered = state.families.length + state.brands.length + state.genders.length + (state.q ? 1 : 0) + (state.priceMin ? 1 : 0) + (state.priceMax ? 1 : 0) + (state.inStock ? 1 : 0);
    const allowWide = list.length >= 5 && !filtered;
    let wideUsed = 0;
    const grid = list.length ? list.map((p, i) => {
      const wide = allowWide && p.featured && wideUsed < 2 && (wideUsed += 1);
      return card(p, { wide, index: Math.min(i, 8) });
    }).join('') : `
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
    const { list, grid } = results();
    $('[data-grid]', root).innerHTML = grid;
    $('[data-count]', root).textContent = `${list.length} ${plural(list.length, 'аромат', 'аромата', 'ароматов')}`;
    $('[data-chips]', root).innerHTML = activeChips();
    const n = state.families.length + state.brands.length + state.genders.length + (state.priceMin ? 1 : 0) + (state.priceMax ? 1 : 0) + (state.inStock ? 1 : 0);
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

  function render(route, params) {
    state = freshState(route, params);
    const h = heading();
    const cats = [{ id: null, short: 'Весь каталог' }].concat(FS.categories);
    return `
      <section class="page-head">
        <nav class="crumbs" aria-label="Навигационная цепочка"><a href="#home">Главная</a><span aria-hidden="true">/</span>${state.category || state.families.length ? '<a href="#catalog">Каталог</a><span aria-hidden="true">/</span>' : ''}<span aria-current="page">${esc(h.title)}</span></nav>
        <h1>${esc(h.title)}</h1>
        <p class="page-lead">${esc(h.lead)}</p>
      </section>
      <nav class="plaques" aria-label="Витрины">
        ${cats.map((c) => `<a class="plaque-tab ${c.id === state.category && !(c.id === null && state.families.length) ? 'is-active' : ''}" href="#${c.id ? 'catalog-' + c.id : 'catalog'}" ${c.id === state.category ? 'aria-current="page"' : ''}>${esc(c.short)}</a>`).join('')}
      </nav>
      <div class="catalog">
        <aside class="filters" id="catalog-filters" aria-label="Фильтры">${filtersMarkup()}</aside>
        <div class="filters-scrim" data-filters-toggle aria-hidden="true"></div>
        <div class="catalog-main">
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
        </div>
      </div>`;
  }

  function readFilters() {
    const form = $('.filters', root);
    const values = (name) => $$(`input[name="${name}"]:checked`, form).map((i) => i.value);
    state.families = values('families');
    state.brands = values('brands');
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
    $('.filters', root).addEventListener('change', () => { readFilters(); updateResults(); });
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
        const keepCat = state.category;
        state = freshState({ category: keepCat }, {});
        $('#catalog-search', root).value = '';
        $('#catalog-sort', root).value = 'popular';
        $('.filters', root).innerHTML = filtersMarkup();
        updateResults();
        return;
      }
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
    const cat = FS.categories.find((c) => c.id === route.category);
    if (cat) return cat.name;
    const f = FS.families.find((x) => x.id === route.family);
    return f ? `${f.name} ароматы` : 'Каталог';
  }

  return { render, mount, unmount, title };
})();

FS.views.favorites = (function () {
  const { plural, card } = FS.ui;
  let unsubscribe = null;

  function body() {
    const ids = FS.store.favorites();
    const list = FS.products.filter((p) => ids.includes(p.id));
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
