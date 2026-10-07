/* 5th SENSE — уведомления о заказах в Telegram.
   TELEGRAM_BOT_TOKEN — токен бота от @BotFather.
   Куда писать: чаты, подключённые в админ-панели (хранятся в Redis),
   или список ID через запятую в TELEGRAM_CHAT_ID. */
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

// Чаты, которые писали боту: личные переписки и группы, куда его добавили.
async function discover() {
  const updates = await call('getUpdates', { limit: 100, allowed_updates: ['message', 'my_chat_member'] });
  const found = new Map();
  updates.forEach((u) => {
    const chat = (u.message && u.message.chat) || (u.my_chat_member && u.my_chat_member.chat);
    if (!chat) return;
    const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || (chat.username ? '@' + chat.username : `ID ${chat.id}`);
    found.set(String(chat.id), { id: String(chat.id), title, type: chat.type });
  });
  return [...found.values()];
}

const escape = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = { configured, recipients, send, discover, call, escape };
