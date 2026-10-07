/* 5th SENSE — Telegram: уведомления сотрудникам и общие функции бота.
   TELEGRAM_BOT_TOKEN — токен бота от @BotFather.
   Сотрудники (куда приходят заказы и вопросы покупателей): чаты, подключённые
   по приглашению из админ-панели (хранятся в Redis), или список ID через
   запятую в TELEGRAM_CHAT_ID. */
const crypto = require('node:crypto');
const db = require('./db');

const API = 'https://api.telegram.org';
const token = () => process.env.TELEGRAM_BOT_TOKEN || '';
const configured = () => Boolean(token());

async function call(method, payload) {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || res.status}`);
  return data.result;
}

function envChats() {
  return String(process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean).map((id) => ({ id, title: `ID ${id}` }));
}

// Список получателей и откуда он взят.
async function recipients() {
  const fromEnv = envChats();
  if (fromEnv.length) return { source: 'env', chats: fromEnv };
  if (!db.configured()) return { source: 'none', chats: [] };
  return { source: 'storage', chats: await db.getChats() };
}

async function send(text) {
  if (!configured()) return { sent: 0, failed: 0 };
  const { chats } = await recipients();
  const results = await Promise.allSettled(chats.map((c) => call('sendMessage', { chat_id: c.id, text, parse_mode: 'HTML', disable_web_page_preview: true })));
  results.forEach((r) => { if (r.status === 'rejected') console.error(r.reason); });
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { sent, failed: results.length - sent };
}

// Секрет, по которому /api/bot узнаёт запросы от Telegram (выводится из токена).
const webhookSecret = () => crypto.createHash('sha256').update('fs-webhook:' + token()).digest('hex').slice(0, 48);

async function isStaff(chatId) {
  const { chats } = await recipients();
  return chats.some((c) => String(c.id) === String(chatId));
}

/* Проверка данных мини-приложения (сайт открыт кнопкой «Магазин» в Telegram).
   Возвращает пользователя Telegram, если подпись верна. */
function verifyInitData(raw, maxAgeSeconds) {
  if (!raw || !configured()) return null;
  const params = new URLSearchParams(String(raw));
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token()).digest();
  const calc = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const age = Date.now() / 1000 - Number(params.get('auth_date') || 0);
  if (age > (maxAgeSeconds || 7 * 86400)) return null;
  try { return JSON.parse(params.get('user')); } catch (e) { return null; }
}

const escape = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = { configured, recipients, send, call, escape, webhookSecret, isStaff, verifyInitData, token };
