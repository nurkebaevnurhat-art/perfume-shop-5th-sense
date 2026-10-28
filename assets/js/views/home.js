/* 5th SENSE — главная: кинематографичная презентация бренда. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.home = (function () {
  const { $, $$, esc, money, plural, card, tint, wordmark } = FS.ui;
  const M = FS.motion;
  const P = (id) => FS.api.productSync(id);
  const pick = (ids, n) => {
    const list = ids.map(P).filter((p) => p && !p.hidden);
    FS.api.visible().forEach((p) => { if (list.length < n && p.image && !list.includes(p)) list.push(p); });
    return list.slice(0, n);
  };

  const pad = (n) => String(n).padStart(2, '0');
  // «от 13 600 ₸» — самая низкая цена объёма аромата.
  const tasteFrom = (p) => {
    const v = Math.min(...p.volumes.map((x) => x.price).filter((x) => x > 0));
    return Number.isFinite(v) ? `от ${money(v)}` : '';
  };

  // «Что попробовать первым».
  function featuredList() {
    return pick(['baccarat-rouge-540', 'oud-wood', 'santal-33', 'lv-stellar-times', 'tom-ford-ombre-leather', 'byredo-bal-dafrique', 'clive-christian-matsukita', 'creed-green-irish-tweed'], 8);
  }

  function heroSlides() {
    return pick(['baccarat-rouge-540', 'lv-les-sables-roses', 'dior-sauvage-elixir', 'kilian-straight-to-heaven', 'marly-althair'], 5);
  }

  function render() {
    // Первый экран спокойный: один флакон, без смены слайдов (владелец любит минимализм).
    const slides = heroSlides().slice(0, 1);
    const featured = featuredList();
    const best = FS.api.filter({ category: 'bestsellers' });
    const first = slides[0];

    FS.ui.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: '5th SENSE',
      description: '5th SENSE Perfume Bar: селективная и нишевая парфюмерия.',
      foundingDate: String(FS.config.founded),
      telephone: FS.config.contacts.phone
    });


    const family = (f, i) => {
      const list = FS.api.visible().filter((p) => p.family === f.id);
      return `<a class="fam" href="#family-${f.id}" style="--i:${i}">
          <span class="fam-name">${esc(f.name)}</span>
          <span class="fam-notes">${esc(f.notes)}</span>
          <span class="fam-count">${list.length} ${plural(list.length, 'аромат', 'аромата', 'ароматов')}</span>
        </a>`;
    };

    return `
      <section class="hero" data-head="light" aria-labelledby="hero-title">
        <div class="hero-pin">
          <div class="hero-scene" data-cursor="Смотреть">
            ${slides.map((p, i) => `
              <a class="slide ${i === 0 ? 'is-active' : ''}" href="#product-${p.id}" data-slide="${i}" tabindex="${i === 0 ? 0 : -1}" aria-label="${esc(p.brand)} ${esc(p.name)}">
                <span class="slide-img">${FS.bottle.media(p, { title: '', eager: i === 0 })}</span>
              </a>`).join('')}
          </div>
          <div class="hero-caption">
            <div class="hero-cta">
              <a class="hero-link" href="#catalog">Весь каталог</a>
            </div>
          </div>
          <h1 id="hero-title" class="hero-mark"><span class="visually-hidden">5th SENSE Perfume Bar, бутик парфюмерии, основан в 2025 году</span>${wordmark('wordmark--hero')}</h1>
        </div>
      </section>

      <section class="story" data-head="dark" aria-labelledby="story-title">
        <div class="story-inner">
          <h2 id="story-title" class="visually-hidden">О бутике 5th SENSE</h2>
          <p class="story-text">5th SENSE — парфюмерный бар. Селективные и нишевые ароматы можно попробовать в бутике и взять на распив от 5 мл, а понравившийся — заказать полным флаконом.</p>
          <ul class="services">
            <li><h3>Подбор аромата</h3><p>Расскажите, что вам нравилось раньше, — консультант предложит несколько вариантов.</p></li>
            <li><h3>Распив 5, 10, 15 и 20 мл</h3><p>Хватит, чтобы поносить аромат неделю и решить, нужен ли флакон.</p></li>
            <li><h3>Подарки за покупки</h3><p>Каждая ${FS.config.gifts.every}-я покупка — с подарком. <a class="text-link" href="#gifts">Как это работает</a></p></li>
            <li><h3>Только оригиналы</h3><p>Отливаем из оригинальных флаконов. Документы на товар покажем по запросу.</p></li>
          </ul>
        </div>
      </section>

      <section class="taste" data-head="light" aria-labelledby="taste-title" aria-roledescription="карусель" data-taste>
        <div class="taste-head">
          <h2 id="taste-title" class="taste-title">Что попробовать первым</h2>
        </div>
        <div class="taste-stage" style="--bg:${tint(featured[0], 0.6)}">
          <p class="taste-word" aria-hidden="true">PERFUME</p>
          <div class="taste-track">
            ${featured.map((p, i) => `<a class="taste-item" href="#product-${p.id}" data-taste-item="${i}" tabindex="-1" aria-hidden="true" data-cursor="Смотреть">${FS.bottle.media(p, { title: '', eager: i === 0 })}</a>`).join('')}
          </div>
        </div>
        <div class="taste-bar">
          <div class="taste-info" aria-live="polite">
            <p class="taste-brand" data-taste-brand>${esc(featured[0].brand)}</p>
            <a class="taste-name" href="#product-${featured[0].id}" data-taste-name>${esc(featured[0].name)}</a>
            <p class="taste-desc" data-taste-desc>${esc(featured[0].short)}</p>
          </div>
          <div class="taste-buy">
            <p class="taste-from" data-taste-from>${tasteFrom(featured[0])}</p>
            <div class="taste-actions">
              <button class="buy-main buy-main--sm" type="button" data-add="${featured[0].id}" data-ml="${FS.api.mainVolume(featured[0]).ml}" data-taste-add>В корзину</button>
              <a class="line-link" href="#product-${featured[0].id}" data-taste-more>Смотреть</a>
            </div>
          </div>
          <div class="taste-nav">
            <button class="hs-arrow" type="button" data-taste-go="-1" aria-label="Предыдущий аромат">←</button>
            <p class="taste-count"><span data-taste-index>01</span> / ${pad(featured.length)}</p>
            <button class="hs-arrow" type="button" data-taste-go="1" aria-label="Следующий аромат">→</button>
            <button class="hero-pause taste-pause" type="button" data-taste-pause aria-pressed="false" aria-label="Остановить смену ароматов"><svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle class="hp-track" cx="20" cy="20" r="19"/><circle class="hp-arc" data-taste-ring cx="20" cy="20" r="19" pathLength="100"/></svg><span class="hp-icon" aria-hidden="true"></span></button>
          </div>
        </div>
      </section>

      <section class="hscroll" data-head="dark" aria-labelledby="best-title">
        <div class="hscroll-pin">
          <div class="hscroll-head">
            <h2 id="best-title" class="hscroll-title">Бестселлеры</h2>
            <div class="hscroll-nav">
              <button class="hs-arrow" type="button" data-hs="-1" aria-label="Предыдущие бестселлеры">‹</button>
              <button class="hs-arrow" type="button" data-hs="1" aria-label="Следующие бестселлеры">›</button>
              <a class="hero-link" href="#catalog-bestsellers">Все бестселлеры</a>
            </div>
          </div>
          <div class="hscroll-track" tabindex="0" aria-label="Бестселлеры, прокрутите в сторону">
            ${best.map((p, i) => card(p, { index: i % 4, reveal: false })).join('')}
          </div>
          <div class="hscroll-bar" aria-hidden="true"><span></span></div>
        </div>
      </section>

      <section class="families" id="aromaty" data-head="light" aria-labelledby="fam-title">
        <div class="families-head">
          <h2 id="fam-title">Ароматы по семействам</h2>
          <p class="families-lead">Знаете, какие ноты вам нравятся? Начните с семейства.</p>
        </div>
        <div class="fam-list">${FS.families.map(family).join('')}</div>
      </section>

      <section class="finale" data-head="dark" aria-labelledby="finale-title">
        <h2 id="finale-title" class="finale-title">Не знаете, что выбрать?</h2>
        <p class="finale-text">Напишите консультанту, какие ароматы вам нравились раньше и для какого случая ищете новый. Он предложит два-три варианта на распив.</p>
        <div class="finale-cta">
          <a class="hero-link" href="#catalog">Перейти в каталог</a>
          <span class="finale-phone selectable">${esc(FS.config.contacts.phone)}</span>
        </div>
      </section>`;
  }

  function mount(root, route, params, signal) {
    const reduce = M.reduce.matches;

    /* --- Герой: смена флаконов, параллакс, сжатие кадра при прокрутке --- */
    const hero = $('.hero', root);
    const pin = $('.hero-pin', hero);
    // Первый экран без смены флаконов: один флакон, лёгкий параллакс за курсором.
    if (M.finePointer.matches && !reduce) {
      pin.addEventListener('pointermove', (e) => {
        const r = pin.getBoundingClientRect();
        pin.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        pin.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      }, { signal });
    }

    /* --- «Что попробовать первым»: флакон в центре крупно, соседние — по бокам.
       Смена: центральный уменьшается и уходит в сторону, соседний выезжает в центр,
       фон перетекает в тон аромата. Кольцо на кнопке паузы — время до следующего. --- */
    const taste = $('[data-taste]', root);
    const tItems = $$('[data-taste-item]', taste);
    const tList = featuredList();
    const tRing = $('[data-taste-ring]', taste);
    const tPause = $('[data-taste-pause]', taste);
    let tIndex = 0;
    let tStopped = reduce;
    let tHold = false;
    let tVisible = false;
    const tRestart = () => { tRing.style.animation = 'none'; void tRing.getBoundingClientRect(); tRing.style.animation = ''; };
    const tSync = () => tPause.classList.toggle('is-held', tHold || !tVisible || document.hidden);
    const tPlace = () => {
      const n = tItems.length;
      tItems.forEach((el, k) => {
        let d = (k - tIndex + n) % n;
        if (d > n / 2) d -= n;
        el.dataset.pos = d === 0 ? 'center' : d === -1 ? 'prev' : d === 1 ? 'next' : d < 0 ? 'far-prev' : 'far-next';
      });
    };
    const tShow = (i) => {
      tIndex = (i + tItems.length) % tItems.length;
      const p = tList[tIndex];
      tPlace();
      $('.taste-stage', taste).style.setProperty('--bg', tint(p, 0.6));
      $('[data-taste-index]', taste).textContent = pad(tIndex + 1);
      const info = $('.taste-info', taste);
      info.classList.remove('is-swap'); void info.offsetWidth; info.classList.add('is-swap');
      $('[data-taste-brand]', taste).textContent = p.brand;
      const name = $('[data-taste-name]', taste);
      name.textContent = p.name;
      name.setAttribute('href', FS.app.href('product-' + p.id));
      $('[data-taste-more]', taste).setAttribute('href', FS.app.href('product-' + p.id));
      $('[data-taste-desc]', taste).textContent = p.short || '';
      $('[data-taste-from]', taste).textContent = tasteFrom(p);
      const add = $('[data-taste-add]', taste);
      add.dataset.add = p.id;
      add.dataset.ml = FS.api.mainVolume(p).ml;
      tRestart();
    };
    const tSetStopped = (on) => {
      tStopped = on;
      tPause.setAttribute('aria-pressed', String(on));
      tPause.setAttribute('aria-label', on ? 'Продолжить смену ароматов' : 'Остановить смену ароматов');
      tPause.classList.toggle('is-paused', on);
    };
    tPlace();
    tSetStopped(tStopped);
    tPause.addEventListener('click', () => tSetStopped(!tStopped), { signal });
    taste.addEventListener('click', (e) => {
      // После листания пальцем «клик» по флакону не открывает страницу.
      if (swiped && e.target.closest('.taste-stage')) { swiped = false; e.preventDefault(); return; }
      const go = e.target.closest('[data-taste-go]');
      if (go) { tShow(tIndex + Number(go.dataset.tasteGo)); return; }
      // Нажали на соседний флакон — он выезжает в центр (а не открывает страницу).
      const item = e.target.closest('[data-taste-item]');
      if (item && item.dataset.pos !== 'center') { e.preventDefault(); tShow(Number(item.dataset.tasteItem)); }
    }, { signal });
    tRing.addEventListener('animationend', () => { if (!tStopped && !tHold && tVisible && !document.hidden) tShow(tIndex + 1); else tRestart(); }, { signal });
    // Пока покупатель читает или наводит курсор на блок, смена стоит.
    taste.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { tHold = true; tSync(); } }, { signal });
    taste.addEventListener('pointerleave', () => { tHold = false; tSync(); }, { signal });
    taste.addEventListener('focusin', (e) => { tHold = !e.target.closest('[data-taste-pause]'); tSync(); }, { signal });
    taste.addEventListener('focusout', () => { tHold = false; tSync(); }, { signal });
    document.addEventListener('visibilitychange', tSync, { signal });
    // Листание пальцем по сцене.
    const stage = $('.taste-stage', taste);
    let sx = null;
    let swiped = false;
    stage.addEventListener('pointerdown', (e) => { sx = e.clientX; }, { signal });
    stage.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) { swiped = true; tShow(tIndex + (dx < 0 ? 1 : -1)); if (e.pointerType !== 'mouse') tSetStopped(true); }
    }, { signal });
    const tObs = new IntersectionObserver(([en]) => { tVisible = en.isIntersecting; tSync(); }, { threshold: 0.35 });
    tObs.observe(stage);
    signal.addEventListener('abort', () => tObs.disconnect());
    tSync();

    /* --- Бестселлеры: обычная лента — листают пальцем или стрелками, вертикальную прокрутку не перехватываем --- */
    const hs = $('.hscroll', root);
    const track = $('.hscroll-track', hs);
    const bar = $('.hscroll-bar span', hs);
    const syncBar = () => {
      const max = track.scrollWidth - track.clientWidth;
      bar.style.transform = `scaleX(${max > 0 ? (track.scrollLeft / max).toFixed(3) : 0})`;
      $('[data-hs="-1"]', hs).disabled = track.scrollLeft <= 2;
      $('[data-hs="1"]', hs).disabled = track.scrollLeft >= max - 2;
    };
    hs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-hs]');
      if (btn) track.scrollBy({ left: Number(btn.dataset.hs) * track.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
    }, { signal });
    syncBar();
    window.addEventListener('resize', syncBar, { signal });
    track.addEventListener('scroll', syncBar, { passive: true, signal });
  }


  return { render, mount, title: () => 'Бутик парфюмерии' };
})();
