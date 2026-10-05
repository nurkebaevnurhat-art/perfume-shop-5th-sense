/* 5th SENSE — главная: вход в бутик. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.home = (function () {
  const { esc, money, plural, card } = FS.ui;

  // Полки боковых стен: флаконы расставлены так же плотно, как в зале.
  function shelves(side) {
    const perfumes = FS.products.filter((p) => p.type === 'perfume');
    const rows = [];
    for (let r = 0; r < 4; r++) {
      const items = [];
      const n = r % 2 ? 4 : 5;
      for (let i = 0; i < n; i++) {
        const idx = (r * 5 + i * 3 + (side === 'r' ? 7 : 0)) % perfumes.length;
        items.push(`<span class="shelf-bottle" style="--h:${0.68 + ((i * 7 + r * 3) % 4) * 0.07}">${FS.bottle.render(perfumes[idx])}</span>`);
      }
      rows.push(`<div class="shelf"><div class="shelf-row">${items.join('')}</div><span class="shelf-ledge"></span></div>`);
    }
    return rows.join('');
  }

  const vitrineLayout = {
    niche: 'v-niche', men: 'v-men', women: 'v-women', unisex: 'v-unisex',
    bestsellers: 'v-best', new: 'v-new', gifts: 'v-gifts'
  };
  const vitrineOrder = ['niche', 'men', 'women', 'unisex', 'bestsellers', 'new', 'gifts'];

  function vitrine(cat) {
    const items = FS.products.filter(cat.match);
    const shown = items.slice(0, cat.id === 'niche' ? 5 : 4);
    return `
      <a class="vitrine ${vitrineLayout[cat.id]}" href="#catalog-${cat.id}">
        <span class="vitrine-inner">
          <span class="vitrine-light"></span>
          <span class="vitrine-bottles">${shown.map((p) => `<span class="vb">${FS.bottle.render(p)}</span>`).join('')}</span>
          <span class="vitrine-glass"></span>
        </span>
        <span class="plaque">
          <span class="plaque-name">${esc(cat.name)}</span>
          <span class="plaque-count">${items.length} ${plural(items.length, 'аромат', 'аромата', 'ароматов')}</span>
        </span>
      </a>`;
  }

  function blotter(f, i) {
    const count = FS.products.filter((p) => p.family === f.id).length;
    return `
      <a class="blotter" href="#family-${f.id}" style="--tint:${f.tint};--i:${i}">
        <span class="blotter-paper">
          <span class="blotter-name">${esc(f.name)}</span>
          <span class="blotter-notes">${esc(f.notes)}</span>
          <span class="blotter-count">${count} ${plural(count, 'аромат', 'аромата', 'ароматов')}</span>
        </span>
      </a>`;
  }

  function render() {
    const best = FS.api.filter({ category: 'bestsellers' });
    const showcase = [best.find((p) => p.featured && p.type === 'perfume')].concat(best.filter((p) => !(p.featured && p.type === 'perfume'))).filter(Boolean).slice(0, 7);
    const fresh = FS.api.filter({ category: 'new', sort: 'new' });
    const counterItems = ['angels-share', 'baccarat-rouge-540', 'portrait-of-a-lady'].map(FS.api.productSync);
    const playDoors = (() => {
      try {
        if (sessionStorage.getItem('fs.doors')) return false;
        sessionStorage.setItem('fs.doors', '1');
      } catch (e) { /* без хранилища показываем вход один раз за загрузку */ }
      return true;
    })();

    FS.ui.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: '5th SENSE',
      description: 'Premium Perfume Boutique: селективная и нишевая парфюмерия.',
      telephone: FS.config.contacts.phone,
      openingHours: 'Mo-Su 10:00-22:00'
    });

    return `
      <section class="hero ${playDoors ? 'hero--enter' : ''}" aria-labelledby="hero-title">
        <div class="boutique">
          <div class="ceiling" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="wall wall--l" aria-hidden="true">${shelves('l')}</div>
          <div class="feature">
            <span class="pilaster pilaster--l" aria-hidden="true"></span>
            <div class="stone">
              <div class="sign">
                <h1 id="hero-title" class="sign-logo">5<span class="logo-th">th</span> SENSE</h1>
                <p class="sign-sub">Premium Perfume Boutique</p>
              </div>
              <p class="hero-slogan">Аромат, который запоминают первым</p>
              <p class="hero-text">Бутик селективной и нишевой парфюмерии. Оригинальные ароматы мировых домов, консультация и бережная упаковка каждого флакона.</p>
              <div class="hero-actions">
                <a class="btn btn--gold" href="#catalog">Перейти в каталог</a>
                <a class="btn btn--ink" href="#aromaty">Исследовать ароматы</a>
              </div>
            </div>
            <div class="counter" aria-hidden="true">
              <div class="counter-top">${counterItems.map((p) => `<span class="counter-bottle">${FS.bottle.render(p)}</span>`).join('')}</div>
              <div class="counter-front"></div>
            </div>
            <span class="pilaster pilaster--r" aria-hidden="true"></span>
          </div>
          <div class="wall wall--r" aria-hidden="true">${shelves('r')}</div>
          <div class="floor" aria-hidden="true"></div>
        </div>
        <div class="doors" aria-hidden="true"><span class="door door--l"></span><span class="door door--r"></span></div>
      </section>

      <section class="section vitrines-section" id="vitriny" aria-labelledby="vitriny-title">
        <div class="section-head">
          <h2 id="vitriny-title">Витрины бутика</h2>
          <p>Каталог устроен как наш зал: у каждой коллекции своя витрина.</p>
        </div>
        <div class="vitrines">${vitrineOrder.map((id) => vitrine(FS.categories.find((c) => c.id === id))).join('')}</div>
      </section>

      <section class="section showcase-section" aria-labelledby="best-title">
        <div class="section-head section-head--row">
          <div>
            <h2 id="best-title">Бестселлеры</h2>
            <p>Ароматы, за которыми возвращаются в бутик.</p>
          </div>
          <a class="text-link" href="#catalog-bestsellers">Все бестселлеры</a>
        </div>
        <div class="shelf-grid">${showcase.map((p, i) => card(p, { wide: i === 0, index: i })).join('')}</div>
      </section>

      <section class="section explore-section" id="aromaty" aria-labelledby="aromaty-title">
        <div class="section-head">
          <h2 id="aromaty-title">Исследовать ароматы</h2>
          <p>В бутике знакомство с ароматом начинается с блоттера. Выберите семейство, которое вам ближе, и мы покажем подходящие ароматы.</p>
        </div>
        <div class="blotters">${FS.families.map(blotter).join('')}</div>
      </section>

      <section class="section new-section" aria-labelledby="new-title">
        <div class="section-head section-head--row">
          <div>
            <h2 id="new-title">Новинки</h2>
            <p>Последние поступления на полки бутика.</p>
          </div>
          <a class="text-link" href="#catalog-new">Все новинки</a>
        </div>
        <div class="rail" tabindex="0" aria-label="Новинки, прокрутите в сторону">${fresh.map((p, i) => card(p, { index: i })).join('')}</div>
      </section>

      <section class="boutique-section" id="boutique" aria-labelledby="boutique-title">
        <div class="boutique-inner">
          <div class="boutique-copy">
            <h2 id="boutique-title">Бутик 5th SENSE</h2>
            <p>Тёмное дерево, светлый камень и мягкий свет: мы перенесли атмосферу нашего зала на сайт, чтобы выбирать аромат было так же спокойно, как у витрины.</p>
            <p>Если сомневаетесь, позвоните консультанту. Он подберёт аромат по вашим предпочтениям и расскажет, как он раскрывается на коже.</p>
            <p class="boutique-contact"><span class="selectable">${esc(FS.config.contacts.phone)}</span><span>${esc(FS.config.contacts.hours)}</span></p>
          </div>
          <ul class="services">
            <li><h3>Подбор аромата</h3><p>Консультация в бутике или по телефону: по любимым нотам, сезону и поводу.</p></li>
            <li><h3>Пробник к заказу</h3><p>К каждому заказу кладём пробник аромата из той же семьи, чтобы познакомиться с новым.</p></li>
            <li><h3>Подарочная упаковка</h3><p>Фирменная коробка с лентой и открытка с вашим текстом без доплаты.</p></li>
            <li><h3>Оригинальная продукция</h3><p>Каждый флакон с документами о происхождении. Бесплатная доставка курьером от ${money(FS.config.freeShippingFrom)}.</p></li>
          </ul>
        </div>
      </section>`;
  }

  function mount(root) {
    const hero = root.querySelector('.hero--enter');
    if (hero) setTimeout(() => hero.classList.remove('hero--enter'), 3200);
  }

  return { render, mount, title: () => 'Бутик парфюмерии' };
})();
