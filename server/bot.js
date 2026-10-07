/* 5th SENSE — бот для покупателей и сотрудников (один бот).
   Покупатель: меню, магазин внутри Telegram, статус своих заказов, вопросы консультанту.
   Сотрудник: получает заказы и вопросы, отвечает покупателю ответом (reply) на его сообщение. */
const crypto = require('node:crypto');
const db = require('./db');
const telegram = require('./telegram');
const catalog = require('./catalog');
const { STATUS_NAMES, money } = require('./orders');

const { call, escape } = telegram;
const DAY = 86400;
const INVITE_TTL = 15 * 60;

const html = (chatId, text, extra) => call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(extra || {}) });

/* ---------- Ссылки ---------- */
async function botName() {
  const cached = db.configured() ? await db.get('fs:tg:bot') : null;
  if (cached) return cached;
  const name = (await call('getMe')).username;
  if (db.configured()) await db.put('fs:tg:bot', name, DAY);
  return name;
}

// Ссылка «Следить за заказом в Telegram» для страницы подтверждения.
async function trackLink(order) {
  if (!telegram.configured() || !db.configured() || !order.track) return null;
  try { return `https://t.me/${await botName()}?start=o_${order.track}`; } catch (e) { console.error(e); return null; }
}

const newToken = () => crypto.randomBytes(12).toString('base64url');

/* ---------- Заказы покупателя ---------- */
async function linkOrder(number, chatId) {
  const order = await db.getOrder(number);
  if (!order) return null;
  const chats = new Set((order.telegram || []).map(String));
  chats.add(String(chatId));
  order.telegram = [...chats];
  await db.saveOrder(order);
  await db.addToSet(`fs:tg:orders:${chatId}`, number);
  return order;
}

function orderLine(o, shop) {
  return `<b>${escape(o.number)}</b> — ${escape(STATUS_NAMES[o.status] || o.status)}, ${money(o.total, shop.config.currency)}`;
}

// Сообщение покупателю при смене статуса в админке.
function statusText(o, shop) {
  const n = escape(o.number);
  const pickup = o.delivery && o.delivery.id === 'pickup';
  switch (o.status) {
    case 'confirmed': return `✅ Заказ <b>${n}</b> подтверждён. ${pickup ? 'Сообщим, когда он будет готов к выдаче.' : 'Сообщим, когда передадим его в доставку.'}`;
    case 'shipped': return pickup
      ? `🛍 Заказ <b>${n}</b> готов к выдаче в бутике${shop.config.contacts.address ? `: ${escape(shop.config.contacts.address)}` : ''}.`
      : `🚚 Заказ <b>${n}</b> передан в доставку.`;
    case 'done': return `🎉 Заказ <b>${n}</b> выполнен. Спасибо, что выбрали ${escape(shop.config.brand)}!`;
    case 'cancelled': return `Заказ <b>${n}</b> отменён. Если это ошибка, напишите нам прямо здесь.`;
    case 'new': return `Заказ <b>${n}</b> снова в работе.`;
    default: return null;
  }
}

// Покупатель оформил заказ в магазине внутри Telegram.
async function notifyCreated(o) {
  const shop = catalog.load();
  for (const chatId of o.telegram || []) {
    await html(chatId, `🛍 Заказ <b>${escape(o.number)}</b> на ${money(o.total, shop.config.currency)} принят.\n\nМы позвоним по номеру ${escape(o.customer.phone)}, чтобы подтвердить заказ. О смене статуса напишем сюда.`);
  }
}

async function notifyCustomer(before, after) {
  if (!telegram.configured() || !after.telegram || !after.telegram.length) return 0;
  const shop = catalog.load();
  const texts = [];
  if (before.status !== after.status) texts.push(statusText(after, shop));
  if (before.paymentStatus !== after.paymentStatus && after.paymentStatus === 'paid') texts.push(`💳 Оплата заказа <b>${escape(after.number)}</b> получена.`);
  let sent = 0;
  for (const chatId of after.telegram) {
    for (const text of texts.filter(Boolean)) {
      try { await html(chatId, text); sent++; } catch (err) { console.error(err); }
    }
  }
  return sent;
}

/* ---------- Меню ---------- */
function menu(site, shop) {
  return {
    text: `Добро пожаловать в <b>${escape(shop.config.brand)} ${escape(shop.config.tagline)}</b>.\n\n` +
      'Здесь можно открыть магазин, следить за заказом и задать вопрос консультанту: просто напишите его в этот чат.',
    markup: {
      inline_keyboard: [
        [{ text: '🛍 Открыть магазин', web_app: { url: site + '/' } }],
        [{ text: '📦 Мои заказы', callback_data: 'orders' }, { text: '💬 Консультация', callback_data: 'consult' }],
        [{ text: '📍 Контакты', callback_data: 'contacts' }]
      ]
    }
  };
}

function contacts(shop) {
  const c = shop.config.contacts;
  return [
    `<b>${escape(shop.config.brand)} ${escape(shop.config.tagline)}</b>`,
    c.address && `📍 ${escape(c.address)}`,
    c.hours && `🕰 ${escape(c.hours)}`,
    c.phone && `📞 ${escape(c.phone)}`,
    c.email && `✉️ ${escape(c.email)}`,
    c.instagram && `Instagram: ${escape(c.instagram)}`
  ].filter(Boolean).join('\n');
}

async function myOrders(chatId, shop) {
  if (!db.configured()) return 'Список заказов сейчас недоступен. Позвоните нам, и мы всё расскажем.';
  const numbers = await db.members(`fs:tg:orders:${chatId}`);
  const orders = (await Promise.all(numbers.map((n) => db.getOrder(n)))).filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);
  if (!orders.length) {
    return 'Здесь пока нет ваших заказов.\n\nОформите заказ в магазине (кнопка «Магазин» ниже) или нажмите «Следить за заказом в Telegram» на странице подтверждения заказа на сайте.';
  }
  return `Ваши заказы:\n\n${orders.map((o) => orderLine(o, shop)).join('\n')}\n\nО смене статуса мы напишем сюда.`;
}

/* ---------- Консультация ---------- */
async function relayToStaff(msg, shop) {
  const { chats } = await telegram.recipients();
  if (!chats.length || !db.configured()) {
    return html(msg.chat.id, `Сейчас консультант недоступен. Позвоните нам: ${escape(shop.config.contacts.phone)}.`);
  }
  if (!(await db.allow(`tg:${msg.chat.id}`, 20, 600))) return null;
  const u = msg.from || {};
  const who = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Покупатель';
  const head = `💬 <b>Вопрос покупателя</b>\n${escape(who)}${u.username ? ` (@${escape(u.username)})` : ''}`;
  const hint = '\n\n↩️ Ответьте на это сообщение, и бот перешлёт ответ покупателю.';
  for (const staff of chats) {
    try {
      const ids = [];
      if (msg.text) {
        ids.push((await html(staff.id, `${head}\n\n${escape(msg.text)}${hint}`)).message_id);
      } else {
        ids.push((await html(staff.id, head + hint)).message_id);
        ids.push((await call('copyMessage', { chat_id: staff.id, from_chat_id: msg.chat.id, message_id: msg.message_id })).message_id);
      }
      await Promise.all(ids.map((id) => db.put(`fs:tg:relay:${staff.id}:${id}`, String(msg.chat.id), 60 * DAY)));
    } catch (err) { console.error(err); }
  }
  if (await db.once(`fs:tg:ack:${msg.chat.id}`, 30 * 60)) {
    await html(msg.chat.id, 'Спасибо! Консультант ответит прямо здесь, в этом чате.');
  }
  return null;
}

// Ответ сотрудника (reply на вопрос покупателя) — пересылаем покупателю.
async function relayToCustomer(msg) {
  const reply = msg.reply_to_message;
  if (!reply || !db.configured()) return false;
  const customer = await db.get(`fs:tg:relay:${msg.chat.id}:${reply.message_id}`);
  if (!customer) return false;
  let ids = [];
  if (msg.text) {
    const sent = await html(customer, `💬 <b>Консультант ${escape(catalog.load().config.brand)}</b>\n\n${escape(msg.text)}`);
    ids = [sent.message_id];
  } else {
    ids = [(await call('copyMessage', { chat_id: customer, from_chat_id: msg.chat.id, message_id: msg.message_id })).message_id];
  }
  try {
    await call('setMessageReaction', { chat_id: msg.chat.id, message_id: msg.message_id, reaction: [{ type: 'emoji', emoji: '👍' }] });
  } catch (err) {
    await html(msg.chat.id, '✓ Ответ отправлен покупателю.', { reply_to_message_id: msg.message_id });
  }
  return ids.length > 0;
}

/* ---------- Сотрудники ---------- */
async function createInvite() {
  const code = crypto.randomBytes(9).toString('base64url');
  await db.put(`fs:tg:invite:${code}`, '1', INVITE_TTL);
  const name = await botName();
  return {
    private: `https://t.me/${name}?start=staff_${code}`,
    group: `https://t.me/${name}?startgroup=staff_${code}`,
    minutes: INVITE_TTL / 60
  };
}

async function acceptInvite(msg, code, shop) {
  if (!db.configured() || !(await db.take(`fs:tg:invite:${code}`))) {
    return html(msg.chat.id, 'Ссылка-приглашение устарела или уже использована. Создайте новую в админ-панели: вкладка «Данные».');
  }
  const chat = msg.chat;
  const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || (chat.username ? '@' + chat.username : `ID ${chat.id}`);
  await db.addChat({ id: String(chat.id), title, type: chat.type });
  return html(chat.id, `✅ Чат подключён к <b>${escape(shop.config.brand)}</b>. Сюда будут приходить новые заказы и вопросы покупателей.\n\nЧтобы ответить покупателю, ответьте (reply) на его сообщение.`);
}

/* ---------- Обработка обновлений от Telegram ---------- */
async function handle(update, site) {
  const shop = catalog.load();

  if (update.callback_query) {
    const q = update.callback_query;
    await call('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
    const chatId = q.message && q.message.chat.id;
    if (!chatId) return;
    if (q.data === 'orders') return html(chatId, await myOrders(chatId, shop));
    if (q.data === 'consult') return html(chatId, 'Напишите вопрос прямо сюда: какой аромат ищете, для какого случая или в подарок кому. Консультант ответит в этом чате.');
    if (q.data === 'contacts') return html(chatId, contacts(shop));
    return;
  }

  const msg = update.message;
  if (!msg || !msg.chat || (msg.from && msg.from.is_bot)) return;
  const privateChat = msg.chat.type === 'private';
  const text = msg.text || '';
  const cmd = /^\/(\w+)(?:@\w+)?(?:\s+(.+))?$/.exec(text.trim());

  if (cmd && cmd[1] === 'start' && cmd[2]) {
    const payload = cmd[2].trim();
    if (payload.startsWith('staff_')) return acceptInvite(msg, payload.slice(6), shop);
    if (payload.startsWith('o_') && privateChat && db.configured()) {
      const number = await db.get(`fs:order:track:${payload.slice(2)}`);
      const order = number && await linkOrder(number, msg.chat.id);
      if (!order) return html(msg.chat.id, 'Не нашли заказ по этой ссылке. Напишите нам, и мы поможем.');
      return html(msg.chat.id, `Заказ ${orderLine(order, shop)} теперь здесь.\n\nМы напишем, когда его подтвердят и передадут в доставку. Вопросы можно задать прямо в этом чате.`, { reply_markup: menu(site, shop).markup });
    }
  }

  // Ответ сотрудника покупателю.
  if (msg.reply_to_message && (await relayToCustomer(msg))) return;
  if (!privateChat) return; // в группах сотрудников бот отвечает только на приглашения и ответы

  if (cmd) {
    if (cmd[1] === 'orders') return html(msg.chat.id, await myOrders(msg.chat.id, shop));
    if (cmd[1] === 'contacts') return html(msg.chat.id, contacts(shop));
    const m = menu(site, shop);
    return html(msg.chat.id, m.text, { reply_markup: m.markup });
  }
  if (msg.web_app_data || msg.successful_payment) return;
  if (await telegram.isStaff(msg.chat.id)) {
    return html(msg.chat.id, 'Это чат сотрудника. Чтобы ответить покупателю, ответьте (reply) на его сообщение. Меню покупателя: /start');
  }
  return relayToStaff(msg, shop);
}

/* ---------- Настройка бота (кнопка в админке) ---------- */
async function enable(site) {
  const shop = catalog.load();
  await call('setWebhook', {
    url: `${site}/api/bot`,
    secret_token: telegram.webhookSecret(),
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true
  });
  await call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Меню' },
      { command: 'orders', description: 'Мои заказы' },
      { command: 'contacts', description: 'Адрес и телефон' }
    ]
  });
  await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: site + '/' } } });
  await call('setMyShortDescription', { short_description: `${shop.config.brand} ${shop.config.tagline}: магазин, заказы и консультации` }).catch(() => {});
}

async function webhookState() {
  const info = await call('getWebhookInfo');
  return { url: info.url || '', enabled: Boolean(info.url && info.url.endsWith('/api/bot')), lastError: info.last_error_message || '' };
}

module.exports = { handle, enable, webhookState, createInvite, trackLink, newToken, linkOrder, notifyCustomer, notifyCreated, botName };
