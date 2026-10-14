/* 5th SENSE — загрузка каталога из таблицы Excel/CSV и выгрузка обратно.
   Формат — шаблон assets/files/5th-sense-catalog.xlsx: одна строка = один аромат,
   цена задаётся за 1 мл, цены объёмов распива считаются умножением (плюс поправка по объёмам из админки).
   Старый формат (одна строка = один объём, колонки «Объём» и «Цена») тоже читается. Таблицы читает библиотека SheetJS, она загружается только когда
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
    ['perMl', 'Цена за 1 мл, ₸', ['цена за 1 мл', 'цена за мл', 'цена 1 мл', 'за 1 мл', '1 мл', 'per ml', 'perml']],
    ['mls', 'Объёмы, мл', ['объёмы', 'объемы', 'объёмы распива', 'объемы распива', 'volumes']],
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
    ['photo', 'Фото', ['фото', 'фотография', 'изображение', 'photo', 'image']],
    ['hidden', 'Скрыть с сайта', ['скрыть с сайта', 'скрыть', 'скрыт', 'скрыт с сайта', 'hidden']],
    ['fullMl', 'Полный флакон, мл', ['полный флакон, мл', 'полный флакон', 'флакон, мл', 'объём флакона', 'объем флакона', 'full']]
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
  // «5, 10, 15, 20» → [5, 10, 15, 20]; пусто → объёмы по умолчанию.
  function mlList(v) {
    if (typeof v === 'number') return v > 0 ? [v] : null;
    const s = text(v);
    if (!s) return FS.config.decants.volumes.slice();
    const list = s.replace(/мл/gi, '').split(/[;,\s/]+/).filter(Boolean).map(Number);
    if (!list.length || list.some((x) => !(x > 0))) return null;
    return [...new Set(list)].sort((a, b) => a - b);
  }
  // Остаток: одно число на все объёмы или по объёмам «5: 3, 10: 2». null — не разобрали.
  function stockList(v, mls) {
    const s = text(v);
    if (typeof v === 'number' || /^\d+$/.test(s) || !s) {
      const n = s ? Math.floor(Number(v)) : 0;
      return n >= 0 ? new Map(mls.map((ml) => [ml, n])) : null;
    }
    const pairs = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:мл)?\s*[:=—–-]\s*(\d+)/gi)];
    if (!pairs.length) return null;
    const map = new Map(mls.map((ml) => [ml, 0]));
    pairs.forEach((m) => { const ml = Number(m[1].replace(',', '.')); if (map.has(ml)) map.set(ml, Number(m[2])); });
    return map;
  }
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
    // Новый формат: «Цена за 1 мл», одна строка на аромат. Старый: строка на каждый объём.
    const perMlMode = col.perMl !== undefined;
    if (!perMlMode) ['ml', 'price'].forEach((k) => { if (col[k] === undefined) errors.push(`Нет колонки «${k === 'price' ? 'Цена за 1 мл, ₸' : COLUMNS.find((c) => c[0] === k)[1]}».`); });
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
      if (perMlMode) {
        const per = number(get('perMl'));
        if (!(per > 0)) { errors.push(`Строка ${line} (${name}): цена за 1 мл должна быть числом больше нуля.`); return; }
        const mls = mlList(get('mls'));
        if (!mls) { errors.push(`Строка ${line} (${name}): объёмы напишите числами через запятую, например 5, 10, 15, 20.`); return; }
        // Остатки не ведём — колонку «Остаток» не читаем, все объёмы доступны.
        const stock = FS.api.tracking() ? stockList(get('stock'), mls) : new Map(mls.map((ml) => [ml, 99]));
        if (!stock) { errors.push(`Строка ${line} (${name}): остаток — одно число (на каждый объём) или по объёмам, например «5: 3, 10: 2».`); return; }
        if (groups.has(id)) { errors.push(`Строка ${line} (${name}): этот аромат уже есть в строке ${groups.get(id).line}.`); return; }
        const perMl = Math.round(per * 100) / 100;
        groups.set(id, { id, line, perMl, rows: mls.map((ml) => ({ line, ml, price: FS.api.priceFor(perMl, ml), stock: stock.get(ml), brand, name, conc, cells: (k) => get(k) })) });
        return;
      }
      const ml = number(get('ml'));
      const price = Math.round(number(get('price')));
      const stockRaw = get('stock');
      const stock = !FS.api.tracking() ? 99 : text(stockRaw) === '' ? 0 : Math.floor(number(stockRaw));
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
      ['niche', 'bestseller', 'isNew', 'hidden'].forEach((k) => { if (has(k)) { if (yes(first(k))) p[k] = true; else delete p[k]; } });
      if (has('year') && Number(first('year')) > 1700) p.year = Number(first('year'));
      if (has('fullMl')) { const f = number(first('fullMl')); if (f > 0) p.fullMl = f; else delete p.fullMl; }
      // Цена за 1 мл: в старом формате цены объёмов заданы вручную, формулу убираем.
      if (g.perMl) p.perMl = g.perMl; else delete p.perMl;
      // Поправка по объёмам в таблице не задаётся: у известного аромата остаётся прежней,
      // новый получает поправку своего бренда (или общую).
      const adj = FS.api.cleanAdj(base ? base.volAdj : FS.api.adjFor(existing, p.brand));
      if (g.perMl && Object.keys(adj).length) p.volAdj = adj; else delete p.volAdj;
      p.volumes = g.rows.map((x) => {
        const old = base && base.volumes.find((v) => v.ml === x.ml);
        const v = { ml: x.ml, price: g.perMl ? FS.api.priceOf(p, g.perMl, x.ml) : x.price, stock: x.stock };
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
  // Порядок полей не важен: сравниваем по отсортированным ключам.
  const sorted = (x) => (Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object'
    ? Object.keys(x).sort().reduce((o, k) => { if (x[k] !== undefined) o[k] = sorted(x[k]); return o; }, {}) : x);
  const comparable = (p) => JSON.stringify(sorted({ ...p, pos: undefined, image: undefined, photo: photoName(p) }));
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
  // Одна строка на аромат. Колонки «Цена N мл» — формулы Excel для проверки, при загрузке не читаются.
  async function exportFile(products) {
    const XLSX = await lib();
    const fam = (id) => (FS.families.find((f) => f.id === id) || {}).name || '';
    const shown = FS.config.decants.volumes;
    const track = FS.api.tracking();
    const head = ['Артикул', 'Бренд *', 'Название *', 'Концентрация', 'Пол *', 'Цена за 1 мл, ₸ *',
      ...shown.map((ml) => `Цена ${ml} мл`), 'Объёмы, мл', ...(track ? ['Остаток, шт.'] : []), 'Семейство', 'Верхние ноты', 'Ноты сердца', 'Базовые ноты',
      'Кратко', 'Описание', 'Нишевая', 'Бестселлер', 'Новинка', 'Год', 'Страна', 'Парфюмер', 'Фото', 'Полный флакон, мл', 'Скрыть с сайта'];
    const rows = [head];
    products.forEach((p) => {
      const photo = p.photo || (p.image && p.image.startsWith('assets/') ? p.image.split('/').pop() : '');
      const vols = p.volumes.slice().sort((a, b) => a.ml - b.ml);
      const stocks = vols.map((v) => v.stock);
      const stock = stocks.every((x) => x === stocks[0]) ? stocks[0] : vols.map((v) => `${v.ml}: ${v.stock}`).join(', ');
      const mls = vols.map((v) => v.ml).join(', ');
      rows.push([
        p.id, p.brand, p.name, p.concentration || '', FS.genderLabel[p.gender] || '', FS.api.perMl(p),
        ...shown.map(() => ''), mls === shown.join(', ') ? '' : mls, ...(track ? [stock] : []),
        fam(p.family), p.notes.top.join(', '), p.notes.heart.join(', '), p.notes.base.join(', '),
        p.short || '', p.description || '', p.niche ? 'да' : '', p.bestseller ? 'да' : '', p.isNew ? 'да' : '',
        p.year || '', p.country || '', p.perfumer || '', photo, p.fullMl || '', p.hidden ? 'да' : ''
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Формулы «цена за 1 мл × объём» (с поправкой объёма — округление до 10 ₸), чтобы цены были видны прямо в таблице.
    for (let r = 1; r < rows.length; r++) {
      const p = products[r - 1];
      shown.forEach((ml, i) => {
        const ref = XLSX.utils.encode_cell({ r, c: 6 + i });
        const a = FS.api.adjOf(p, ml);
        const f = a ? `ROUND(F${r + 1}*${ml}*${Math.round((1 + a / 100) * 1000) / 1000},-1)` : `ROUND(F${r + 1}*${ml},0)`;
        ws[ref] = { t: 'n', f, v: FS.api.priceOf(p, rows[r][5], ml) };
      });
    }
    ws['!cols'] = [22, 24, 26, 12, 11, 12, ...shown.map(() => 10), 14, ...(track ? [12] : []), 13, 28, 28, 28, 40, 60, 9, 10, 9, 7, 13, 22, 28, 14, 12].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');
    XLSX.writeFile(wb, `5th-sense-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /* ---------- Заказы → таблица для учёта ---------- */
  // Лист «Заказы» — строка на заказ, лист «Позиции» — строка на каждый аромат в заказе.
  async function exportOrders(orders, fileName, names) {
    const XLSX = await lib();
    const date = (s) => { const d = new Date(s); return Number.isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    const who = (o) => `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim();
    const sorted = orders.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const head = ['Номер', 'Дата', 'Статус', 'Оплата', 'Покупатель', 'Телефон', 'Email', 'Состав', 'Товары, ₸', 'Доставка, ₸', 'Итого, ₸', 'Оплачено, ₸', 'Доставка', 'Адрес', 'Способ оплаты', 'Комментарий', 'Тест'];
    const rows = [head].concat(sorted.map((o) => [
      o.number, date(o.createdAt), names.status(o.status), o.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен',
      who(o), o.customer.phone || '', o.customer.email || '',
      o.items.map((i) => (i.full ? `${i.brand} ${i.name} — полноразмерный флакон × ${i.qty}` : `${i.brand} ${i.name} ${i.ml} мл × ${i.qty}`)).join('; '),
      o.subtotal, o.shipping === null || o.shipping === undefined ? '' : o.shipping, o.total, o.paidAmount || '',
      (o.delivery && o.delivery.name) || '', o.delivery && o.delivery.id === 'pickup' ? '' : [o.customer.city, o.customer.address].filter(Boolean).join(', '),
      (o.payment && o.payment.name) || '', o.comment || '', o.test ? 'да' : ''
    ]));
    const items = [['Номер заказа', 'Дата', 'Статус', 'Бренд', 'Аромат', 'Объём', 'Кол-во', 'Цена, ₸', 'Сумма, ₸']];
    sorted.forEach((o) => o.items.forEach((i) => items.push([
      o.number, date(o.createdAt), names.status(o.status), i.brand, i.name,
      i.full ? `флакон${i.fullMl ? ` ${i.fullMl} мл` : ''}` : `${i.ml} мл`, i.qty,
      i.full ? '' : i.price, i.full ? 'по запросу' : i.price * i.qty
    ])));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [10, 16, 18, 11, 22, 15, 22, 60, 11, 11, 11, 11, 24, 32, 26, 30, 6].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Заказы');
    const wi = XLSX.utils.aoa_to_sheet(items);
    wi['!cols'] = [12, 16, 18, 22, 28, 12, 7, 10, 11].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wi, 'Позиции');
    XLSX.writeFile(wb, fileName);
  }

  return { read, toProducts, diff, exportFile, exportOrders, slug };
})();
