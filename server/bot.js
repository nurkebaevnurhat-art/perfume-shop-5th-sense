/* 5th SENSE — бот для покупателей и сотрудников (один бот).
   Покупатель: меню, магазин внутри Telegram, статус своих заказов, вопросы консультанту.
   Сотрудник: получает заказы и вопросы, отвечает покупателю прямо в чате с ботом. */
const crypto = require('node:crypto');
const db = require('./db');
const telegram = require('./telegram');
const catalog = require('./catalog');
const { STATUS_NAMES, money } = require('./orders');
const loyalty = require('./loyalty');

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
        [{ text: '🎁 Подарки за покупки', callback_data: 'bonus' }, { text: '📍 Контакты', callback_data: 'contacts' }]
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
  const hint = '\n\n↩️ Просто напишите ответ: бот перешлёт его покупателю.';
  // Telegram сразу открывает «Ответить» на этот вопрос, сотруднику остаётся только написать текст.
  const replyUi = { reply_markup: { force_reply: true, input_field_placeholder: `Ответ: ${who}`.slice(0, 64) } };
  await db.put(`fs:tg:name:${msg.chat.id}`, who, 60 * DAY);
  for (const staff of chats) {
    try {
      const ids = [];
      if (msg.text) {
        ids.push((await html(staff.id, `${head}\n\n${escape(msg.text)}${hint}`, replyUi)).message_id);
      } else {
        ids.push((await call('copyMessage', { chat_id: staff.id, from_chat_id: msg.chat.id, message_id: msg.message_id })).message_id);
        ids.push((await html(staff.id, head + hint, replyUi)).message_id);
      }
      await Promise.all(ids.map((id) => db.put(`fs:tg:relay:${staff.id}:${id}`, String(msg.chat.id), 60 * DAY)));
      // Последний вопрос в этом чате: обычное сообщение сотрудника уйдёт этому покупателю.
      await db.put(`fs:tg:last:${staff.id}`, String(msg.chat.id), 12 * 3600);
    } catch (err) { console.error(err); }
  }
  if (await db.once(`fs:tg:ack:${msg.chat.id}`, 30 * 60)) {
    await html(msg.chat.id, 'Спасибо! Консультант ответит прямо здесь, в этом чате.');
  }
  return null;
}

// Сообщение сотрудника → покупателю, с подтверждением в чате сотрудника.
async function deliver(msg, customer) {
  if (msg.text) {
    await html(customer, `💬 <b>Консультант ${escape(catalog.load().config.brand)}</b>\n\n${escape(msg.text)}`);
  } else {
    await call('copyMessage', { chat_id: customer, from_chat_id: msg.chat.id, message_id: msg.message_id });
  }
  const name = await db.get(`fs:tg:name:${customer}`);
  await html(msg.chat.id, `✓ Отправлено покупателю${name ? ` ${escape(name)}` : ''}.`, { reply_to_message_id: msg.message_id });
  return true;
}

// Ответ сотрудника на вопрос покупателя (через «Ответить»).
async function relayToCustomer(msg) {
  const reply = msg.reply_to_message;
  if (!reply || !db.configured()) return false;
  const customer = await db.get(`fs:tg:relay:${msg.chat.id}:${reply.message_id}`);
  return customer ? deliver(msg, customer) : false;
}

// Обычное сообщение сотрудника в личном чате с ботом: отвечаем на последний вопрос.
async function replyToLast(msg) {
  const customer = db.configured() && !msg.reply_to_message ? await db.get(`fs:tg:last:${msg.chat.id}`) : null;
  if (customer) return deliver(msg, customer);
  return html(msg.chat.id, 'Новых вопросов от покупателей нет. Чтобы ответить на более старый вопрос, нажмите на него, выберите «Ответить» и напишите текст. Меню покупателя: /start');
}

/* ---------- Подарки за покупки ---------- */
const STAFF_CMDS = new Set(['buy', 'pokupka', 'покупка', 'client', 'klient', 'клиент']);
const SOURCES = { site: 'сайт', boutique: 'бутик', instagram: 'Instagram', whatsapp: 'WhatsApp', phone: 'звонок', other: 'другое' };

// Покупателю: правило и его прогресс (по заказам, привязанным к этому чату). Уровни не раскрываем.
async function bonusForCustomer(chatId) {
  const s = await loyalty.settings();
  const rule = `🎁 <b>Каждая ${s.every}-я покупка — с подарком от бутика.</b> Чем больше вы покупаете, тем ценнее подарок. Покупки считаются по номеру телефона: на сайте, в бутике и через WhatsApp.`;
  if (!db.configured()) return rule;
  const numbers = await db.members(`fs:tg:orders:${chatId}`);
  const phones = new Set();
  for (const n of numbers) { const o = await db.getOrder(n); if (o) phones.add(loyalty.phoneKey(o.customer.phone)); }
  const lines = [];
  for (const p of [...phones].filter(Boolean)) {
    const st = loyalty.status(await loyalty.getClient(p), s);
    lines.push(st.nextIsGift
      ? `У вас ${st.count} ${st.count === 1 ? 'покупка' : st.count < 5 ? 'покупки' : 'покупок'}. <b>Следующая покупка — с подарком!</b>`
      : `У вас ${st.count} ${st.count === 1 ? 'покупка' : st.count < 5 && st.count ? 'покупки' : 'покупок'}. До покупки с подарком: ещё ${st.left}.`);
  }
  return lines.length ? `${rule}\n\n${lines.join('\n')}` : `${rule}\n\nЧтобы видеть здесь свой прогресс, оформите заказ в магазине или нажмите «Следить за заказом в Telegram» на странице заказа.`;
}

// «/buy 87011234567 45000 Baccarat 10 мл» → телефон, сумма, описание.
function parsePurchase(args) {
  const tokens = args.trim().split(/\s+/);
  let phone = '';
  while (tokens.length && phone.replace(/\D/g, '').length < 10) phone += tokens.shift();
  let amount = '';
  if (tokens.length && /^\d[\d.,]*$/.test(tokens[0])) amount = tokens.shift();
  // «45 000» записано группами: первая группа до трёх цифр, дальше по три. «45000 100 мл» не склеиваем.
  if (amount.length <= 3) while (tokens.length && /^\d{3}$/.test(tokens[0])) amount += tokens.shift();
  if (tokens[0] && /^(₸|тг|tg|kzt)$/i.test(tokens[0])) tokens.shift();
  return { phone, amount: amount.replace(/[.,]\d{1,2}$/, '').replace(/\D/g, ''), note: tokens.join(' ') };
}

function clientCard(c, st, s, showGifts) {
  const name = c.name ? `${escape(c.name)}, ` : '';
  const head = `👤 ${name}${escape(loyalty.prettyPhone(c.phone))}\nПокупок: <b>${st.count}</b>${showGifts ? ` на ${money(st.total, '₸')}` : ''}`;
  const last = c.purchases.slice(-3).reverse().map((p) => `• ${new Date(p.date).toLocaleDateString('ru-RU')} — ${showGifts ? money(p.amount, '₸') + ', ' : ''}${SOURCES[p.source] || p.source}${p.note ? `: ${escape(p.note)}` : ''}`).join('\n');
  const next = st.nextIsGift
    ? (showGifts ? `🎁 <b>Следующая (${st.nextNumber}-я) покупка — с подарком: ${escape(st.nextGift)}</b> (за ${s.every - 1} предыдущие — ${money(st.base, '₸')}).` : `🎁 <b>Следующая покупка — с подарком.</b>`)
    : `До покупки с подарком: ещё ${st.left}.`;
  return [head, last, next].filter(Boolean).join('\n\n');
}

async function staffCommand(msg, name, args, shop) {
  if (!db.configured()) return html(msg.chat.id, 'Подарки за покупки работают, когда подключено хранилище.');
  const s = await loyalty.settings();
  // В режиме «только владелец» суммы и подарки видны только в чате владельца.
  const showGifts = s.notify !== 'owner' || String(msg.chat.id) === String(s.ownerChat);
  const who = [msg.from && msg.from.first_name, msg.from && msg.from.last_name].filter(Boolean).join(' ') || 'сотрудник';
  if (['client', 'klient', 'клиент'].includes(name)) {
    const c = await loyalty.getClient(args);
    if (!c) return html(msg.chat.id, 'Напишите номер телефона клиента, например:\n<code>/client 87011234567</code>');
    if (!c.purchases.length) return html(msg.chat.id, `По номеру ${escape(loyalty.prettyPhone(c.phone))} покупок пока нет. До покупки с подарком: ещё ${s.every - 1}.`);
    return html(msg.chat.id, clientCard(c, loyalty.status(c, s), s, showGifts));
  }
  const p = parsePurchase(args);
  const phone = loyalty.phoneKey(p.phone);
  if (phone && p.amount) return recordPurchase(msg.chat.id, who, s, showGifts, { phone, amount: p.amount, note: p.note });
  // Не всё указано — спрашиваем по шагам: номер → сумма.
  return askStep(msg.chat.id, phone ? { step: 'amount', phone } : { step: 'phone' }, s, showGifts);
}

/* ---------- Пошаговая запись покупки: /buy без данных ---------- */
const BUY_TTL = 15 * 60;
const buyKey = (chatId) => `fs:tg:buy:${chatId}`;
const replyUi = (placeholder) => ({ reply_markup: { force_reply: true, input_field_placeholder: placeholder } });

async function askStep(chatId, state, s, showGifts) {
  await db.put(buyKey(chatId), state, BUY_TTL);
  const cancel = '\n<i>Отменить: /cancel</i>';
  if (state.step === 'phone') return html(chatId, `🧾 <b>Запись покупки</b>\nШаг 1 из 2. Номер телефона клиента?${cancel}`, replyUi('+7 701 123 45 67'));
  if (state.step === 'amount') {
    const c = await loyalty.getClient(state.phone);
    const st = loyalty.status(c, s);
    const info = c && c.purchases.length
      ? `${escape(c.name || 'Клиент')}: покупок ${st.count}.${st.nextIsGift ? (showGifts ? ` 🎁 Эта покупка — с подарком: ${escape(st.nextGift)}.` : ' 🎁 Эта покупка — с подарком.') : ''}`
      : 'Новый клиент: покупок пока нет.';
    return html(chatId, `${info}\nШаг 2 из 2. Сумма покупки, ₸?${cancel}`, replyUi('45000'));
  }
}

// Ответ сотрудника на очередной вопрос бота. true — сообщение относилось к записи покупки.
async function continueBuy(msg) {
  if (!msg.text || !db.configured()) return false;
  const state = parseJson(await db.get(buyKey(msg.chat.id)));
  if (!state) return false;
  const text = msg.text.trim();
  if (/^\/(cancel|otmena|отмена)(@\w+)?$/i.test(text)) {
    await db.command('DEL', buyKey(msg.chat.id));
    await html(msg.chat.id, 'Запись покупки отменена.');
    return true;
  }
  if (text.startsWith('/')) return false; // другая команда — не мешаем
  const s = await loyalty.settings();
  const showGifts = s.notify !== 'owner' || String(msg.chat.id) === String(s.ownerChat);
  if (state.step === 'phone') {
    const phone = loyalty.phoneKey(text);
    if (!phone) { await html(msg.chat.id, 'Не похоже на номер телефона. Напишите, например, 87011234567.', replyUi('+7 701 123 45 67')); return true; }
    await askStep(msg.chat.id, { step: 'amount', phone }, s, showGifts);
    return true;
  }
  if (state.step === 'amount') {
    const amount = parsePurchase(`0000000000 ${text}`).amount;
    // Номер телефона вместо суммы или явно лишние цифры — переспрашиваем.
    if (!(Number(amount) > 0) || Number(amount) > 50000000) { await html(msg.chat.id, 'Напишите сумму числом, например 45000.', replyUi('45000')); return true; }
    await db.command('DEL', buyKey(msg.chat.id));
    const who = [msg.from && msg.from.first_name, msg.from && msg.from.last_name].filter(Boolean).join(' ') || 'сотрудник';
    await recordPurchase(msg.chat.id, who, s, showGifts, { phone: state.phone, amount, note: '' });
    return true;
  }
  await db.command('DEL', buyKey(msg.chat.id)); // устаревшее состояние
  return false;
}
const parseJson = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };

async function recordPurchase(chatId, who, s, showGifts, p) {
  const { client } = await loyalty.addPurchase({ phone: p.phone, amount: p.amount, note: p.note, source: 'boutique' }, who);
  const st = loyalty.status(client, s);
  const justGift = st.gifts.length && st.gifts[st.gifts.length - 1].number === st.count ? st.gifts[st.gifts.length - 1] : null;
  const giftLine = justGift
    ? (showGifts ? `\n\n🎁 <b>Это ${justGift.number}-я покупка — положен подарок: ${escape(justGift.gift)}</b> (за ${s.every - 1} предыдущие — ${money(justGift.base, '₸')}).` : '\n\n🎁 <b>Это покупка с подарком.</b> Уточните подарок у владельца.')
    : '';
  return html(chatId, `✅ Покупка записана: ${money(Number(p.amount), '₸')}.${giftLine}\n\n${clientCard(client, st, s, showGifts)}`);
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
  return html(chat.id, `✅ Чат подключён к <b>${escape(shop.config.brand)}</b>. Сюда будут приходить новые заказы и вопросы покупателей.\n\nЧтобы ответить покупателю, просто напишите ответ после его вопроса. На более старый вопрос — нажмите на него и выберите «Ответить».`);
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
    if (q.data === 'bonus') return html(chatId, await bonusForCustomer(chatId));
    return;
  }

  const msg = update.message;
  if (!msg || !msg.chat || (msg.from && msg.from.is_bot)) return;
  const privateChat = msg.chat.type === 'private';
  const text = msg.text || '';
  const cmd = /^\/([\wа-яё]+)(?:@\w+)?(?:\s+([\s\S]+))?$/i.exec(text.trim());

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

  // Команды сотрудников: покупки вне сайта и проверка клиента (в личке и в группе сотрудников).
  if (cmd && STAFF_CMDS.has(cmd[1].toLowerCase()) && (await telegram.isStaff(msg.chat.id))) {
    return staffCommand(msg, cmd[1].toLowerCase(), cmd[2] || '', shop);
  }

  // Ответ сотрудника покупателю.
  if (msg.reply_to_message && (await relayToCustomer(msg))) return;
  // Пошаговая запись покупки (/buy без данных): ответ на вопрос бота.
  if (await continueBuy(msg)) return;
  if (!privateChat) return; // в группах сотрудников бот отвечает только на приглашения и ответы

  if (cmd) {
    if (cmd[1] === 'orders') return html(msg.chat.id, await myOrders(msg.chat.id, shop));
    if (cmd[1] === 'contacts') return html(msg.chat.id, contacts(shop));
    if (cmd[1] === 'bonus') return html(msg.chat.id, await bonusForCustomer(msg.chat.id));
    const m = menu(site, shop);
    return html(msg.chat.id, m.text, { reply_markup: m.markup });
  }
  if (msg.web_app_data || msg.successful_payment) return;
  if (await telegram.isStaff(msg.chat.id)) {
    // Один номер телефона — это проверка клиента, а не ответ покупателю (иначе номер ушёл бы ему).
    if (msg.text && /^[+\d\s().-]{10,22}$/.test(msg.text.trim()) && loyalty.phoneKey(msg.text)) return staffCommand(msg, 'client', msg.text, shop);
    return replyToLast(msg);
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
      { command: 'contacts', description: 'Адрес и телефон' },
      { command: 'bonus', description: 'Подарки за покупки' }
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
