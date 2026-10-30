/* 5th SENSE — адреса страниц и всё, что видят поисковики и мессенджеры:
   заголовок, описание, фото для превью ссылки, данные schema.org, карта сайта.
   Один файл для сайта и сервера (api/page.js, api/sitemap.js читают его через
   server/catalog.js), поэтому заголовки в поиске и на сайте всегда совпадают.
   Открытые страницы живут по обычным адресам (/catalog, /product-<id>, /brand-<бренд>),
   чтобы поисковики видели каждую отдельно; рабочие (корзина, админка, касса) — на якорях. */
window.FS = window.FS || {};

FS.seo = (function () {
  const BRAND = '5th SENSE';
  const PAGES = {
    delivery: ['Доставка и самовывоз', 'Курьер по городу в день заказа или самовывоз из бутика 5th SENSE. Стоимость и время подтверждает менеджер.'],
    gifts: ['Подарки за покупки', 'В бутике 5th SENSE каждая 4-я покупка — с подарком. Покупки считаем по номеру телефона.'],
    podbor: ['Подбор аромата', 'Пять коротких вопросов — и 5th SENSE покажет три аромата, которые стоит попробовать первыми. Пробники от 5 мл.'],
    terms: ['Условия заказа', 'Как оформить заказ в 5th SENSE: заявка на сайте, менеджер подтверждает наличие, цену, доставку и оплату.'],
    privacy: ['Политика конфиденциальности', 'Какие данные 5th SENSE получает при заказе и как их использует.'],
    returns: ['Возврат и обмен', 'Условия возврата и обмена парфюмерии в бутике 5th SENSE.']
  };
  const PUBLIC = /^(catalog|catalog-[a-z]+|family-[a-z]+|brands|brand-[a-z0-9-]+|product-[a-z0-9-]+|delivery|gifts|podbor|terms|privacy|returns)$/;

  // Страница, у которой есть свой адрес для поисковиков (главная — «/»).
  const isPublic = (token) => PUBLIC.test(token || '');
  const path = (token) => (!token || token === 'home' ? '/' : '/' + token);

  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  // Адрес страницы бренда: /brand-maison-francis-kurkdjian.
  function brandSlug(b) {
    return String(b || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9а-яё]+/g, '-').replace(/[а-яё]/g, (ch) => TRANSLIT[ch] || '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  const visible = (products) => (products || []).filter((p) => !p.hidden);
  const city = () => (FS.config.site && FS.config.site.city) || '';
  const withCity = (s) => (city() ? `${s}, ${city()}` : s);
  const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[\s,.;:—-]+\S*$/, '') + '…' : s; };
  const money = (n) => Number(n).toLocaleString('ru-RU').replace(/[\s,]/g, ' ') + ' ₸';
  const priced = (p) => (p.volumes || []).filter((v) => v.price > 0).sort((a, b) => a.ml - b.ml);
  const abs = (origin, url) => (!url ? '' : /^https?:/.test(url) ? url : origin + '/' + String(url).replace(/^\.?\//, ''));

  /* Всё для <head> страницы: { title, description, image, schema, found }.
     found: false — такой страницы нет (сервер ответит 404, поисковик её не возьмёт). */
  function meta(token, products, origin) {
    origin = origin || '';
    const list = visible(products);
    const t = token || 'home';
    const url = origin + path(t);
    const out = { title: '', description: '', image: abs(origin, 'assets/img/og-cover.jpg'), url, schema: null, found: true };
    let m;
    if (t === 'home') {
      out.title = withCity(`${BRAND} — нишевая и селективная парфюмерия на распив`);
      out.description = (city() ? `Парфюмерный бар 5th SENSE в ${city()}: ` : 'Парфюмерный бар 5th SENSE: ') + 'оригинальные селективные и нишевые ароматы на распив от 5 мл и полными флаконами. Подбор аромата, доставка и самовывоз.';
      out.schema = { '@context': 'https://schema.org', '@type': 'Store', name: BRAND, url, description: out.description, foundingDate: String(FS.config.founded || '') };
      const c = FS.config.contacts || {};
      if (c.phone && !/000/.test(c.phone)) out.schema.telephone = c.phone;
      if (c.address && !/config\.js/.test(c.address)) out.schema.address = c.address;
      if (city() && !out.schema.address) out.schema.address = { '@type': 'PostalAddress', addressLocality: city(), addressCountry: 'KZ' };
      return out;
    }
    if (t === 'catalog') {
      out.title = `${withCity('Каталог ароматов на распив')} | ${BRAND}`;
      out.description = `${list.length} оригинальных ароматов: распив 5, 10, 15 и 20 мл и полные флаконы. Ищите по бренду, названию или ноте.`;
    } else if ((m = t.match(/^catalog-([a-z]+)$/))) {
      const c = (FS.categories || []).find((x) => x.id === m[1]);
      if (!c) return { ...out, found: false, title: `Страница не найдена | ${BRAND}` };
      out.title = `${withCity(c.name + ' на распив')} | ${BRAND}`;
      out.description = `${c.lead} Распив от 5 мл и полные флаконы в бутике 5th SENSE.`;
    } else if ((m = t.match(/^family-([a-z]+)$/))) {
      const f = (FS.families || []).find((x) => x.id === m[1]);
      if (!f) return { ...out, found: false, title: `Страница не найдена | ${BRAND}` };
      out.title = `${f.name} ароматы на распив | ${BRAND}`;
      out.description = `${f.name} ароматы с нотами: ${f.notes}. Распив от 5 мл и полные флаконы в бутике 5th SENSE.`;
    } else if (t === 'brands') {
      const n = new Set(list.map((p) => p.brand)).size;
      out.title = `${withCity('Бренды парфюмерии')} | ${BRAND}`;
      out.description = `${n} парфюмерных домов в бутике 5th SENSE: селективная и нишевая парфюмерия на распив и полными флаконами.`;
    } else if ((m = t.match(/^brand-([a-z0-9-]+)$/))) {
      const items = list.filter((p) => brandSlug(p.brand) === m[1]);
      if (!items.length) return { ...out, found: false, title: `Бренд не найден | ${BRAND}` };
      const b = items[0].brand;
      out.title = `${b}: ароматы на распив | ${BRAND}`;
      out.description = `${b} в бутике 5th SENSE: ${cut(items.map((p) => p.name).join(', '), 90)}. Распив от 5 мл и полные флаконы.`;
      const img = items.find((p) => p.image);
      if (img) out.image = abs(origin, img.image);
    } else if ((m = t.match(/^product-([a-z0-9-]+)$/))) {
      const p = list.find((x) => x.id === m[1]);
      if (!p) return { ...out, found: false, title: `Аромат не найден | ${BRAND}` };
      const v = priced(p);
      const from = v.length ? `Распив от ${v[0].ml} мл — от ${money(v[0].price)}.` : 'Распив и полные флаконы.';
      out.title = `${p.brand} ${p.name} — распив | ${BRAND}`;
      out.description = cut(`${p.brand} ${p.name}${p.concentration ? ' ' + p.concentration : ''}. ${from} ${p.short || p.description || ''}`, 200);
      if (p.image) out.image = abs(origin, p.image);
      out.schema = {
        '@context': 'https://schema.org', '@type': 'Product', sku: p.id, name: `${p.brand} ${p.name}`, url,
        brand: { '@type': 'Brand', name: p.brand }, description: p.description || p.short || '',
        offers: v.map((x) => ({ '@type': 'Offer', sku: `${p.id}-${x.ml}`, name: `${p.name}, ${x.ml} мл`, price: x.price, priceCurrency: 'KZT', availability: 'https://schema.org/InStock', url }))
      };
      if (p.image) out.schema.image = out.image;
    } else if (PAGES[t]) {
      out.title = `${PAGES[t][0]} | ${BRAND}`;
      out.description = PAGES[t][1];
    } else {
      return { ...out, found: false, title: `Страница не найдена | ${BRAND}` };
    }
    return out;
  }

  // Все открытые страницы — для карты сайта (sitemap.xml).
  function tokens(products) {
    const list = visible(products);
    return ['home', 'catalog']
      .concat((FS.categories || []).map((c) => 'catalog-' + c.id))
      .concat((FS.families || []).filter((f) => list.some((p) => p.family === f.id)).map((f) => 'family-' + f.id))
      .concat(['brands'], [...new Set(list.map((p) => brandSlug(p.brand)))].filter(Boolean).map((s) => 'brand-' + s))
      .concat(list.map((p) => 'product-' + p.id))
      .concat(Object.keys(PAGES));
  }

  return { isPublic, path, brandSlug, meta, tokens };
})();
