/* 5th SENSE — общие функции серверных обработчиков (Vercel Functions, Node.js).
   Без внешних зависимостей: только встроенные модули Node. */
const crypto = require('node:crypto');

const MAX_BODY = 64 * 1024;
const MAX_BODY_ADMIN = 4 * 1024 * 1024; // таблица каталога и фото

function send(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// Ошибка с кодом ответа и текстом, который можно показать покупателю.
class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

async function readJson(req) {
  const limit = isAdmin(req) ? MAX_BODY_ADMIN : MAX_BODY;
  // Vercel сам разбирает JSON в req.body; на других серверах читаем поток.
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = '';
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    raw = String(req.body);
  } else {
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > limit) throw new HttpError(413, 'too_large', 'Слишком большой запрос');
    }
  }
  if (raw.length > limit) throw new HttpError(413, 'too_large', 'Слишком большой запрос');
  try { return raw ? JSON.parse(raw) : {}; } catch (e) { throw new HttpError(400, 'bad_json', 'Некорректный запрос'); }
}

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

// Пароль админки задаётся переменной окружения ADMIN_PASSWORD.
// Браузер передаёт его в заголовке Authorization: Bearer <пароль в encodeURIComponent>.
function adminConfigured() { return Boolean(process.env.ADMIN_PASSWORD); }

function isAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD;
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!pass || !m) return false;
  let given;
  try { given = decodeURIComponent(m[1]); } catch (e) { return false; }
  return crypto.timingSafeEqual(digest(given), digest(pass));
}

function requireAdmin(req) {
  if (!adminConfigured()) throw new HttpError(503, 'admin_not_configured', 'Пароль админ-панели не задан на сервере');
  if (!isAdmin(req)) throw new HttpError(401, 'unauthorized', 'Неверный пароль');
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function siteUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return '';
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return `${proto}://${host}`;
}

// Оборачивает обработчик: ошибки превращаются в JSON-ответ с понятным текстом.
function handler(routes) {
  return async (req, res) => {
    const run = routes[req.method];
    if (!run) {
      res.setHeader('Allow', Object.keys(routes).join(', '));
      return send(res, 405, { error: 'method_not_allowed' });
    }
    try {
      await run(req, res);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.code, message: err.message });
      console.error(err);
      return send(res, 500, { error: 'server_error', message: 'Ошибка сервера' });
    }
  };
}

module.exports = { send, readJson, HttpError, adminConfigured, isAdmin, requireAdmin, clientIp, siteUrl, handler };
