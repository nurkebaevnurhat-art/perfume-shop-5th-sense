/* 5th SENSE — главная. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.home = (function () {
  const { esc, money, plural, card } = FS.ui;
  const P = (id) => FS.api.productSync(id);

  // Рисованный флакон с облаком распыления — ручная линия, как пометка на полях.
  const doodle = `<svg class="doodle" viewBox="0 0 120 70" aria-hidden="true" focusable="false">
    <path d="M18 62c-1-9 0-19 1-27 6-1 13-1 19 0 1 9 2 18 0 27-6 1-14 1-20 0z" />
    <path d="M23 35c0-4 0-7 1-9h9c1 2 1 5 1 9" /><path d="M24 26c0-3 1-6 4-6s5 2 5 6" />
    <path d="M37 23c6-3 10-3 14-1" /><circle cx="58" cy="20" r="1.3"/><circle cx="66" cy="15" r="1.1"/><circle cx="64" cy="25" r="1.2"/>
    <circle cx="74" cy="21" r="1"/><circle cx="72" cy="11" r="1"/><circle cx="82" cy="17" r="1.2"/><circle cx="80" cy="27" r="1"/>
    <path d="M86 30c6-2 10 2 14-1s7-7 13-5" /></svg>`;

  const tiles = [
    { id: 'niche', area: 't-niche', tone: 'blue', ids: ['baccarat-rouge-540', 'oud-wood', 'santal-33', 'aventus'], fill: ['ink', 'ink', 'ink', 'ink'] },
    { id: 'men', area: 't-men', ids: ['aventus', 'bleu-de-chanel', 'sauvage-edp'], fill: ['ink', 'ink', 'ink'] },
    { id: 'women', area: 't-women', ids: ['jadore', 'delina', 'coco-mademoiselle'], fill: ['ink', 'ink', 'ink'] },
    { id: 'unisex', area: 't-unisex', ids: ['gypsy-water', 'angels-share'], fill: ['ink', 'blue'] },
    { id: 'bestsellers', area: 't-best', ids: ['layton', 'baccarat-rouge-540', 'santal-33', 'coco-mademoiselle'], fill: ['ink', 'ink', 'ink', 'ink'] },
    { id: 'new', area: 't-new', ids: ['libre', 'erba-pura', 'angels-share', 'hacivat', 'acqua-di-gio-profondo'], fill: ['mute', 'mute', 'blue', 'mute', 'mute'] },
    { id: 'gifts', area: 't-gifts', ids: ['set-five-senses'], fill: ['blue'] }
  ];

  function tile(t) {
    const cat = FS.categories.find((c) => c.id === t.id);
    const count = FS.products.filter(cat.match).length;
    return `
      <a class="tile ${t.area} ${t.tone === 'blue' ? 'tile--blue' : ''}" href="#catalog-${cat.id}">
        <span class="tile-corner">${count} ${plural(count, 'аромат', 'аромата', 'ароматов')}</span>
        <span class="tile-art">${t.ids.map((id, i) => `<span class="tile-item tile-item--${t.fill[i]}">${FS.bottle.silhouette(P(id))}</span>`).join('')}</span>
        <span class="tile-foot">
          <span class="tile-name">${esc(cat.name)}</span>
          <span class="tile-lead">${esc(cat.lead)}</span>
        </span>
      </a>`;
  }

  function family(f, i) {
    const count = FS.products.filter((p) => p.family === f.id).length;
    return `
      <a class="story ${i % 3 === 1 ? 'story--ink' : ''}" href="#family-${f.id}" style="--i:${i}">
        <span class="story-count">${count} ${plural(count, 'аромат', 'аромата', 'ароматов')}</span>
        <span class="story-name">${esc(f.name)}</span>
        <span class="story-notes">${esc(f.notes)}</span>
      </a>`;
  }

  function render() {
    const best = FS.api.filter({ category: 'bestsellers' });
    const showcase = [best.find((p) => p.featured && p.type === 'perfume')].concat(best.filter((p) => !(p.featured && p.type === 'perfume'))).filter(Boolean).slice(0, 7);
    const fresh = FS.api.filter({ category: 'new', sort: 'new' });
    const total = FS.products.length;

    FS.ui.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: '5th SENSE',
      description: 'Premium Perfume Boutique: селективная и нишевая парфюмерия.',
      telephone: FS.config.contacts.phone,
      openingHours: 'Mo-Su 10:00-22:00'
    });

    return `
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-sheet">
          <p class="corner corner--tl">парфюмерный бутик<br>селективные и нишевые ароматы</p>
          <p class="corner corner--tr">аромат как способ<br>оставаться собой</p>
          <p class="corner corner--bl">${total} ${plural(total, 'аромат', 'аромата', 'ароматов')} в каталоге</p>
          <p class="corner corner--br">premium perfume boutique</p>
          <span class="vertical" aria-hidden="true">香り</span>

          <h1 id="hero-title" class="hero-mark">5<span class="logo-th">th</span> SENSE</h1>
          <div class="hero-stage">
            <span class="hero-shape rough" aria-hidden="true">${FS.bottle.silhouette(P('baccarat-rouge-540'))}</span>
            <p class="hero-slogan"><span>Аромат,</span> <span>который</span> <span>запоминают</span> <span>первым.</span></p>
          </div>
          <p class="hero-text">Бутик селективной и нишевой парфюмерии. Оригинальные ароматы мировых домов, консультация и бережная упаковка каждого флакона.</p>
          <div class="hero-actions">
            <a class="btn btn--primary" href="#catalog">Перейти в каталог</a>
            <a class="btn btn--outline" href="#aromaty">Исследовать ароматы</a>
          </div>
          ${doodle}
        </div>
      </section>

      <section class="section" id="vitriny" aria-labelledby="vitriny-title">
        <div class="section-head">
          <h2 id="vitriny-title">Коллекции</h2>
          <p>Каждая коллекция собрана, как отдельная витрина бутика.</p>
        </div>
        <div class="tiles">${tiles.map(tile).join('')}</div>
      </section>

      <section class="section" aria-labelledby="best-title">
        <div class="section-head section-head--row">
          <div>
            <h2 id="best-title">Бестселлеры</h2>
            <p>Ароматы, за которыми возвращаются в бутик.</p>
          </div>
          <a class="text-link" href="#catalog-bestsellers">Все бестселлеры</a>
        </div>
        <div class="shelf-grid">${showcase.map((p, i) => card(p, { wide: i === 0, index: i })).join('')}</div>
      </section>

      <section class="explore" id="aromaty" aria-labelledby="aromaty-title">
        <div class="explore-inner">
          <div class="explore-head">
            <span class="kanji" aria-hidden="true">香</span>
            <div class="explore-copy">
              <p class="explore-note">香, kaori: «аромат» по-японски</p>
              <h2 id="aromaty-title">Исследовать ароматы</h2>
              <p>Выберите семейство, которое вам ближе, и мы покажем ароматы с похожим характером.</p>
            </div>
          </div>
          <div class="stories">${FS.families.map(family).join('')}</div>
        </div>
      </section>

      <section class="section" aria-labelledby="new-title">
        <div class="section-head section-head--row">
          <div>
            <h2 id="new-title">Новинки</h2>
            <p>Последние поступления на полки бутика.</p>
          </div>
          <a class="text-link" href="#catalog-new">Все новинки</a>
        </div>
        <div class="rail" tabindex="0" aria-label="Новинки, прокрутите в сторону">${fresh.map((p, i) => card(p, { index: i })).join('')}</div>
      </section>

      <section class="manifesto" id="boutique" aria-labelledby="boutique-title">
        <div class="manifesto-poster">
          <span class="manifesto-block rough" aria-hidden="true"></span>
          <p class="manifesto-quote">Кто пахнет как&nbsp;все, теряет себя.</p>
        </div>
        <div class="manifesto-body">
          <div class="manifesto-copy">
            <h2 id="boutique-title">Бутик 5th SENSE</h2>
            <p>Мы собираем ароматы, которые не повторяют друг друга, и помогаем найти тот, что звучит именно на вас.</p>
            <p>Если сомневаетесь, позвоните консультанту. Он подберёт аромат по любимым нотам, сезону и поводу.</p>
            <p class="manifesto-contact"><span class="selectable">${esc(FS.config.contacts.phone)}</span><span>${esc(FS.config.contacts.hours)}</span></p>
          </div>
          <ul class="services">
            <li><h3>Подбор аромата</h3><p>Консультация в бутике или по телефону.</p></li>
            <li><h3>Пробник к заказу</h3><p>Кладём пробник аромата из той же семьи, чтобы познакомиться с новым.</p></li>
            <li><h3>Подарочная упаковка</h3><p>Фирменная коробка и открытка с вашим текстом без доплаты.</p></li>
            <li><h3>Оригинальная продукция</h3><p>Документы на каждый флакон. Курьер бесплатно от ${money(FS.config.freeShippingFrom)}.</p></li>
          </ul>
        </div>
      </section>`;
  }

  return { render, title: () => 'Бутик парфюмерии' };
})();
