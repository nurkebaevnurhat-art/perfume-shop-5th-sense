/* POST /api/bot — сюда Telegram присылает сообщения боту (webhook).
   Включается кнопкой «Включить бота» в админ-панели (вкладка «Данные»). */
const crypto = require('node:crypto');
const { send, readJson, handler, siteUrl } = require('../server/http');
const telegram = require('../server/telegram');
const bot = require('../server/bot');

function fromTelegram(req) {
  const given = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  const expected = telegram.webhookSecret();
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

module.exports = handler({
  async POST(req, res) {
    if (!telegram.configured() || !fromTelegram(req)) return send(res, 401, { error: 'unauthorized' });
    try {
      await bot.handle(await readJson(req), siteUrl(req));
    } catch (err) {
      // Отвечаем 200 в любом случае: иначе Telegram будет повторять то же сообщение.
      console.error(err);
    }
    send(res, 200, { ok: true });
  }
});
