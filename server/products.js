/* 5th SENSE — каталог на сервере (Upstash Redis).
   Пока каталог ни разу не сохраняли из админки, источник — assets/js/data.js.
   После первой загрузки таблицы или правки товара каталог хранится в Redis:
   его видят все покупатели, а сервер ведёт остатки (заказ списывает, отмена возвращает). */
const db = require('./db');
const catalog = require('./catalog');
const { HttpError } = require('./http');

const KEY = 'fs:products';
const META = 'fs:products:meta';
const IMAGES = 'fs:images';
const IMAGE_VERSIONS = 'fs:images:v';
const CHUNK = 40;

const GENDERS = ['men', 'women', 'unisex'];
const CONCENTRATIONS = ['EDP', 'EDT', 'Parfum', 'Extrait', 'Cologne', 'Set'];
const SHAPES = ['block', 'tower', 'cylinder', 'flask', 'facet', 'amphora', 'set'];
const parse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
const int = (v) => Math.floor(Number(v));
const words = (v) => (Array.isArray(v) ? v : []).map((x) => str(x, 60)).filter(Boolean).slice(0, 20);

/* Приводит товар к допустимому виду. Неизвестные поля отбрасываются,
   ошибки описываются понятным текстом. */
function normalize(p, pos) {
  const bad = (msg) => new HttpError(400, 'invalid_product', `Товар «${str(p && p.name, 60) || (p && p.id) || pos + 1}»: ${msg}`);
  if (!p || typeof p !== 'object') throw bad('нет данных');
  const id = str(p.id, 80);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw bad('некорректный артикул (латиница, цифры и дефис)');
  const name = str(p.name, 120);
  const brand = str(p.brand, 80);
  if (!name || !brand) throw bad('нужны бренд и название');
  const volumes = (Array.isArray(p.volumes) ? p.volumes : []).slice(0, 12).map((v) => {
    const out = { ml: Number(v && v.ml), price: int(v && v.price), stock: Math.max(0, int(v && v.stock) || 0) };
    if (v && v.label) out.label = str(v.label, 30);
    return out;
  });
  if (!volumes.length) throw bad('нет ни одного объёма');
  if (volumes.some((v) => !(v.ml > 0) || !(v.price > 0))) throw bad('у каждого объёма должны быть миллилитры и цена больше нуля');
  if (new Set(volumes.map((v) => v.ml)).size !== volumes.length) throw bad('объёмы повторяются');
  volumes.sort((a, b) => a.ml - b.ml);
  const notes = p.notes || {};
  const b = p.bottle || {};
  const image = str(p.image, 300);
  const out = {
    id, type: p.type === 'set' ? 'set' : 'perfume', name, brand,
    gender: GENDERS.includes(p.gender) ? p.gender : 'unisex',
    family: str(p.family, 30) || 'woody',
    concentration: CONCENTRATIONS.includes(p.concentration) ? p.concentration : 'EDP',
    volumes,
    main: volumes.some((v) => v.ml === Number(p.main)) ? Number(p.main) : volumes[Math.floor((volumes.length - 1) / 2)].ml,
    short: str(p.short, 160),
    description: str(p.description, 2000),
    notes: { top: words(notes.top), heart: words(notes.heart), base: words(notes.base) },
    longevity: Math.min(5, Math.max(1, int(p.longevity) || 3)),
    sillage: Math.min(5, Math.max(1, int(p.sillage) || 3)),
    bottle: {
      shape: SHAPES.includes(b.shape) ? b.shape : 'block',
      cap: str(b.cap, 20) || 'cube',
      liquid: /^#[0-9a-f]{6}$/i.test(b.liquid) ? b.liquid : '#c9a46a',
      capColor: str(b.capColor, 20) || 'gold',
      label: str(b.label, 20)
    },
    pos
  };
  if (b.count) out.bottle.count = Math.min(6, Math.max(1, int(b.count)));
  ['niche', 'bestseller', 'isNew', 'featured'].forEach((k) => { if (p[k]) out[k] = true; });
  const year = int(p.year);
  if (year > 1700 && year < 2200) out.year = year;
  if (p.country) out.country = str(p.country, 60);
  if (p.perfumer) out.perfumer = str(p.perfumer, 120);
  if (p.photo) out.photo = str(p.photo, 120).toLowerCase();
  // Фото: файл сайта (assets/products) или загруженное в админке (/api/image).
  if (/^assets\/products\/[\w.-]+$/.test(image) || /^\/api\/image\?[\w=&%.-]+$/.test(image)) out.image = image;
  return out;
}

async function stored() {
  if (!db.configured()) return null;
  const flat = (await db.command('HGETALL', KEY)) || [];
  if (!flat.length) return null;
  const items = [];
  for (let i = 1; i < flat.length; i += 2) { const p = parse(flat[i]); if (p) items.push(p); }
  return items.sort((a, b) => (a.pos || 0) - (b.pos || 0));
}

const fromFile = () => JSON.parse(JSON.stringify([...catalog.load().products.values()]));

async function list() { return (await stored()) || fromFile(); }
async function map() { return new Map((await list()).map((p) => [p.id, p])); }
async function meta() { return db.configured() ? parse(await db.command('GET', META)) : null; }

async function writeAll(items) {
  await db.command('DEL', KEY);
  for (let i = 0; i < items.length; i += CHUNK) {
    const args = ['HSET', KEY];
    items.slice(i, i + CHUNK).forEach((p) => args.push(p.id, JSON.stringify(p)));
    await db.command(...args);
  }
  const m = { version: Date.now(), count: items.length, updatedAt: new Date().toISOString() };
  await db.command('SET', META, JSON.stringify(m));
  return m;
}

async function touch() {
  const m = { ...((await meta()) || {}), version: Date.now(), updatedAt: new Date().toISOString() };
  m.count = Number(await db.command('HLEN', KEY));
  await db.command('SET', META, JSON.stringify(m));
  return m;
}

// Фото ищем по имени без расширения: «oud.jpg» в таблице подойдёт к загруженному «oud.png».
const stemOf = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '');
const imageUrl = (stem, v) => `/api/image?n=${encodeURIComponent(stem)}&v=${v}`;

// Подставляет загруженные фото по имени файла (колонка «Фото» в таблице).
async function resolvePhotos(items) {
  const stems = [...new Set(items.map((p) => stemOf(p.photo)).filter(Boolean))];
  if (!stems.length) return items;
  const versions = await db.command('HMGET', IMAGE_VERSIONS, ...stems);
  const byStem = new Map(stems.map((n, i) => [n, versions[i]]));
  return items.map((p) => {
    if (!p.photo) return p;
    const v = byStem.get(stemOf(p.photo));
    if (v) return { ...p, image: imageUrl(stemOf(p.photo), v) };
    if (p.image && p.image.toLowerCase().endsWith('/' + p.photo)) return p;
    const { image, ...rest } = p;
    return rest;
  });
}

function requireStorage() {
  if (!db.configured()) throw new HttpError(503, 'storage_not_configured', 'Хранилище не подключено');
}

async function replace(input) {
  requireStorage();
  if (!Array.isArray(input) || !input.length) throw new HttpError(400, 'invalid', 'Каталог пуст');
  if (input.length > 3000) throw new HttpError(400, 'invalid', 'Слишком много товаров за раз (больше 3000)');
  const items = input.map((p, i) => normalize(p, i));
  const ids = new Set();
  items.forEach((p) => {
    if (ids.has(p.id)) throw new HttpError(400, 'invalid', `Артикул «${p.id}» повторяется`);
    ids.add(p.id);
  });
  return writeAll(await resolvePhotos(items));
}

async function upsert(input) {
  requireStorage();
  const current = await list();
  if (!(await stored())) await writeAll(current); // первая правка: переносим каталог из data.js на сервер
  const existing = current.find((p) => p.id === (input && input.id));
  const pos = existing ? existing.pos : -Date.now(); // новый товар — в начало списка
  const [p] = await resolvePhotos([normalize(input, pos)]);
  await db.command('HSET', KEY, p.id, JSON.stringify(p));
  return { product: p, meta: await touch() };
}

async function remove(id) {
  requireStorage();
  if (!(await stored())) await writeAll(await list());
  await db.command('HDEL', KEY, String(id));
  return touch();
}

async function reset() {
  requireStorage();
  await db.command('DEL', KEY, META);
}

/* Остатки: sign = -1 списать (заказ), +1 вернуть (отмена).
   Работает, только когда каталог хранится на сервере. */
async function moveStock(items, sign) {
  if (!db.configured() || !(await stored())) return false;
  for (const item of items) {
    const p = parse(await db.command('HGET', KEY, item.id));
    const v = p && p.volumes.find((x) => x.ml === item.ml);
    if (!v) continue;
    v.stock = Math.max(0, v.stock + sign * item.qty);
    await db.command('HSET', KEY, p.id, JSON.stringify(p));
  }
  await touch();
  return true;
}

/* ---------- Фото, загруженные в админке ---------- */
const imageName = (n) => str(n, 120).toLowerCase().split(/[\\/]/).pop().replace(/[^a-z0-9._-]+/g, '-');

async function saveImage(name, type, base64) {
  requireStorage();
  const n = imageName(name);
  if (!n || !/\.(jpe?g|png|webp)$/.test(n)) throw new HttpError(400, 'invalid', 'Нужен файл JPG, PNG или WebP');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new HttpError(400, 'invalid', 'Нужен файл JPG, PNG или WebP');
  const size = Math.floor(String(base64 || '').length * 3 / 4);
  if (!size || size > 600 * 1024) throw new HttpError(413, 'too_large', 'Фото больше 600 КБ');
  const v = Date.now().toString(36);
  const stem = stemOf(n);
  await db.command('HSET', IMAGES, stem, JSON.stringify({ type, data: base64 }));
  await db.command('HSET', IMAGE_VERSIONS, stem, v);
  const url = imageUrl(stem, v);
  // Товары, у которых в таблице указано это фото, сразу его получают.
  let linked = 0;
  const items = await stored();
  if (items) {
    // По колонке «Фото» или, если фото не указано, по артикулу (oud-wood.jpg → товар oud-wood).
    for (const p of items.filter((x) => stemOf(x.photo) === stem || (!x.photo && x.id === stem))) {
      p.photo = p.photo || n;
      p.image = url;
      await db.command('HSET', KEY, p.id, JSON.stringify(p));
      linked++;
    }
    if (linked) await touch();
  }
  return { name: n, url, linked };
}

async function getImage(name) {
  if (!db.configured()) return null;
  return parse(await db.command('HGET', IMAGES, stemOf(imageName(name))));
}

module.exports = { list, map, stored, meta, replace, upsert, remove, reset, moveStock, saveImage, getImage, normalize };
