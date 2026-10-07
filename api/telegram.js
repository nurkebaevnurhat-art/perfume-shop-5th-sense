/* /api/telegram — настройка уведомлений из админ-панели (нужен пароль).
   GET  — состояние: есть ли токен бота и какие чаты получают заказы.
   POST { action: 'connect' }    — подключить чаты, которые написали боту.
   POST { action: 'test' }       — отправить проверочное сообщение.
   POST { action: 'disconnect' } — отключить чаты, подключённые из админки. */
const { send, readJson, handler, HttpError, requireAdmin } = require('../server/http');
const db = require('../server/db');
const telegram = require('../server/telegram');
const catalog = require('../server/catalog');

async function state() {
  const { source, chats } = telegram.configured() ? await telegram.recipients() : { source: 'none', chats: [] };
  let bot = null;
  if (telegram.configured()) {
    try { bot = (await telegram.call('getMe')).username; } catch (err) { console.error(err); }
  }
  return { token: telegram.configured(), tokenValid: Boolean(bot), bot, source, chats, storage: db.configured() };
}

module.exports = handler({
  async GET(req, res) {
    requireAdmin(req);
    send(res, 200, await state());
  },

  async POST(req, res) {
    requireAdmin(req);
    if (!telegram.configured()) throw new HttpError(503, 'telegram_not_configured', 'Токен бота не задан на сервере');
    const { action } = await readJson(req);
    const brand = catalog.load().config.brand;

    if (action === 'connect') {
      if (!db.configured()) throw new HttpError(503, 'storage_not_configured', 'Подключите хранилище или укажите TELEGRAM_CHAT_ID в настройках Vercel');
      const found = await telegram.discover();
      if (!found.length) throw new HttpError(404, 'no_chats', 'Бот пока не получил ни одного сообщения. Напишите ему /start в Telegram и нажмите ещё раз.');
      const current = await db.getChats();
      const chats = [...new Map([...current, ...found].map((c) => [c.id, c])).values()];
      await db.setChats(chats);
      await telegram.send(`✅ Чат подключён к сайту <b>${telegram.escape(brand)}</b>. Сюда будут приходить новые заказы.`);
      return send(res, 200, await state());
    }
    if (action === 'test') {
      const result = await telegram.send(`🔔 Проверка уведомлений <b>${telegram.escape(brand)}</b>: всё работает.`);
      if (!result.sent) throw new HttpError(502, 'not_delivered', 'Сообщение не отправлено. Проверьте, что чат подключён и бот не заблокирован.');
      return send(res, 200, { ...(await state()), sent: result.sent });
    }
    if (action === 'disconnect') {
      if (db.configured()) await db.setChats([]);
      return send(res, 200, await state());
    }
    throw new HttpError(400, 'invalid', 'Неизвестное действие');
  }
});
