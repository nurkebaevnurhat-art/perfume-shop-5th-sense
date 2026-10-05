/* 5th SENSE — главная: кинематографичная презентация бренда. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.home = (function () {
  const { $, $$, esc, money, plural, card, tint, wordmark } = FS.ui;
  const M = FS.motion;
  const P = (id) => FS.api.productSync(id);
  const pick = (ids, n) => {
    const list = ids.map(P).filter(Boolean);
    FS.products.forEach((p) => { if (list.length < n && p.image && !list.includes(p)) list.push(p); });
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
      const list = FS.products.filter((p) => p.family === f.id);
      return `<a class="fam reveal" href="#family-${f.id}" style="--i:${i}">
          <span class="fam-num">${pad(i + 1)}</span>
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
            <p class="hero-count"><span data-hero-index>01</span> / ${pad(slides.length)}</p>
            <p class="hero-now"><span data-hero-brand>${esc(first.brand)}</span><a data-hero-name href="#product-${first.id}">${esc(first.name)}</a></p>
            <div class="hero-cta">
              <a class="hero-link" href="#catalog">Смотреть коллекцию</a>
              <a class="hero-link" href="#aromaty">Исследовать ароматы</a>
            </div>
          </div>
          <h1 id="hero-title" class="hero-mark"><span class="visually-hidden">5th SENSE Perfume Bar, бутик парфюмерии, основан в 2025 году</span>${wordmark('wordmark--hero')}</h1>
        </div>
      </section>

      <section class="story" data-head="dark" aria-labelledby="story-title">
        <div class="story-inner">
          <p class="kicker reveal">О бренде</p>
          <h2 id="story-title" class="visually-hidden">О бренде 5th SENSE</h2>
          <p class="story-text" data-words>Пятое чувство помнит дольше остальных. Мы собираем ароматы, которые становятся частью вашей истории: от первого вдоха до шлейфа, который остаётся после вас.</p>
          <ul class="services">
            <li class="reveal" style="--i:0"><h3>Подбор аромата</h3><p>Консультация в бутике или по телефону.</p></li>
            <li class="reveal" style="--i:1"><h3>Пробник к заказу</h3><p>Кладём пробник аромата из той же семьи.</p></li>
            <li class="reveal" style="--i:2"><h3>Подарочная упаковка</h3><p>Фирменная коробка и открытка без доплаты.</p></li>
            <li class="reveal" style="--i:3"><h3>Оригинальная продукция</h3><p>Курьер бесплатно от ${money(FS.config.freeShippingFrom)}.</p></li>
          </ul>
        </div>
      </section>

      <section class="index" data-head="light" aria-labelledby="index-title">
        <div class="index-head">
          <p class="kicker reveal">Избранная коллекция</p>
          <h2 id="index-title" class="index-title reveal">Восемь ароматов, с которых начинается бутик</h2>
        </div>
        <div class="index-grid">
          <div class="index-num" aria-hidden="true"><span data-index-num>01</span></div>
          <div class="index-stack" aria-hidden="true">
            ${featured.map((p, i) => `<span class="stack-item ${i === 0 ? 'is-active' : ''}" data-stack="${i}" style="--tint:${tint(p)}">${FS.bottle.media(p, { title: '' })}</span>`).join('')}
          </div>
          <ol class="index-list">
            ${featured.map((p, i) => `
              <li class="irow ${i === 0 ? 'is-active' : ''}" data-row="${i}">
                <a class="irow-img" href="#product-${p.id}" tabindex="-1" aria-hidden="true" style="--tint:${tint(p)}">${FS.bottle.media(p, { title: '' })}</a>
                <span class="irow-num">${pad(i + 1)}</span>
                <span class="irow-brand">${esc(p.brand)}</span>
                <a class="irow-name" href="#product-${p.id}">${esc(p.name)}</a>
                <span class="irow-meta">${esc(p.short)}</span>
                <span class="irow-actions">
                  <a class="line-link" href="#product-${p.id}">Смотреть</a>
                  <button class="line-link line-link--soft" type="button" data-add="${p.id}" data-ml="${FS.api.mainVolume(p).ml}" ${FS.api.mainVolume(p).stock > 0 ? '' : 'disabled'}>${money(FS.api.mainVolume(p).price)}, в корзину</button>
                </span>
              </li>`).join('')}
          </ol>
        </div>
      </section>

      <section class="hscroll" data-head="dark" aria-labelledby="best-title">
        <div class="hscroll-pin">
          <div class="hscroll-head">
            <p class="kicker">Бестселлеры</p>
            <h2 id="best-title" class="hscroll-title">Ароматы, за которыми возвращаются</h2>
            <a class="hero-link" href="#catalog-bestsellers">Все бестселлеры</a>
          </div>
          <div class="hscroll-track" tabindex="0" aria-label="Бестселлеры, прокрутите в сторону">
            ${best.map((p, i) => card(p, { index: i % 4, reveal: false })).join('')}
          </div>
          <div class="hscroll-bar" aria-hidden="true"><span></span></div>
        </div>
      </section>

      <section class="families" id="aromaty" data-head="light" aria-labelledby="fam-title">
        <div class="families-head">
          <p class="kicker reveal">Семейства ароматов</p>
          <h2 id="fam-title" class="reveal">Исследовать ароматы</h2>
          <p class="families-lead reveal">Выберите семейство, которое вам ближе. Мы покажем ароматы с похожим характером.</p>
        </div>
        <div class="fam-list">${FS.families.map(family).join('')}</div>
      </section>

      <section class="arrivals" data-head="light" aria-labelledby="new-title">
        <div class="arrivals-head">
          <h2 id="new-title" class="reveal">Новинки</h2>
          <p class="reveal">Последние поступления на полки бутика.</p>
          <a class="hero-link reveal" href="#catalog-new">Все новинки</a>
        </div>
        <div class="shelf-grid shelf-grid--four">${fresh.map((p, i) => card(p, { index: i % 4 })).join('')}</div>
      </section>

      <section class="finale" data-head="dark" aria-labelledby="finale-title">
        <p class="kicker reveal">Консультация</p>
        <h2 id="finale-title" class="finale-title" data-chars>Найдём ваш аромат</h2>
        <p class="finale-text reveal">Расскажите консультанту о любимых нотах и поводе, и он подберёт аромат, который будет звучать именно на вас.</p>
        <div class="finale-cta reveal">
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
    if (!reduce && slides.length > 1) {
      clearInterval(timer);
      timer = setInterval(() => { if (heroVisible && !document.hidden) show(index + 1); }, 5200);
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

    /* --- История: слова проявляются по мере прокрутки --- */
    const storyText = $('[data-words]', root);
    const words = M.splitWords(storyText);
    let lastLit = -1;
    M.scene((y, h) => {
      const r = storyText.getBoundingClientRect();
      const k = M.clamp((h * 0.82 - r.top) / (r.height + h * 0.3), 0, 1);
      const lit = reduce ? words.length : Math.round(k * words.length * 1.1);
      if (lit === lastLit) return;
      lastLit = lit;
      words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
    });

    /* --- Индекс: активная строка у центра экрана меняет картинку и номер --- */
    const rows = $$('.irow', root);
    const stack = $$('.stack-item', root);
    const num = $('[data-index-num]', root);
    let active = 0;
    const setActive = (i) => {
      if (i === active) return;
      active = i;
      rows.forEach((r, k) => r.classList.toggle('is-active', k === i));
      stack.forEach((s, k) => { s.classList.toggle('is-active', k === i); });
      num.textContent = pad(i + 1);
      num.parentElement.classList.remove('is-swap');
      void num.offsetWidth;
      num.parentElement.classList.add('is-swap');
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

    /* --- Бестселлеры: горизонтальная лента, закреплённая на время прокрутки --- */
    const hs = $('.hscroll', root);
    const track = $('.hscroll-track', hs);
    const bar = $('.hscroll-bar span', hs);
    let distance = 0;
    // На низких экранах лента не закрепляется: карточки не поместились бы под шапкой.
    const pinned = () => !reduce && window.matchMedia('(min-width: 900px) and (min-height: 600px)').matches;
    const measure = () => {
      if (pinned()) {
        hs.classList.add('is-pinned');
        distance = Math.max(0, track.scrollWidth - track.clientWidth);
        hs.style.height = `${distance + window.innerHeight}px`;
      } else {
        hs.classList.remove('is-pinned');
        hs.style.height = '';
        track.style.transform = '';
        distance = 0;
      }
    };
    measure();
    window.addEventListener('resize', measure, { signal });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    M.scene((y, h) => {
      if (!distance) {
        const max = track.scrollWidth - track.clientWidth;
        bar.style.transform = `scaleX(${max > 0 ? (track.scrollLeft / max).toFixed(3) : 0})`;
        return;
      }
      const p = M.progress(hs, h);
      track.style.transform = `translate3d(${(-p * distance).toFixed(1)}px,0,0)`;
      bar.style.transform = `scaleX(${p.toFixed(3)})`;
    });
    track.addEventListener('scroll', () => M.refresh(), { passive: true, signal });


    /* --- Финал: заголовок по буквам --- */
    M.splitChars($('[data-chars]', root));
    $('[data-chars]', root).classList.add('reveal');
  }

  function unmount() { clearInterval(timer); }

  return { render, mount, unmount, title: () => 'Бутик парфюмерии' };
})();
