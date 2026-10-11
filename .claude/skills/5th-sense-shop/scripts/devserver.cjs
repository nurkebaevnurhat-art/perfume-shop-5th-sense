// Имитация Vercel для проверки 5th SENSE: статика + api/*, Upstash Redis и Telegram подменены в памяти.
// Запуск из корня репозитория: PORT=8790 MODE=full node .claude/skills/5th-sense-shop/scripts/devserver.cjs
// Локальная имитация Vercel: статика + api/*, Redis и Telegram подменены.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// Корень репозитория: ROOT=… или текущая папка.
const ROOT = require('node:path').resolve(process.env.ROOT || process.cwd());
const PORT = Number(process.env.PORT || 8790);
const MODE = process.env.MODE || 'full'; // full | tg-only | none | no-admin
process.chdir(ROOT);
if (MODE !== 'none') {
  if (MODE !== 'tg-only') { process.env.KV_REST_API_URL = 'https://mock-redis.local'; process.env.KV_REST_API_TOKEN = 'tok'; }
  process.env.TELEGRAM_BOT_TOKEN = '123:ABC';
  if (MODE === 'tg-only') process.env.TELEGRAM_CHAT_ID = '777';
  if (MODE !== 'no-admin') process.env.ADMIN_PASSWORD = 'Пароль-5th';
}
const redis = new Map();
const tgLog = [];
const tgCalls = [];
let webhook = '';
let msgId = 100;
const realFetch = global.fetch;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
global.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith('https://mock-redis.local')) {
    const [cmd, ...a] = JSON.parse(init.body);
    const h = (k) => { if (!redis.has(k)) redis.set(k, new Map()); return redis.get(k); };
    switch (cmd) {
      case 'INCR': { const n = Number(redis.get(a[0]) || 0) + 1; redis.set(a[0], n); return json({ result: n }); }
      case 'EXPIRE': return json({ result: 1 });
      case 'HSET': for (let i = 1; i < a.length; i += 2) h(a[0]).set(a[i], a[i + 1]); return json({ result: 1 });
      case 'HGET': return json({ result: redis.get(a[0])?.get(a[1]) ?? null });
      case 'HGETALL': return json({ result: [...(redis.get(a[0]) || new Map())].flat() });
      case 'DEL': a.forEach((k) => redis.delete(k)); return json({ result: 1 });
      case 'HDEL': redis.get(a[0])?.delete(a[1]); return json({ result: 1 });
      case 'HLEN': return json({ result: redis.get(a[0])?.size || 0 });
      case 'HMGET': return json({ result: a.slice(1).map((f) => redis.get(a[0])?.get(f) ?? null) });
      case 'GET': return json({ result: redis.get(a[0]) ?? null });
      case 'SET': if (a.includes('NX') && redis.has(a[0])) return json({ result: null }); redis.set(a[0], a[1]); return json({ result: 'OK' });
      case 'SADD': { if (!redis.has(a[0])) redis.set(a[0], new Set()); redis.get(a[0]).add(a[1]); return json({ result: 1 }); }
      case 'SMEMBERS': return json({ result: [...(redis.get(a[0]) || [])] });
    }
    return json({ error: 'unknown ' + cmd }, 400);
  }
  if (url.startsWith('https://api.telegram.org/')) {
    const method = url.split('/').pop();
    const body = JSON.parse(init.body || '{}');
    tgCalls.push({ method, body });
    if (method === 'getMe') return json({ ok: true, result: { username: 'fifth_sense_orders_bot' } });
    if (method === 'setWebhook') { webhook = body.url; return json({ ok: true, result: true }); }
    if (method === 'getWebhookInfo') return json({ ok: true, result: { url: webhook } });
    if (['setMyCommands', 'setChatMenuButton', 'setMyShortDescription', 'answerCallbackQuery', 'setMessageReaction'].includes(method)) return json({ ok: true, result: true });
    if (method === 'sendMessage' || method === 'copyMessage') { tgLog.push({ method, ...body }); return json({ ok: true, result: { message_id: ++msgId } }); }
  }
  return realFetch(url, init);
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__tg') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(tgLog)); }
  if (u.pathname === '/__calls') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(tgCalls)); }
  if (u.pathname === '/__secret') { return res.end(require(ROOT + '/server/telegram').webhookSecret()); }
  if (u.pathname === '/__initdata') {
    // Подписанные данные мини-приложения, как их передаёт Telegram.
    const crypto = require('node:crypto');
    const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE', user: JSON.stringify({ id: 900, first_name: 'Дана', last_name: 'Ким' }) });
    const check = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    p.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
    return res.end(p.toString());
  }
  if (u.pathname.startsWith('/api/')) {
    if (MODE === 'none') { res.statusCode = 404; return res.end('Not found'); }
    const file = path.join(ROOT, 'api', u.pathname.slice(5) + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('nf'); }
    return require(file)(req, res);
  }
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (u.pathname === '/') p = path.join(ROOT, 'index.html');
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end('nf'); }
  res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('dev', MODE, PORT));
