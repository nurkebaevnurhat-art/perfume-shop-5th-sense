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

  let timer = null;
  const pad = (n) => String(n).padStart(2, '0');

  function heroSlides() {
    return pick(['baccarat-rouge-540', 'lv-les-sables-roses', 'dior-sauvage-elixir', 'kilian-straight-to-heaven', 'marly-althair'], 5);
  }

  function render() {
    const slides = heroSlides();
    const featured = pick(['baccarat-rouge-540', 'oud-wood', 'santal-33', 'lv-stellar-times', 'tom-ford-ombre-leather', 'byredo-bal-dafrique', 'clive-christian-matsukita', 'creed-green-irish-tweed'], 8);
    const best = FS.api.filter({ category: 'bestsellers' });
    const fresh = FS.api.filter({ category: 'new', sort: 'new' }).slice(0, 8);
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
                <span class="slide-img">${FS.bottle.media(p, { title: '' })}</span>
              </a>`).join('')}
          </div>
          <div class="hero-caption">
            <p class="hero-count"><span><span data-hero-index>01</span> / ${pad(slides.length)}</span>${slides.length > 1 ? '<button class="hero-pause" type="button" data-hero-pause aria-pressed="false" aria-label="Остановить смену ароматов"><span aria-hidden="true"></span></button>' : ''}</p>
            <p class="hero-now"><span data-hero-brand>${esc(first.brand)}</span><a data-hero-name href="#product-${first.id}">${esc(first.name)}</a></p>
            <div class="hero-cta">
              <a class="hero-link" href="#catalog">Весь каталог</a>
              <a class="hero-link" href="#aromaty">Ароматы по семействам</a>
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

      <section class="index" data-head="light" aria-labelledby="index-title">
        <div class="index-head">
          <h2 id="index-title" class="index-title">Что попробовать первым</h2>
        </div>
        <div class="index-grid">
          <div class="index-stack" aria-hidden="true">
            ${featured.map((p, i) => `<a class="stack-item ${i === 0 ? 'is-active' : ''}" href="#product-${p.id}" tabindex="-1" data-stack="${i}" data-cursor="Смотреть" style="--tint:${tint(p)}">${FS.bottle.media(p, { title: '' })}</a>`).join('')}
          </div>
          <ol class="index-list">
            ${featured.map((p, i) => `
              <li class="irow ${i === 0 ? 'is-active' : ''}" data-row="${i}">
                <a class="irow-img" href="#product-${p.id}" tabindex="-1" aria-hidden="true" data-cursor="Смотреть" style="--tint:${tint(p)}">${FS.bottle.media(p, { title: '' })}</a>
                <span class="irow-brand">${esc(p.brand)}</span>
                <a class="irow-name" href="#product-${p.id}">${esc(p.name)}</a>
                <span class="irow-meta">${esc(p.short)}</span>
                <span class="irow-actions">
                  <a class="line-link" href="#product-${p.id}">Смотреть</a>
                  <button class="line-link line-link--soft" type="button" data-add="${p.id}" data-ml="${FS.api.mainVolume(p).ml}" ${FS.api.mainVolume(p).stock > 0 ? '' : 'disabled'}>В корзину</button>
                </span>
              </li>`).join('')}
          </ol>
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

      <section class="arrivals" data-head="light" aria-labelledby="new-title">
        <div class="arrivals-head">
          <h2 id="new-title">Новинки</h2>
          <p>Что недавно появилось в бутике.</p>
          <a class="hero-link" href="#catalog-new">Все новинки</a>
        </div>
        <div class="shelf-grid shelf-grid--four">${fresh.map((p, i) => card(p, { index: i % 4 })).join('')}</div>
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
    const slides = $$('.slide', hero);
    const list = heroSlides();
    let index = 0;
    const show = (i) => {
      const prev = index;
      index = (i + slides.length) % slides.length;
      slides.forEach((s, k) => {
        s.classList.toggle('is-active', k === index);
        s.classList.toggle('is-prev', k === prev && k !== index);
        s.tabIndex = k === index ? 0 : -1;
      });
      const p = list[index];
      $('[data-hero-index]', hero).textContent = pad(index + 1);
      $('[data-hero-brand]', hero).textContent = p.brand;
      const name = $('[data-hero-name]', hero);
      name.textContent = p.name;
      name.setAttribute('href', `#product-${p.id}`);
      hero.querySelector('.hero-now').classList.remove('is-swap');
      void hero.offsetWidth;
      hero.querySelector('.hero-now').classList.add('is-swap');
    };
    let heroVisible = true;
    // Смену флаконов можно остановить: кнопкой «пауза», касанием или переходом по ссылкам с клавиатуры.
    let stopped = reduce;
    let holding = false;
    const pauseBtn = $('[data-hero-pause]', hero);
    const setStopped = (on) => {
      stopped = on;
      if (!pauseBtn) return;
      pauseBtn.setAttribute('aria-pressed', String(on));
      pauseBtn.setAttribute('aria-label', on ? 'Продолжить смену ароматов' : 'Остановить смену ароматов');
      pauseBtn.classList.toggle('is-paused', on);
    };
    setStopped(stopped);
    if (pauseBtn) pauseBtn.addEventListener('click', () => setStopped(!stopped), { signal });
    pin.addEventListener('focusin', (e) => { holding = !e.target.closest('[data-hero-pause]'); }, { signal });
    pin.addEventListener('focusout', () => { holding = false; }, { signal });
    pin.addEventListener('touchstart', () => setStopped(true), { passive: true, signal });
    if (slides.length > 1) {
      clearInterval(timer);
      timer = setInterval(() => { if (!stopped && !holding && heroVisible && !document.hidden) show(index + 1); }, 5200);
      signal.addEventListener('abort', () => clearInterval(timer));
    }
    if (M.finePointer.matches && !reduce) {
      pin.addEventListener('pointermove', (e) => {
        const r = pin.getBoundingClientRect();
        pin.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        pin.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      }, { signal });
    }
    // Смена флаконов идёт, только пока герой виден на экране.
    M.scene(() => { heroVisible = hero.getBoundingClientRect().bottom > 0; });

    /* --- Избранное: активная строка у центра экрана меняет картинку --- */
    const rows = $$('.irow', root);
    const stack = $$('.stack-item', root);
    let active = 0;
    const setActive = (i) => {
      if (i === active) return;
      active = i;
      rows.forEach((r, k) => r.classList.toggle('is-active', k === i));
      stack.forEach((s, k) => { s.classList.toggle('is-active', k === i); });
    };
    M.scene((y, h) => {
      let best = 0;
      let dist = Infinity;
      rows.forEach((r, i) => {
        const b = r.getBoundingClientRect();
        const d = Math.abs(b.top + b.height / 2 - h * 0.5);
        if (d < dist) { dist = d; best = i; }
      });
      setActive(best);
    });
    rows.forEach((r, i) => r.addEventListener('pointerenter', () => setActive(i), { signal }));

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

  function unmount() { clearInterval(timer); }

  return { render, mount, unmount, title: () => 'Бутик парфюмерии' };
})();
