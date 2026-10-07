/* /api/orders
   POST   — оформить заказ (сайт): сохраняет его и присылает уведомление в Telegram.
   GET    — список заказов (админка, нужен пароль).
   PATCH  — изменить статус заказа: { number, status?, paymentStatus? } (админка).
   DELETE — удалить все заказы (админка). */
const { send, readJson, handler, HttpError, requireAdmin, isAdmin, clientIp, siteUrl } = require('../server/http');
const db = require('../server/db');
const telegram = require('../server/telegram');
const catalog = require('../server/catalog');
const orders = require('../server/orders');

function requireStorage() {
  if (!db.configured()) throw new HttpError(503, 'storage_not_configured', 'Хранилище заказов не подключено');
}

module.exports = handler({
  async POST(req, res) {
    const storage = db.configured();
    const bot = telegram.configured();
    if (!storage && !bot) throw new HttpError(503, 'not_configured', 'Приём заказов не настроен');

    const admin = isAdmin(req);
    if (storage && !admin && !(await db.allow(`order:${clientIp(req)}`, 8, 600))) {
      throw new HttpError(429, 'rate_limited', 'Слишком много заказов подряд. Подождите несколько минут или позвоните в бутик.');
    }

    const shop = catalog.load();
    const body = await readJson(req);
    const order = orders.build(body, shop);
    const seq = storage ? await db.nextNumber() : null;
    const record = {
      number: seq ? `5S-${1000 + seq}` : '5S-' + Date.now().toString(36).toUpperCase().slice(-6),
      status: 'new',
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      ...(admin && body.test ? { test: true } : {}),
      ...order
    };

    // Заказ не должен потеряться: достаточно, чтобы сработало хранилище или Telegram.
    let saved = false;
    if (storage) {
      try { await db.saveOrder(record); saved = true; } catch (err) { console.error(err); }
    }
    let notified = { sent: 0, failed: 0 };
    if (bot) {
      try { notified = await telegram.send(orders.message(record, shop, `${siteUrl(req)}/#admin-orders`)); } catch (err) { console.error(err); }
    }
    if (!saved && !notified.sent) throw new HttpError(502, 'not_delivered', 'Не удалось передать заказ в бутик');

    send(res, 201, { order: record, saved, notified: notified.sent > 0 });
  },

  async GET(req, res) {
    requireAdmin(req);
    requireStorage();
    send(res, 200, { orders: await db.listOrders() });
  },

  async PATCH(req, res) {
    requireAdmin(req);
    requireStorage();
    const body = await readJson(req);
    const current = await db.getOrder(String(body.number || ''));
    if (!current) throw new HttpError(404, 'not_found', 'Заказ не найден');
    const next = orders.patch(current, body);
    await db.saveOrder(next);
    send(res, 200, { order: next });
  },

  async DELETE(req, res) {
    requireAdmin(req);
    requireStorage();
    await db.clearOrders();
    send(res, 200, { ok: true });
  }
});
