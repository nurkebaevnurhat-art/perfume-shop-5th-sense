/* «Касса» — быстрая запись покупок из бутика. Вход по одному общему PIN-коду
   (владелец и сотрудники), PIN задаёт владелец в админке. После входа браузер
   получает токен на 30 дней; смена PIN-кода отключает все старые входы. */
const crypto = require('node:crypto');
const db = require('./db');
const { HttpError, checkAdmin, clientIp } = require('./http');

const PIN_KEY = 'fs:kassa:pin';
const tokenKey = (t) => `fs:kassa:token:${t}`;
const TOKEN_TTL = 30 * 86400;
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const hash = (pin, salt) => crypto.createHash('sha256').update(`${salt}:${pin}`).digest('hex');

async function pinInfo() { return parse(await db.get(PIN_KEY)); }

async function setPin(pin) {
  const p = String(pin || '').trim();
  if (!/^\d{4,8}$/.test(p)) throw new HttpError(400, 'invalid', 'PIN-код — от 4 до 8 цифр');
  const old = await pinInfo();
  const salt = crypto.randomBytes(12).toString('hex');
  const v = ((old && old.v) || 0) + 1;
  await db.put(PIN_KEY, { hash: hash(p, salt), salt, v });
  return { v };
}

async function login(pin, req) {
  if (!(await db.allow(`kassa:${clientIp(req)}`, 8, 900))) throw new HttpError(429, 'too_many', 'Слишком много попыток. Подождите 15 минут.');
  const info = await pinInfo();
  if (!info) throw new HttpError(403, 'no_pin', 'PIN-код кассы ещё не задан. Владелец задаёт его в админке: «Клиенты» → «Касса».');
  const given = Buffer.from(hash(String(pin || '').trim(), info.salt));
  const ok = given.length === Buffer.byteLength(info.hash) && crypto.timingSafeEqual(given, Buffer.from(info.hash));
  if (!ok) throw new HttpError(401, 'wrong_pin', 'Неверный PIN-код');
  const token = crypto.randomBytes(24).toString('base64url');
  await db.put(tokenKey(token), String(info.v), TOKEN_TTL);
  return token;
}

// Вход в кассу: токен после PIN-кода или пароль админки.
async function requireKassa(req) {
  const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
  let token = '';
  try { token = m ? decodeURIComponent(m[1]) : ''; } catch (e) { token = ''; }
  const [v, info] = token ? await Promise.all([db.get(tokenKey(token)), pinInfo()]) : [null, null];
  if (v && info && String(info.v) === String(v)) return;
  // Старый токен кассы (после смены PIN) — сразу на вход по PIN, без счётчика попыток пароля:
  // иначе телефоны кассы в общей сети бутика могли бы закрыть вход в админку.
  if (/^[A-Za-z0-9_-]{32}$/.test(token)) throw new HttpError(401, 'unauthorized', 'Войдите по PIN-коду заново');
  // Не токен кассы — может быть пароль админки (с той же защитой от перебора).
  if (await checkAdmin(req)) return;
  throw new HttpError(401, 'unauthorized', 'Войдите по PIN-коду заново');
}

module.exports = { pinInfo, setPin, login, requireKassa };
