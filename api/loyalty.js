/* /api/loyalty — подарки за покупки (только админка, нужен пароль).
   GET                         — клиенты, их покупки и настройки.
   GET ?phone=…                — один клиент.
   POST { action: 'add', phone, name, amount, source, note, date } — покупка вне сайта.
   POST { action: 'delete', phone, id }                             — удалить ошибочную покупку.
   POST { action: 'settings', settings }                            — уровни подарков и уведомления. */
const { send, readJson, handler, HttpError, requireAdmin } = require('../server/http');
const db = require('../server/db');
const loyalty = require('../server/loyalty');

function requireStorage() {
  if (!db.configured()) throw new HttpError(503, 'storage_not_configured', 'Подключите хранилище Upstash Redis');
}

module.exports = handler({
  async GET(req, res) {
    await requireAdmin(req);
    requireStorage();
    const s = await loyalty.settings();
    const phone = new URL(req.url, 'http://x').searchParams.get('phone');
    if (phone) {
      const c = await loyalty.getClient(phone);
      if (!c) throw new HttpError(400, 'invalid', 'Проверьте номер телефона');
      return send(res, 200, { settings: s, client: { ...c, status: loyalty.status(c, s) } });
    }
    send(res, 200, { settings: s, clients: await loyalty.list() });
  },

  async POST(req, res) {
    await requireAdmin(req);
    requireStorage();
    const body = await readJson(req);
    const s = await loyalty.settings();
    if (body.action === 'add') {
      const { client, purchase } = await loyalty.addPurchase(body, 'админка');
      return send(res, 200, { purchase, client: { ...client, status: loyalty.status(client, s) } });
    }
    if (body.action === 'delete') {
      const client = await loyalty.removePurchase(body.phone, String(body.id || ''));
      return send(res, 200, { client: { ...client, status: loyalty.status(client, s) } });
    }
    if (body.action === 'settings') return send(res, 200, { settings: await loyalty.saveSettings(body.settings) });
    throw new HttpError(400, 'invalid', 'Неизвестное действие');
  }
});
