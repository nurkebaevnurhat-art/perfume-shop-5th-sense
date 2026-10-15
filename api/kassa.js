/* /api/kassa — «Касса»: быстрая запись покупок из бутика по общему PIN-коду.
   POST { action: 'login', pin }                      — вход, в ответ токен.
   GET  ?q=…                                          — поиск клиента по телефону или имени.
   GET  ?phone=…                                      — карточка клиента.
   POST { action: 'buy', phone, name, amount, note }  — записать покупку.
   POST { action: 'undo', phone, id }                 — отменить только что записанную покупку (15 минут).
   POST { action: 'name', phone, name }               — изменить имя клиента.
   POST { action: 'card', phone }                     — ссылка на личную карту клиента.
   GET  ?pin=status, POST { action: 'setPin', pin }   — PIN-код (только админка). */
const { send, readJson, handler, HttpError, requireAdmin } = require('../server/http');
const db = require('../server/db');
const loyalty = require('../server/loyalty');
const kassa = require('../server/kassa');

const UNDO_MINUTES = 15;

function requireStorage() {
  if (!db.configured()) throw new HttpError(503, 'storage_not_configured', 'Подключите хранилище Upstash Redis');
}

// Что показывает касса. В режиме «подарки видит только владелец» суммы и названия подарков скрыты.
function card(c, s) {
  const st = loyalty.status(c, s);
  const hide = s.notify === 'owner';
  return {
    phone: c.phone,
    pretty: loyalty.prettyPhone(c.phone),
    name: c.name || '',
    count: st.count,
    every: s.every,
    nextNumber: st.nextNumber,
    nextIsGift: st.nextIsGift,
    left: st.left,
    gift: !hide && st.nextIsGift ? st.nextGift : null,
    hideMoney: hide,
    recent: c.purchases.slice(-3).reverse().map((p) => ({ id: p.id, date: p.date, amount: hide ? null : p.amount, note: p.note || '', source: p.source }))
  };
}

module.exports = handler({
  async GET(req, res) {
    requireStorage();
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('pin') === 'status') {
      requireAdmin(req);
      return send(res, 200, { pinSet: Boolean(await kassa.pinInfo()) });
    }
    await kassa.requireKassa(req);
    const s = await loyalty.settings();
    const phone = url.searchParams.get('phone');
    if (phone) {
      const c = await loyalty.getClient(phone);
      if (!c) throw new HttpError(400, 'invalid', 'Проверьте номер телефона');
      return send(res, 200, { client: card(c, s), known: c.purchases.length > 0 || Boolean(c.name) });
    }
    const list = await loyalty.search(url.searchParams.get('q'));
    send(res, 200, { clients: list.map((c) => card(c, s)) });
  },

  async POST(req, res) {
    requireStorage();
    const body = await readJson(req);
    if (body.action === 'login') return send(res, 200, { token: await kassa.login(body.pin, req) });
    if (body.action === 'setPin') {
      requireAdmin(req);
      await kassa.setPin(body.pin);
      return send(res, 200, { ok: true, pinSet: true });
    }
    await kassa.requireKassa(req);
    const s = await loyalty.settings();
    if (body.action === 'buy') {
      const phone = loyalty.phoneKey(body.phone);
      if (!phone) throw new HttpError(400, 'invalid', 'Проверьте номер телефона');
      const existing = await loyalty.getClient(phone);
      const name = String(body.name || '').trim();
      if (!existing.name && !name) throw new HttpError(400, 'need_name', 'Впишите имя клиента');
      const { client, purchase } = await loyalty.addPurchase({ phone, name: name || existing.name, amount: body.amount, note: body.note, source: 'boutique' }, 'касса');
      const st = loyalty.status(client, s);
      const last = st.gifts[st.gifts.length - 1];
      const giftNow = Boolean(last && last.number === st.count);
      const cardToken = await loyalty.ensureCard(client.phone);
      return send(res, 200, { purchase: { id: purchase.id, amount: purchase.amount }, client: card(client, s), giftNow, giftName: giftNow && s.notify !== 'owner' ? last.gift : null, cardToken });
    }
    if (body.action === 'undo') {
      const c = await loyalty.getClient(body.phone);
      const p = c && c.purchases.find((x) => x.id === String(body.id || ''));
      if (!p || p.by !== 'касса' || Date.now() - Date.parse(p.date) > UNDO_MINUTES * 60000) {
        throw new HttpError(400, 'too_late', `Отменить можно только что записанную покупку (в течение ${UNDO_MINUTES} минут). Позже — в админке, вкладка «Клиенты».`);
      }
      const client = await loyalty.removePurchase(c.phone, p.id);
      return send(res, 200, { client: card(client, s) });
    }
    if (body.action === 'card') return send(res, 200, { cardToken: await loyalty.ensureCard(body.phone) });
    if (body.action === 'name') {
      const name = String(body.name || '').trim();
      if (!name) throw new HttpError(400, 'invalid', 'Впишите имя');
      const client = await loyalty.setName(body.phone, name);
      return send(res, 200, { client: card(client, s) });
    }
    throw new HttpError(400, 'invalid', 'Неизвестное действие');
  }
});
