/* 5th SENSE — «Подбор аромата» (5 вопросов → три аромата) и «Наборы пробников»
   (готовые наборы по 5 мл и «Соберите свой»). Набор кладётся в корзину обычными
   позициями по 5 мл — цены, как и всегда, пересчитывает сервер. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.sampler = (function () {
  const { money } = FS.ui;
  // Объём пробника: 5 мл, а если его нет — самый маленький.
  function sample(p) {
    const list = (p.volumes || []).filter((v) => !v.full && v.price > 0).sort((a, b) => a.ml - b.ml);
    return list.find((v) => v.ml === 5) || list[0] || null;
  }
  const total = (list) => list.reduce((s, p) => s + (sample(p) ? sample(p).price : 0), 0);
  // Кладёт в корзину по одному пробнику каждого аромата.
  function addAll(list) {
    let n = 0;
    list.forEach((p) => { const v = sample(p); if (v && FS.store.add(p.id, v.ml, 1)) n++; });
    if (n) FS.ui.toast(`${n} ${FS.ui.plural(n, 'пробник', 'пробника', 'пробников')} в корзине`, { label: 'Открыть', run: FS.ui.openCart });
    else FS.ui.toast('Не удалось добавить: этих ароматов сейчас нет');
  }
  const thumbs = (list) => `<span class="set-thumbs" aria-hidden="true">${list.map((p, i) => `<span class="set-thumb" style="--i:${i}">${FS.bottle.media(p)}</span>`).join('')}</span>`;
  const priceLine = (list) => `${list.length} × ${sample(list[0]) ? sample(list[0]).ml : 5} мл · ${money(total(list))}`;
  return { sample, total, addAll, thumbs, priceLine };
})();

FS.views.podbor = (function () {
  const { esc, money, managerLinks, tint } = FS.ui;
  const S = FS.sampler;

  // Семейства, которые звучат рядом: «тёплое» подходит и тем, кто выбрал «дерево».
  const NEAR = { fresh: ['fruity', 'floral'], floral: ['fruity', 'fresh'], fruity: ['floral', 'gourmand'], gourmand: ['amber', 'fruity'], amber: ['gourmand', 'woody'], woody: ['chypre', 'amber'], chypre: ['woody'] };
  const WARM = ['fresh', 'fruity', 'floral'];
  const COLD = ['amber', 'gourmand', 'woody', 'chypre'];

  const Q = [
    { id: 'who', title: 'Для кого аромат?', options: [
      { v: 'women', name: 'Для неё' },
      { v: 'men', name: 'Для него' },
      { v: 'any', name: 'Неважно', note: 'Покажем и ароматы унисекс' }
    ] },
    { id: 'like', title: 'Какие запахи вам нравятся?', options: [
      { v: 'fresh', name: 'Свежие', note: 'Цитрусы, море, зелень' },
      { v: 'floral', name: 'Цветочные', note: 'Роза, жасмин, ирис' },
      { v: 'gourmand', name: 'Сладкие', note: 'Ваниль, карамель, коньяк' },
      { v: 'amber', name: 'Тёплые и пряные', note: 'Амбра, ладан, специи' },
      { v: 'woody', name: 'Древесные', note: 'Сандал, кедр, уд, кожа' },
      { v: 'any', name: 'Не знаю', note: 'Подберём по остальным ответам' }
    ] },
    { id: 'when', title: 'Когда будете носить?', options: [
      { v: 'day', name: 'Днём', note: 'На работу, учёбу, по делам' },
      { v: 'evening', name: 'Вечером', note: 'Встречи, ужин, праздник' },
      { v: 'any', name: 'Всегда', note: 'Один аромат на каждый день' }
    ] },
    { id: 'season', title: 'Какое время года?', options: [
      { v: 'warm', name: 'Весна и лето' },
      { v: 'cold', name: 'Осень и зима' },
      { v: 'any', name: 'Круглый год' }
    ] },
    { id: 'trail', title: 'Каким должен быть шлейф?', options: [
      { v: 2, name: 'Лёгкий', note: 'Близко к коже, для себя' },
      { v: 3, name: 'Заметный', note: 'Чувствуют те, кто рядом' },
      { v: 5, name: 'Яркий', note: 'Чтобы запомнили' }
    ] }
  ];

  const famName = (id) => ((FS.families.find((f) => f.id === id) || {}).name || '').toLowerCase();

  // Баллы аромата по ответам и короткие причины «почему подходит».
  function score(p, a) {
    if (a.who !== 'any' && p.gender !== 'unisex' && p.gender !== a.who) return null;
    let s = 0;
    const why = [];
    if (a.like !== 'any') {
      const near = (NEAR[a.like] || []).includes(p.family);
      if (p.family === a.like || (a.like === 'woody' && p.family === 'chypre')) { s += 6; why.push(`${famName(p.family)}, как вы любите`); }
      else if (near) s += 2;
      else s -= 2;
    }
    const sil = p.sillage || 3;
    if (a.when === 'day') { if (sil <= 3) { s += 2; why.push('не тяжёлый, подойдёт днём'); } else s -= 1; }
    if (a.when === 'evening') { if (sil >= 4) { s += 2; why.push('раскрывается вечером'); } else s -= 1; }
    if (a.season === 'warm') { if (WARM.includes(p.family)) { s += 2; why.push('лёгкий в жару'); } else s -= 1; }
    if (a.season === 'cold') { if (COLD.includes(p.family)) { s += 2; why.push('согревает в холод'); } else s -= 1; }
    const d = Math.abs(sil - a.trail);
    s += 3 - d * 1.5;
    if (d === 0) why.push(a.trail >= 5 ? 'яркий шлейф' : a.trail <= 2 ? 'мягкий, близко к коже' : 'заметный шлейф');
    if ((p.longevity || 0) >= 4) why.push('держится весь день');
    if (p.bestseller) s += 0.5;
    if (p.image) s += 0.3;
    return { p, s, why: why.slice(0, 3) };
  }

  function pickThree(a) {
    return FS.api.visible().filter((p) => p.type !== 'set' && S.sample(p))
      .map((p) => score(p, a)).filter(Boolean)
      .sort((x, y) => y.s - x.s).slice(0, 3);
  }

  let step = 0;
  let answers = {};

  function question() {
    const q = Q[step];
    return `
      <div class="qz-progress" role="progressbar" aria-label="Пройдено вопросов" aria-valuemin="0" aria-valuemax="${Q.length}" aria-valuenow="${step}"><span style="--p:${step / Q.length}"></span></div>
      <fieldset class="qz-step">
        <legend class="qz-legend"><span class="qz-count">Вопрос ${step + 1} из ${Q.length}</span><span class="qz-title">${esc(q.title)}</span></legend>
        <div class="qz-options">
          ${q.options.map((o) => `
            <label class="option qz-option">
              <input type="radio" name="qz-${q.id}" value="${o.v}" ${String(answers[q.id]) === String(o.v) ? 'checked' : ''}>
              <span class="option-body"><span class="option-name">${esc(o.name)}</span>${o.note ? `<span class="option-note">${esc(o.note)}</span>` : ''}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <div class="qz-nav">
        ${step ? '<button class="line-link line-link--soft" type="button" data-qz-back>Назад</button>' : '<span></span>'}
        <span class="qz-hint">Выберите ответ — следующий вопрос откроется сам</span>
      </div>`;
  }

  function result() {
    const top = pickThree(answers);
    if (!top.length) {
      return `<div class="qz-result"><h2 class="qz-title">Подходящих ароматов сейчас нет</h2>
        <p>Напишите консультанту — подберём вручную.</p><p class="manager-links">${managerLinks()}</p>
        <button class="line-link" type="button" data-qz-restart>Пройти заново</button></div>`;
    }
    const list = top.map((t) => t.p);
    return `
      <div class="qz-result">
        <h2 class="qz-title">Вам стоит попробовать</h2>
        <p class="qz-lead">Возьмите пробники по ${S.sample(list[0]).ml} мл и поносите каждый пару дней — так проще понять, какой ваш.</p>
        <ol class="qz-picks">
          ${top.map((t) => {
            const v = S.sample(t.p);
            return `
            <li class="qz-pick" style="--tint:${tint(t.p)}">
              <a class="qz-pick-media" href="#product-${t.p.id}" tabindex="-1" aria-hidden="true">${FS.bottle.media(t.p)}</a>
              <div class="qz-pick-body">
                <p class="pcard-brand">${esc(t.p.brand)}</p>
                <h3 class="qz-pick-name"><a href="#product-${t.p.id}">${esc(t.p.name)}</a></h3>
                ${t.p.short ? `<p class="qz-pick-short">${esc(t.p.short)}</p>` : ''}
                ${t.why.length ? `<ul class="qz-why">${t.why.map((w) => `<li>${esc(w[0].toUpperCase() + w.slice(1))}</li>`).join('')}</ul>` : ''}
                <button class="line-link" type="button" data-add="${t.p.id}" data-ml="${v.ml}">Пробник ${v.ml} мл — ${money(v.price)}</button>
              </div>
            </li>`;
          }).join('')}
        </ol>
        <div class="qz-all">
          <p><span class="qz-all-name">Все три пробника</span><span class="qz-all-price">${S.priceLine(list)}</span></p>
          <button class="line-link line-link--lg" type="button" data-qz-all>Взять все три</button>
        </div>
        <div class="qz-after">
          <button class="line-link line-link--soft" type="button" data-qz-restart>Пройти заново</button>
          <a class="line-link line-link--soft" href="#nabory">Наборы пробников</a>
        </div>
        <p class="qz-help">Хотите живого совета? ${managerLinks()}</p>
      </div>`;
  }

  function draw(root, focus) {
    const box = root.querySelector('[data-qz]');
    box.innerHTML = step < Q.length ? question() : result();
    if (focus) {
      const t = box.querySelector('.qz-title');
      if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
      const top = box.getBoundingClientRect().top + window.scrollY - document.querySelector('.site-header').offsetHeight - 24;
      if (window.scrollY > top) window.scrollTo({ top });
    }
  }

  return {
    title: () => 'Подбор аромата',
    render() {
      step = 0; answers = {};
      return `
        <section class="page-head">
          <nav class="crumbs" aria-label="Навигационная цепочка"><a href="#home">Главная</a><span aria-hidden="true">/</span><span aria-current="page">Подбор аромата</span></nav>
          <h1>Подбор аромата</h1>
          <p class="page-lead">Пять коротких вопросов — и мы покажем три аромата, которые стоит попробовать первыми.</p>
        </section>
        <div class="page-body qz" data-qz aria-live="polite"></div>`;
    },
    mount(root, route, params, signal) {
      draw(root, false);
      root.addEventListener('change', (e) => {
        const r = e.target.closest('.qz-option input');
        if (!r) return;
        const q = Q[step];
        answers[q.id] = q.id === 'trail' ? Number(r.value) : r.value;
        // Короткая пауза, чтобы выбор успели увидеть.
        setTimeout(() => { if (!signal.aborted) { step++; draw(root, true); } }, 260);
      }, { signal });
      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-qz-back]')) { step = Math.max(0, step - 1); draw(root, true); }
        if (e.target.closest('[data-qz-restart]')) { step = 0; answers = {}; draw(root, true); }
        if (e.target.closest('[data-qz-all]')) S.addAll(pickThree(answers).map((t) => t.p));
      }, { signal });
    }
  };
})();

FS.views.nabory = (function () {
  const { esc, money, tint } = FS.ui;
  const S = FS.sampler;
  const SIZE = 5;
  let picked = [];

  // Готовые наборы собираются из каталога сами: сначала бестселлеры, потом остальные.
  const READY = [
    { id: 'her', name: 'Для неё', lead: 'Цветы, фрукты и мягкая сладость', match: (p) => p.gender !== 'men' && ['floral', 'fruity', 'gourmand', 'amber'].includes(p.family) },
    { id: 'him', name: 'Для него', lead: 'Свежесть, дерево и специи', match: (p) => p.gender !== 'women' && ['fresh', 'woody', 'amber', 'chypre'].includes(p.family) },
    { id: 'winter', name: 'Тёплые на зиму', lead: 'Амбра, ваниль, уд и коньяк', match: (p) => ['amber', 'gourmand', 'woody'].includes(p.family) && (p.sillage || 3) >= 4 },
    { id: 'summer', name: 'Свежие на лето', lead: 'Цитрусы, море и зелень', match: (p) => ['fresh', 'fruity'].includes(p.family) || (p.family === 'floral' && (p.sillage || 3) <= 3) },
    { id: 'niche', name: 'Знакомство с нишей', lead: 'Пять ароматов, о которых спрашивают чаще всего', match: (p) => p.niche }
  ];
  const pool = () => FS.api.visible().filter((p) => p.type !== 'set' && S.sample(p));
  // Наборы собираются по очереди: аромат, уже попавший в прошлый набор, идёт в следующий
  // только если других подходящих нет — так наборы не повторяют друг друга.
  let built = {};
  function buildAll() {
    const used = {};
    built = {};
    READY.forEach((set) => {
      const rank = (p) => (p.bestseller ? 2 : 0) + (p.featured ? 1 : 0) + (p.image ? 0.5 : 0) - (used[p.id] || 0) * 4;
      const list = pool().filter(set.match).sort((a, b) => rank(b) - rank(a));
      // Не больше двух ароматов одного бренда, чтобы набор был разнообразным.
      const out = [];
      const seen = {};
      list.forEach((p) => { if (out.length < SIZE && (seen[p.brand] || 0) < 2) { out.push(p); seen[p.brand] = (seen[p.brand] || 0) + 1; } });
      out.forEach((p) => { used[p.id] = (used[p.id] || 0) + 1; });
      built[set.id] = out;
    });
  }

  function readyCard(set) {
    const list = built[set.id] || [];
    if (list.length < SIZE) return '';
    return `
      <article class="set-card">
        ${S.thumbs(list)}
        <div class="set-card-body">
          <h3 class="set-name">${esc(set.name)}</h3>
          <p class="set-lead">${esc(set.lead)}</p>
          <ul class="set-list">${list.map((p) => `<li><a href="#product-${p.id}">${esc(p.brand)} ${esc(p.name)}</a></li>`).join('')}</ul>
          <div class="set-foot">
            <span class="set-price">${S.priceLine(list)}</span>
            <button class="line-link" type="button" data-set="${set.id}">Набор в корзину</button>
          </div>
        </div>
      </article>`;
  }

  function tile(p) {
    const v = S.sample(p);
    const on = picked.includes(p.id);
    return `
      <li class="mix-tile ${on ? 'is-on' : ''}" style="--tint:${tint(p)}">
        <button type="button" class="mix-btn" data-mix="${p.id}" aria-pressed="${on}">
          <span class="mix-img" aria-hidden="true">${FS.bottle.media(p)}</span>
          <span class="mix-brand">${esc(p.brand)}</span>
          <span class="mix-name">${esc(p.name)}</span>
          <span class="mix-price">${v.ml} мл · ${money(v.price)}</span>
          <span class="mix-mark" aria-hidden="true"></span>
        </button>
      </li>`;
  }

  function bar() {
    const list = picked.map(FS.api.productSync).filter(Boolean);
    const full = list.length === SIZE;
    return `
      <p class="mix-bar-text"><span class="mix-bar-count">Выбрано ${list.length} из ${SIZE}</span>
        <span class="mix-bar-price">${list.length ? money(S.total(list)) : 'Выберите ароматы для набора'}</span></p>
      <button class="line-link line-link--gold" type="button" data-mix-add ${list.length ? '' : 'disabled'}>${full ? 'Набор в корзину' : list.length ? `В корзину (${list.length})` : 'В корзину'}</button>`;
  }

  return {
    title: () => 'Наборы пробников',
    render() {
      picked = [];
      buildAll();
      const ready = READY.map(readyCard).join('');
      return `
        <section class="page-head">
          <nav class="crumbs" aria-label="Навигационная цепочка"><a href="#home">Главная</a><span aria-hidden="true">/</span><span aria-current="page">Наборы пробников</span></nav>
          <h1>Наборы пробников</h1>
          <p class="page-lead">Пять ароматов по 5 мл — чтобы спокойно поносить каждый и выбрать свой. Хороший подарок, если не знаете, что человек любит.</p>
        </section>
        <div class="page-body sets">
          <section class="sets-block" aria-labelledby="sets-ready">
            <h2 id="sets-ready" class="sets-title">Готовые наборы</h2>
            <div class="set-grid">${ready}</div>
          </section>
          <section class="sets-block" aria-labelledby="sets-mix">
            <h2 id="sets-mix" class="sets-title">Соберите свой</h2>
            <p class="sets-lead">Отметьте пять ароматов. Не знаете, с чего начать? <a class="text-link" href="#podbor">Пройдите подбор</a>.</p>
            <ul class="mix-grid">${pool().map(tile).join('')}</ul>
          </section>
        </div>
        <div class="mix-bar" data-mix-bar>${bar()}</div>`;
    },
    mount(root, route, params, signal) {
      const barEl = root.querySelector('[data-mix-bar]');
      root.addEventListener('click', (e) => {
        const set = e.target.closest('[data-set]');
        if (set) { S.addAll(built[set.dataset.set] || []); return; }
        const b = e.target.closest('[data-mix]');
        if (b) {
          const id = b.dataset.mix;
          if (picked.includes(id)) picked = picked.filter((x) => x !== id);
          else if (picked.length < SIZE) picked.push(id);
          else { FS.ui.toast(`В наборе уже ${SIZE} ароматов. Снимите один, чтобы выбрать другой.`); return; }
          const on = picked.includes(id);
          b.setAttribute('aria-pressed', String(on));
          b.parentElement.classList.toggle('is-on', on);
          barEl.innerHTML = bar();
          barEl.classList.toggle('is-shown', picked.length > 0);
          return;
        }
        if (e.target.closest('[data-mix-add]')) {
          S.addAll(picked.map(FS.api.productSync).filter(Boolean));
          picked = [];
          root.querySelectorAll('.mix-tile.is-on').forEach((t) => { t.classList.remove('is-on'); t.querySelector('[data-mix]').setAttribute('aria-pressed', 'false'); });
          barEl.innerHTML = bar();
          barEl.classList.remove('is-shown');
        }
      }, { signal });
    }
  };
})();
