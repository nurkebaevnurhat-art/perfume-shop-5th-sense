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
const botApi = require('../server/bot');
const products = require('../server/products');
const loyalty = require('../server/loyalty');

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

    const shop = { ...catalog.load(), products: await products.map() };
    const body = await readJson(req);
    const order = orders.build(body, shop);
    // Когда каталог на сервере, остатки точные: не продаём больше, чем есть.
    const tracked = products.tracking() && Boolean(await products.stored());
    if (tracked) {
      order.items.filter((i) => !i.full).forEach((i) => {
        const v = shop.products.get(i.id).volumes.find((x) => x.ml === i.ml);
        if (v.stock < i.qty) {
          throw new HttpError(409, 'out_of_stock', v.stock
            ? `${i.brand} ${i.name}, ${i.ml} мл: осталось только ${v.stock} шт. Уменьшите количество в корзине.`
            : `${i.brand} ${i.name}, ${i.ml} мл: закончился. Уберите его из корзины.`);
        }
      });
    }
    const seq = storage ? await db.nextNumber() : null;
    const record = {
      number: seq ? `5S-${1000 + seq}` : '5S-' + Date.now().toString(36).toUpperCase().slice(-6),
      status: 'new',
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      ...(admin && body.test ? { test: true } : {}),
      ...order,
      // Ключ для ссылки «Следить за заказом в Telegram».
      ...(storage ? { track: botApi.newToken() } : {})
    };
    // Заказ из магазина внутри Telegram: покупатель сразу получает статусы в боте.
    const tgUser = telegram.verifyInitData(body.telegram);
    if (tgUser && tgUser.id) record.telegram = [String(tgUser.id)];

    // Заказ не должен потеряться: достаточно, чтобы сработало хранилище или Telegram.
    let saved = false;
    if (storage) {
      try {
        await db.saveOrder(record);
        saved = true;
        if (tracked) await products.moveStock(record.items, -1);
        await db.put(`fs:order:track:${record.track}`, record.number);
        if (record.telegram) await db.addToSet(`fs:tg:orders:${record.telegram[0]}`, record.number);
      } catch (err) { console.error(err); }
    }
    // Подарки за покупки: какая это покупка клиента по счёту и положен ли подарок — для бутика.
    let giftNote = '';
    let giftSettings = null;
    if (storage && !record.test) {
      try {
        giftSettings = await loyalty.settings();
        const st = await loyalty.forOrder(record, giftSettings);
        if (st) {
          record.loyalty = { count: st.count, done: st.done, open: st.open, nextNumber: st.nextNumber, gift: st.nextGift, giftAt: st.nextNumber + st.left };
          const pending = st.open ? ` Учтены заказы в работе: ${st.open}.` : '';
          giftNote = st.nextIsGift
            ? `🎁 <b>Это ${st.nextNumber}-я покупка клиента — положен подарок: ${telegram.escape(st.nextGift)}</b>. За ${giftSettings.every - 1} предыдущие — ${orders.money(st.base, shop.config.currency)}.${pending}`
            : `🛍 <b>Это ${st.nextNumber}-я покупка клиента.</b> Подарок — на ${st.nextNumber + st.left}-й.${pending}`;
          await db.saveOrder(record);
        }
      } catch (err) { console.error(err); }
    }
    let notified = { sent: 0, failed: 0 };
    if (bot) {
      // «Только владелец»: строку о покупках видит только чат владельца.
      const ownerChat = giftNote && giftSettings && giftSettings.notify === 'owner' && giftSettings.ownerChat ? String(giftSettings.ownerChat) : '';
      const text = orders.message(record, shop, `${siteUrl(req)}/#admin-orders`);
      const withNote = giftNote ? `${giftNote}\n\n${text}` : text;
      let ownerGotIt = false;
      try {
        notified = await telegram.send((c) => {
          if (!ownerChat) return withNote;
          if (String(c.id) === ownerChat) { ownerGotIt = true; return withNote; }
          return text;
        });
      } catch (err) { console.error(err); }
      if (ownerChat && !ownerGotIt) {
        try { await telegram.call('sendMessage', { chat_id: ownerChat, text: `${giftNote}\nЗаказ <b>${telegram.escape(record.number)}</b>, ${telegram.escape(record.customer.firstName)} ${telegram.escape(record.customer.lastName)}.`, parse_mode: 'HTML' }); } catch (err) { console.error(err); }
      }
    }
    if (!saved && !notified.sent) throw new HttpError(502, 'not_delivered', 'Не удалось передать заказ в бутик');

    if (record.telegram && saved) {
      try { await botApi.notifyCreated(record); } catch (err) { console.error(err); }
    }
    const telegramLink = saved && !record.telegram ? await botApi.trackLink(record) : null;
    // Сведения о подарках — только для бутика, покупателю их не отдаём.
    const { loyalty: _secret, ...publicOrder } = record;
    send(res, 201, { order: { ...publicOrder, telegramLink, telegramLinked: Boolean(record.telegram) }, saved, notified: notified.sent > 0 });
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
    // Отмена возвращает товар на склад, возобновление снова списывает.
    if (current.status !== 'cancelled' && next.status === 'cancelled') await products.moveStock(next.items, +1);
    if (current.status === 'cancelled' && next.status !== 'cancelled') await products.moveStock(next.items, -1);
    // «Выполнен» — покупка засчитывается в подарки за покупки, снятие статуса её убирает.
    if (!next.test) { try { await loyalty.syncOrder(current, next); } catch (err) { console.error(err); } }
    // Покупатель, который следит за заказом в Telegram, получает сообщение о новом статусе.
    let customerNotified = 0;
    try { customerNotified = await botApi.notifyCustomer(current, next); } catch (err) { console.error(err); }
    send(res, 200, { order: next, customerNotified });
  },

  async DELETE(req, res) {
    requireAdmin(req);
    requireStorage();
    await db.clearOrders();
    send(res, 200, { ok: true });
  }
});
