/* 5th SENSE — подарки за покупки.
   Клиент — это номер телефона. Покупки: выполненные заказы с сайта и покупки
   вне сайта, которые сотрудники вносят в админке или через бота.
   Каждая N-я покупка (по умолчанию 4-я) — с подарком; подарок зависит от суммы
   N−1 предыдущих покупок. Покупатель знает только правило «каждая 4-я — с
   подарком», уровни и суммы видят владелец и сотрудники. */
const crypto = require('node:crypto');
const db = require('./db');
const { HttpError } = require('./http');

const SETTINGS = 'fs:loyalty:settings';
const INDEX = 'fs:loyalty:clients'; // set телефонов
const INIT = 'fs:loyalty:init';
const key = (phone) => `fs:loyalty:client:${phone}`;
const parse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

const DEFAULTS = {
  every: 4,
  tiers: [
    { upTo: 50000, gift: 'Распив 5 мл' },
    { upTo: 120000, gift: 'Распив 10 мл' },
    { upTo: 250000, gift: 'Распив 20 мл' },
    { upTo: null, gift: 'Особый подарок от бутика' }
  ],
  notify: 'all', // 'all' — все сотрудники, 'owner' — только чат владельца
  ownerChat: null
};

// «8 701 123-45-67», «+7 (701) 1234567», «7011234567» → «77011234567».
function phoneKey(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}
const prettyPhone = (k) => (k && k.length === 11 ? `+${k[0]} ${k.slice(1, 4)} ${k.slice(4, 7)} ${k.slice(7, 9)} ${k.slice(9)}` : `+${k}`);

async function settings() {
  const s = db.configured() ? parse(await db.command('GET', SETTINGS)) : null;
  return { ...DEFAULTS, ...(s || {}) };
}

async function saveSettings(input) {
  const s = input || {};
  const every = Math.floor(Number(s.every));
  if (!(every >= 2 && every <= 20)) throw new HttpError(400, 'invalid', 'Подарок может быть за каждую 2–20-ю покупку');
  const tiers = (Array.isArray(s.tiers) ? s.tiers : []).slice(0, 8).map((t) => ({
    upTo: t.upTo === null || t.upTo === '' || t.upTo === undefined ? null : Math.round(Number(t.upTo)),
    gift: String(t.gift || '').trim().slice(0, 120)
  })).filter((t) => t.gift);
  if (!tiers.length) throw new HttpError(400, 'invalid', 'Добавьте хотя бы один подарок');
  if (tiers.some((t) => t.upTo !== null && !(t.upTo > 0))) throw new HttpError(400, 'invalid', 'Суммы уровней должны быть больше нуля');
  tiers.sort((a, b) => (a.upTo === null) - (b.upTo === null) || a.upTo - b.upTo);
  const out = { every, tiers, notify: s.notify === 'owner' ? 'owner' : 'all', ownerChat: s.ownerChat ? String(s.ownerChat) : null };
  await db.command('SET', SETTINGS, JSON.stringify(out));
  return out;
}

const tierFor = (sum, tiers) => tiers.find((t) => t.upTo === null || sum <= t.upTo) || tiers[tiers.length - 1];

async function getClient(phone) {
  const k = phoneKey(phone);
  if (!k || !db.configured()) return null;
  return parse(await db.command('GET', key(k))) || { phone: k, name: '', purchases: [] };
}

async function saveClient(c) {
  c.purchases.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  await db.command('SET', key(c.phone), JSON.stringify(c));
  await db.addToSet(INDEX, c.phone);
}

/* Состояние клиента: сколько покупок, какие из них с подарком, что будет со следующей. */
function status(c, s) {
  const list = c ? c.purchases : [];
  const n = list.length;
  const total = list.reduce((sum, p) => sum + (p.amount || 0), 0);
  const prev = (upto) => list.slice(Math.max(0, upto - (s.every - 1)), upto); // N−1 покупок перед номером upto+1
  const gifts = list.map((p, i) => ((i + 1) % s.every === 0 ? { purchase: p, number: i + 1, base: prev(i).reduce((a, x) => a + (x.amount || 0), 0) } : null))
    .filter(Boolean).map((g) => ({ ...g, gift: tierFor(g.base, s.tiers).gift }));
  const nextNumber = n + 1;
  const nextIsGift = nextNumber % s.every === 0;
  const base = prev(n).reduce((a, x) => a + (x.amount || 0), 0);
  return {
    count: n,
    total,
    nextNumber,
    nextIsGift,
    left: nextIsGift ? 0 : s.every - (nextNumber % s.every), // сколько покупок до подарочной (не считая её)
    base,
    nextGift: nextIsGift ? tierFor(base, s.tiers).gift : null,
    gifts
  };
}

const newId = () => crypto.randomBytes(6).toString('hex');

async function addPurchase(input, by) {
  const k = phoneKey(input.phone);
  if (!k) throw new HttpError(400, 'invalid', 'Проверьте номер телефона');
  const amount = Math.round(Number(String(input.amount).replace(/[^\d.]/g, '')));
  if (!(amount > 0)) throw new HttpError(400, 'invalid', 'Укажите сумму покупки');
  const c = await getClient(k);
  if (input.name) c.name = String(input.name).trim().slice(0, 80);
  if (input.order && c.purchases.some((p) => p.order === input.order)) return { client: c, purchase: null };
  const purchase = {
    id: newId(),
    date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
    amount,
    source: ['site', 'boutique', 'instagram', 'whatsapp', 'phone', 'other'].includes(input.source) ? input.source : 'boutique',
    note: String(input.note || '').trim().slice(0, 200),
    ...(input.order ? { order: String(input.order) } : {}),
    by: String(by || '').slice(0, 60)
  };
  c.purchases.push(purchase);
  await saveClient(c);
  return { client: c, purchase };
}

async function removePurchase(phone, id) {
  const c = await getClient(phone);
  if (!c) throw new HttpError(404, 'not_found', 'Клиент не найден');
  c.purchases = c.purchases.filter((p) => p.id !== id && p.order !== id);
  await saveClient(c);
  return c;
}

// Заказ с сайта стал «Выполнен» → покупка; перестал → покупка убирается.
async function syncOrder(before, after) {
  if (!db.configured()) return;
  const was = before && before.status === 'done';
  const is = after.status === 'done';
  if (!was && is) {
    await addPurchase({
      phone: after.customer.phone,
      name: `${after.customer.firstName} ${after.customer.lastName}`.trim(),
      amount: after.paidAmount || after.total,
      source: 'site',
      order: after.number,
      note: after.items.map((i) => (i.full ? `${i.name} (флакон)` : `${i.name} ${i.ml} мл`)).join(', '),
      date: after.updatedAt
    }, 'сайт');
  } else if (was && !is) {
    await removePurchase(after.customer.phone, after.number);
  } else if (was && is && before.paidAmount !== after.paidAmount) {
    const c = await getClient(after.customer.phone);
    const p = c && c.purchases.find((x) => x.order === after.number);
    if (p) { p.amount = after.paidAmount || after.total; await saveClient(c); }
  }
}

// Один раз переносим уже выполненные заказы в историю клиентов.
async function ensureInit() {
  if (!db.configured() || !(await db.once(INIT, 10 * 365 * 86400))) return;
  for (const o of await db.listOrders()) {
    if (o.status === 'done' && !o.test) await syncOrder(null, o);
  }
}

async function list() {
  await ensureInit();
  const s = await settings();
  const phones = await db.members(INDEX);
  const clients = [];
  for (const p of phones) {
    const c = parse(await db.command('GET', key(p)));
    if (c && c.purchases.length) clients.push({ ...c, status: status(c, s) });
  }
  return clients.sort((a, b) => String(b.purchases.at(-1).date).localeCompare(String(a.purchases.at(-1).date)));
}

module.exports = { phoneKey, prettyPhone, settings, saveSettings, getClient, status, addPurchase, removePurchase, syncOrder, ensureInit, list, DEFAULTS };
