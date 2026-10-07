/* 5th SENSE — проверка заказа и текст уведомления. */
const { HttpError } = require('./http');
const { escape } = require('./telegram');

const STATUSES = ['new', 'confirmed', 'shipped', 'done', 'cancelled'];
const PAYMENT_STATUSES = ['unpaid', 'paid'];
const STATUS_NAMES = { new: 'Новый', confirmed: 'Подтверждён', shipped: 'Передан в доставку', done: 'Выполнен', cancelled: 'Отменён' };
const MAX_LINES = 30;
const MAX_QTY = 10;

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
const bad = (message) => new HttpError(400, 'invalid', message);

// Собирает заказ из данных формы. Цены, суммы и доставка считаются по каталогу сервера.
function build(input, shop) {
  const body = input && typeof input === 'object' ? input : {};
  if (body.website) throw bad('Заказ не принят'); // ловушка для ботов: поле скрыто от людей
  const c = body.customer || {};
  const customer = {
    firstName: text(c.firstName, 80),
    lastName: text(c.lastName, 80),
    phone: text(c.phone, 40),
    email: text(c.email, 120),
    city: text(c.city, 80),
    address: text(c.address, 240)
  };

  const delivery = shop.delivery.find((d) => d.id === (body.delivery && body.delivery.id));
  if (!delivery) throw bad('Выберите способ доставки');
  const payment = shop.payments.find((m) => m.id === (body.payment && body.payment.id) && m.enabled);
  if (!payment) throw bad('Выберите способ оплаты');

  const required = ['firstName', 'lastName', 'phone', 'email', 'city'].concat(delivery.id === 'pickup' ? [] : ['address']);
  if (required.some((k) => !customer[k])) throw bad('Заполните контактные данные');
  if (customer.phone.replace(/\D/g, '').length < 10) throw bad('Проверьте номер телефона');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw bad('Проверьте адрес почты');
  if (!body.consent || !body.consent.offer || !body.consent.privacy) throw bad('Примите условия оферты и согласие на обработку данных');

  const lines = Array.isArray(body.items) ? body.items.slice(0, MAX_LINES) : [];
  if (!lines.length) throw bad('Корзина пуста');
  const merged = new Map();
  lines.forEach((l) => {
    const p = shop.products.get(String(l && l.id));
    const v = p && p.volumes.find((x) => x.ml === Number(l.ml));
    if (!v) throw bad(`Товара «${text(l && l.name, 80) || 'из корзины'}» больше нет в каталоге. Обновите страницу и проверьте корзину.`);
    const qty = Math.floor(Number(l.qty));
    if (!(qty >= 1)) throw bad('Проверьте количество товаров');
    const key = `${p.id}|${v.ml}`;
    const prev = merged.get(key);
    merged.set(key, { id: p.id, name: p.name, brand: p.brand, ml: v.ml, qty: Math.min(MAX_QTY, (prev ? prev.qty : 0) + qty), price: v.price });
  });
  const items = [...merged.values()];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = delivery.price(subtotal);

  return {
    customer: delivery.id === 'pickup' ? { ...customer, address: '' } : customer,
    items,
    delivery: { id: delivery.id, name: delivery.name },
    payment: { id: payment.id, name: payment.name },
    comment: text(body.comment, 1000),
    gift: Boolean(body.gift),
    consent: { offer: true, privacy: true, at: new Date().toISOString() },
    subtotal,
    shipping: shipping == null ? null : shipping,
    total: subtotal + (shipping || 0)
  };
}

function patch(order, input) {
  const body = input && typeof input === 'object' ? input : {};
  const next = { ...order };
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw bad('Неизвестный статус');
    next.status = body.status;
  }
  if (body.paymentStatus !== undefined) {
    if (!PAYMENT_STATUSES.includes(body.paymentStatus)) throw bad('Неизвестный статус оплаты');
    next.paymentStatus = body.paymentStatus;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

function money(n, currency) {
  return `${new Intl.NumberFormat('ru-RU').format(n)} ${currency}`;
}

// Сообщение для Telegram (HTML-разметка бота).
function message(o, shop, adminUrl) {
  const cur = shop.config.currency;
  const c = o.customer;
  const ship = o.shipping === null ? 'рассчитает менеджер' : o.shipping === 0 ? 'бесплатно' : money(o.shipping, cur);
  const rows = [
    `${o.test ? '🧪 <b>Тестовый заказ</b> ' : '🛍 <b>Новый заказ</b> '}<b>${escape(o.number)}</b>`,
    '',
    `<b>${escape(c.firstName)} ${escape(c.lastName)}</b>`,
    `📞 ${escape(c.phone)}`,
    `✉️ ${escape(c.email)}`,
    '',
    ...o.items.map((i) => `• ${escape(i.brand)} ${escape(i.name)}, ${i.ml} мл × ${i.qty} — ${money(i.price * i.qty, cur)}`),
    '',
    `Товары: ${money(o.subtotal, cur)}`,
    `Доставка: ${ship}`,
    `<b>Итого: ${money(o.total, cur)}</b>`,
    '',
    `🚚 ${escape(o.delivery.name)}${o.delivery.id === 'pickup' ? '' : `\n📍 ${escape(c.city)}, ${escape(c.address)}`}`,
    `💳 ${escape(o.payment.name)}`
  ];
  if (o.gift) rows.push('🎁 Подарочная упаковка');
  if (o.comment) rows.push('', `💬 ${escape(o.comment)}`);
  if (adminUrl) rows.push('', `<a href="${escape(adminUrl)}">Открыть в админ-панели</a>`);
  return rows.join('\n');
}

module.exports = { build, patch, message, money, STATUSES, PAYMENT_STATUSES, STATUS_NAMES };
