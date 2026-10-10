/* 5th SENSE — загрузка каталога из таблицы Excel/CSV и выгрузка обратно.
   Формат — шаблон assets/files/5th-sense-catalog.xlsx: одна строка = один объём
   аромата. Таблицы читает библиотека SheetJS, она загружается только когда
   в админке нажимают «Загрузить таблицу» или «Скачать таблицу». */
window.FS = window.FS || {};

FS.importer = (function () {
  const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  let loading = null;

  function lib() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SHEETJS;
        s.onload = () => resolve(window.XLSX);
        s.onerror = () => { loading = null; reject(new Error('Не удалось загрузить модуль для таблиц. Проверьте интернет.')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  /* ---------- Колонки ---------- */
  const COLUMNS = [
    ['id', 'Артикул', ['артикул', 'id', 'sku', 'код']],
    ['brand', 'Бренд', ['бренд', 'brand', 'марка', 'производитель']],
    ['name', 'Название', ['название', 'наименование', 'аромат', 'name', 'товар']],
    ['concentration', 'Концентрация', ['концентрация', 'тип', 'concentration']],
    ['gender', 'Пол', ['пол', 'gender', 'для кого']],
    ['ml', 'Объём, мл', ['объём', 'объем', 'мл', 'volume', 'объём, мл', 'объем, мл']],
    ['price', 'Цена, ₸', ['цена', 'price', 'стоимость', 'цена, ₸', 'цена, тг']],
    ['stock', 'Остаток, шт.', ['остаток', 'остатки', 'количество', 'кол-во', 'stock', 'наличие', 'остаток, шт.']],
    ['family', 'Семейство', ['семейство', 'группа', 'family']],
    ['top', 'Верхние ноты', ['верхние ноты', 'верхние', 'top']],
    ['heart', 'Ноты сердца', ['ноты сердца', 'сердце', 'средние ноты', 'heart']],
    ['base', 'Базовые ноты', ['базовые ноты', 'база', 'шлейф', 'base']],
    ['short', 'Кратко', ['кратко', 'коротко', 'краткое описание', 'short']],
    ['description', 'Описание', ['описание', 'description']],
    ['niche', 'Нишевая', ['нишевая', 'ниша', 'niche']],
    ['bestseller', 'Бестселлер', ['бестселлер', 'хит', 'bestseller']],
    ['isNew', 'Новинка', ['новинка', 'new']],
    ['year', 'Год', ['год', 'год выпуска', 'year']],
    ['country', 'Страна', ['страна', 'country']],
    ['perfumer', 'Парфюмер', ['парфюмер', 'автор', 'perfumer']],
    ['photo', 'Фото', ['фото', 'фотография', 'изображение', 'photo', 'image']]
  ];
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const ALIASES = new Map();
  COLUMNS.forEach(([key, , names]) => names.forEach((n) => ALIASES.set(norm(n), key)));

  function headerMap(row) {
    const map = {};
    row.forEach((cell, i) => {
      const h = norm(cell);
      const key = ALIASES.get(h) || ALIASES.get(h.split(',')[0].trim()) || ALIASES.get(h.split('(')[0].trim());
      if (key && map[key] === undefined) map[key] = i;
    });
    return map;
  }

  /* ---------- Значения ---------- */
  const text = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  // «139 000 ₸», «139.000», «7,5 мл» → 139000, 139000, 7.5
  const number = (v) => {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).replace(/[\s ]/g, '').replace(/[^\d,.-]/g, '');
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
    else s = s.replace(',', '.');
    return s ? Number(s) : NaN;
  };
  const yes = (v) => /^(да|yes|1|true|\+|x|х|✓)$/i.test(text(v));
  const words = (v) => text(v).split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);

  function gender(v) {
    const s = norm(v);
    if (!s) return null;
    if (/^(муж|m$|men|male)/.test(s)) return 'men';
    if (/^(жен|w$|f$|women|female)/.test(s)) return 'women';
    if (/^(уни|u$|unisex)/.test(s)) return 'unisex';
    return undefined;
  }
  function concentration(v) {
    const s = norm(v).replace(/[^a-zа-я ]/g, '');
    if (!s) return null;
    if (/extrait|экстракт/.test(s)) return 'Extrait';
    if (/edp|eau de parfum|парфюмерн/.test(s)) return 'EDP';
    if (/edt|eau de toilette|туалетн/.test(s)) return 'EDT';
    if (/edc|cologne|одеколон/.test(s)) return 'Cologne';
    if (/parfum|perfume|духи/.test(s)) return 'Parfum';
    return undefined;
  }
  function family(v) {
    const s = norm(v);
    if (!s) return null;
    const f = FS.families.find((x) => norm(x.name) === s || x.id === s || norm(x.name).slice(0, 5) === s.slice(0, 5));
    return f ? f.id : undefined;
  }

  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] || '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  const SHAPES = ['block', 'tower', 'cylinder', 'flask', 'facet', 'amphora'];
  function defaultBottle(p) {
    const fam = FS.families.find((f) => f.id === p.family);
    let h = 0;
    for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { shape: SHAPES[h % SHAPES.length], cap: 'cube', liquid: fam ? fam.tint : '#c9a46a', capColor: 'gold', label: p.brand.toUpperCase().slice(0, 14) };
  }

  /* ---------- Таблица → товары ---------- */
  // rows — массив строк (массивов ячеек), первая непустая строка с колонками «Бренд»/«Название» — заголовок.
  function toProducts(rows, existing) {
    const errors = [];
    const warnings = [];
    const headIdx = rows.findIndex((r) => { const m = headerMap(r || []); return m.brand !== undefined && m.name !== undefined; });
    if (headIdx < 0) return { errors: ['Не нашли строку заголовков: нужны колонки «Бренд» и «Название». Используйте шаблон.'], warnings, products: [] };
    const col = headerMap(rows[headIdx]);
    ['ml', 'price'].forEach((k) => { if (col[k] === undefined) errors.push(`Нет колонки «${COLUMNS.find((c) => c[0] === k)[1]}».`); });
    if (errors.length) return { errors, warnings, products: [] };
    const has = (k) => col[k] !== undefined;
    const byId = new Map(existing.map((p) => [p.id, p]));
    const byKey = new Map(existing.map((p) => [slug(`${p.brand} ${p.name} ${p.concentration || ''}`), p]));
    const groups = new Map();

    rows.slice(headIdx + 1).forEach((r, i) => {
      const line = headIdx + i + 2; // номер строки как в Excel
      const get = (k) => (has(k) ? r[col[k]] : undefined);
      if (!r || r.every((c) => text(c) === '')) return;
      const brand = text(get('brand'));
      const name = text(get('name'));
      if (!brand || !name) { errors.push(`Строка ${line}: нет бренда или названия.`); return; }
      const conc = concentration(get('concentration'));
      if (conc === undefined) warnings.push(`Строка ${line}: концентрация «${text(get('concentration'))}» не распознана, поставили EDP.`);
      let id = slug(text(get('id')));
      const key = slug(`${brand} ${name} ${conc || 'EDP'}`);
      if (!id) id = (byKey.get(key) || {}).id || slug(`${brand} ${name}${conc && conc !== 'EDP' ? ' ' + conc : ''}`);
      if (!id) { errors.push(`Строка ${line}: не получилось составить артикул.`); return; }
      const ml = number(get('ml'));
      const price = Math.round(number(get('price')));
      const stockRaw = get('stock');
      const stock = text(stockRaw) === '' ? 0 : Math.floor(number(stockRaw));
      if (!(ml > 0)) { errors.push(`Строка ${line} (${name}): объём должен быть числом больше нуля.`); return; }
      if (!(price > 0)) { errors.push(`Строка ${line} (${name}): цена должна быть числом больше нуля.`); return; }
      if (!(stock >= 0)) { errors.push(`Строка ${line} (${name}): остаток должен быть числом.`); return; }
      if (!groups.has(id)) groups.set(id, { id, line, rows: [] });
      const g = groups.get(id);
      if (g.rows.some((x) => x.ml === ml)) { errors.push(`Строка ${line} (${name}): объём ${ml} мл уже есть в строке ${g.rows.find((x) => x.ml === ml).line}.`); return; }
      g.rows.push({ line, ml, price, stock, brand, name, conc, cells: (k) => get(k) });
    });

    const products = [];
    groups.forEach((g) => {
      const first = (k) => { for (const row of g.rows) { const v = row.cells(k); if (text(v) !== '') return v; } return undefined; };
      const base = byId.get(g.id) ? JSON.parse(JSON.stringify(byId.get(g.id))) : null;
      const r0 = g.rows[0];
      const p = base || { id: g.id, type: 'perfume', longevity: 3, sillage: 3, notes: { top: [], heart: [], base: [] } };
      p.brand = r0.brand;
      p.name = r0.name;
      p.concentration = r0.conc || p.concentration || 'EDP';
      const gd = gender(first('gender'));
      if (gd === undefined) warnings.push(`Строка ${r0.line} (${r0.name}): пол «${text(first('gender'))}» не распознан.`);
      p.gender = gd || p.gender || 'unisex';
      if (!gd && !base) warnings.push(`Строка ${r0.line} (${r0.name}): не указан пол, поставили «Унисекс».`);
      const fm = family(first('family'));
      if (fm === undefined) warnings.push(`Строка ${r0.line} (${r0.name}): семейство «${text(first('family'))}» не найдено в списке.`);
      p.family = fm || p.family || 'woody';
      ['top', 'heart', 'base'].forEach((k) => { if (has(k) && text(first(k))) p.notes[k] = words(first(k)); });
      ['short', 'description', 'country', 'perfumer'].forEach((k) => { if (has(k) && text(first(k))) p[k] = text(first(k)); });
      ['niche', 'bestseller', 'isNew'].forEach((k) => { if (has(k)) { if (yes(first(k))) p[k] = true; else delete p[k]; } });
      if (has('year') && Number(first('year')) > 1700) p.year = Number(first('year'));
      p.volumes = g.rows.map((x) => {
        const old = base && base.volumes.find((v) => v.ml === x.ml);
        const v = { ml: x.ml, price: x.price, stock: x.stock };
        if (old && old.label) v.label = old.label;
        return v;
      }).sort((a, b) => a.ml - b.ml);
      if (!p.volumes.some((v) => v.ml === p.main)) p.main = p.volumes[Math.floor((p.volumes.length - 1) / 2)].ml;
      if (!p.short) {
        const n = [...p.notes.top, ...p.notes.heart, ...p.notes.base].slice(0, 4);
        p.short = n.length ? `Ноты: ${n.join(', ')}.` : '';
      }
      const photo = has('photo') ? text(first('photo')).toLowerCase().split(/[\\/]/).pop() : '';
      if (photo) {
        p.photo = photo;
        if (p.image && !p.image.toLowerCase().endsWith('/' + photo) && !p.image.includes('n=' + encodeURIComponent(photo))) delete p.image;
      }
      if (!p.bottle) p.bottle = defaultBottle(p);
      products.push(p);
    });
    return { errors, warnings, products };
  }

  /* ---------- Что изменится ---------- */
  // Фото сравниваем по имени файла: путь к картинке на сайте и на сервере разный.
  const photoName = (p) => (p.photo || (p.image || '').split(/[/=&]/).filter((x) => /\.\w+$/.test(x)).pop() || '').toLowerCase();
  const comparable = (p) => JSON.stringify({ ...p, pos: undefined, image: undefined, photo: photoName(p) });
  function diff(current, next) {
    const before = new Map(current.map((p) => [p.id, p]));
    const after = new Set(next.map((p) => p.id));
    const added = next.filter((p) => !before.has(p.id));
    const changed = next.filter((p) => before.has(p.id) && comparable(before.get(p.id)) !== comparable(p));
    const removed = current.filter((p) => !after.has(p.id));
    return { added, changed, removed, same: next.length - added.length - changed.length };
  }

  /* ---------- Файл → строки ---------- */
  async function read(file) {
    const XLSX = await lib();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    // Лист «Товары» из шаблона, иначе первый лист с нужными колонками.
    const names = wb.SheetNames.slice().sort((a, b) => (b === 'Товары') - (a === 'Товары'));
    for (const n of names) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
      if (rows.some((r) => { const m = headerMap(r); return m.brand !== undefined && m.name !== undefined; })) return rows;
    }
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  }

  /* ---------- Товары → таблица (для правки и повторной загрузки) ---------- */
  async function exportFile(products) {
    const XLSX = await lib();
    const fam = (id) => (FS.families.find((f) => f.id === id) || {}).name || '';
    const head = COLUMNS.map((c) => c[1]);
    const rows = [head];
    products.forEach((p) => p.volumes.forEach((v, i) => {
      const f = i === 0;
      const photo = p.photo || (p.image && p.image.startsWith('assets/') ? p.image.split('/').pop() : '');
      rows.push([
        p.id, p.brand, p.name, p.concentration || '', FS.genderLabel[p.gender] || '', v.ml, v.price, v.stock,
        f ? fam(p.family) : '', f ? p.notes.top.join(', ') : '', f ? p.notes.heart.join(', ') : '', f ? p.notes.base.join(', ') : '',
        f ? p.short || '' : '', f ? p.description || '' : '',
        f && p.niche ? 'да' : '', f && p.bestseller ? 'да' : '', f && p.isNew ? 'да' : '',
        f ? p.year || '' : '', f ? p.country || '' : '', f ? p.perfumer || '' : '', f ? photo : ''
      ]);
    }));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [22, 24, 26, 12, 11, 10, 11, 11, 13, 28, 28, 28, 40, 60, 9, 10, 9, 7, 13, 22, 28].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');
    XLSX.writeFile(wb, `5th-sense-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return { read, toProducts, diff, exportFile, slug };
})();
