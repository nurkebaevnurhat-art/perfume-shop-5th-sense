/* /api/telegram — настройка бота из админ-панели (нужен пароль).
   GET  — состояние: токен, включён ли бот, какие чаты сотрудников подключены.
   POST { action: 'enable' }     — включить бота для покупателей (webhook, меню, кнопка «Магазин»).
   POST { action: 'invite' }     — одноразовая ссылка, чтобы подключить чат сотрудника.
   POST { action: 'test' }       — отправить проверочное сообщение сотрудникам.
   POST { action: 'disconnect' } — отключить чаты, подключённые из админки. */
const { send, readJson, handler, HttpError, requireAdmin, siteUrl } = require('../server/http');
const db = require('../server/db');
const telegram = require('../server/telegram');
const catalog = require('../server/catalog');
const botApi = require('../server/bot');

async function state() {
  const { source, chats } = telegram.configured() ? await telegram.recipients() : { source: 'none', chats: [] };
  let bot = null;
  let webhook = { enabled: false, url: '', lastError: '' };
  if (telegram.configured()) {
    try { bot = (await telegram.call('getMe')).username; } catch (err) { console.error(err); }
    if (bot) { try { webhook = await botApi.webhookState(); } catch (err) { console.error(err); } }
  }
  return { token: telegram.configured(), tokenValid: Boolean(bot), bot, source, chats, storage: db.configured(), webhook };
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

    if (action === 'enable') {
      if (!db.configured()) throw new HttpError(503, 'storage_not_configured', 'Сначала подключите хранилище Upstash Redis на Vercel');
      await botApi.enable(siteUrl(req));
      return send(res, 200, await state());
    }
    if (action === 'invite') {
      if (!db.configured()) throw new HttpError(503, 'storage_not_configured', 'Подключите хранилище или укажите TELEGRAM_CHAT_ID в настройках Vercel');
      const { webhook } = await state();
      if (!webhook.enabled) await botApi.enable(siteUrl(req));
      return send(res, 200, { ...(await state()), invite: await botApi.createInvite() });
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
