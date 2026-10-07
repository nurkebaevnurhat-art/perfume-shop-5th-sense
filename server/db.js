/* 5th SENSE — хранилище заказов: Upstash Redis через REST API.
   На Vercel: Storage → Upstash Redis (Marketplace) → подключить к проекту.
   Переменные KV_REST_API_URL и KV_REST_API_TOKEN (или UPSTASH_REDIS_REST_URL
   и UPSTASH_REDIS_REST_TOKEN) Vercel добавит сам. */

function credentials() {
  const env = process.env;
  const pairs = [['KV_REST_API_URL', 'KV_REST_API_TOKEN'], ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']];
  for (const [u, t] of pairs) if (env[u] && env[t]) return { url: env[u], token: env[t] };
  // Интеграция могла добавить переменные с префиксом, например STORAGE_KV_REST_API_URL.
  for (const key of Object.keys(env)) {
    for (const [u, t] of pairs) {
      if (key.endsWith('_' + u)) {
        const tokenKey = key.slice(0, -u.length) + t;
        if (env[tokenKey]) return { url: env[key], token: env[tokenKey] };
      }
    }
  }
  return null;
}

const configured = () => Boolean(credentials());

async function command(...args) {
  const c = credentials();
  if (!c) throw new Error('Хранилище не подключено');
  const res = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args.map(String)),
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`Redis: ${data.error || res.status}`);
  return data.result;
}

const ORDERS = 'fs:orders';
const SEQ = 'fs:orders:seq';
const CHATS = 'fs:telegram:chats';

const parse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

module.exports = {
  configured,
  command,
  async nextNumber() { return Number(await command('INCR', SEQ)); },
  async saveOrder(order) { await command('HSET', ORDERS, order.number, JSON.stringify(order)); },
  async getOrder(number) { const raw = await command('HGET', ORDERS, number); return raw ? parse(raw) : null; },
  async listOrders() {
    const flat = (await command('HGETALL', ORDERS)) || [];
    const list = [];
    for (let i = 1; i < flat.length; i += 2) { const o = parse(flat[i]); if (o) list.push(o); }
    return list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  },
  async clearOrders() { await command('DEL', ORDERS); },
  // Не больше limit запросов с одного адреса за window секунд.
  async allow(key, limit, window) {
    const k = `fs:rl:${key}`;
    const n = Number(await command('INCR', k));
    if (n === 1) await command('EXPIRE', k, window);
    return n <= limit;
  },
  async getChats() { return parse(await command('GET', CHATS)) || []; },
  async setChats(chats) { if (chats.length) await command('SET', CHATS, JSON.stringify(chats)); else await command('DEL', CHATS); },
  async addChat(chat) {
    const chats = (await this.getChats()).filter((c) => c.id !== chat.id);
    chats.push(chat);
    await this.setChats(chats);
    return chats;
  },

  // Простые ключи со сроком жизни: приглашения сотрудников, связи «сообщение → покупатель».
  async put(key, value, seconds) {
    const args = ['SET', key, typeof value === 'string' ? value : JSON.stringify(value)];
    if (seconds) args.push('EX', seconds);
    await command(...args);
  },
  async take(key) { // прочитать и удалить (одноразовые коды)
    const raw = await command('GET', key);
    if (raw !== null && raw !== undefined) await command('DEL', key);
    return raw;
  },
  get: (key) => command('GET', key),
  // true, если ключа ещё не было (например, «уже отвечали недавно»).
  async once(key, seconds) { return (await command('SET', key, '1', 'NX', 'EX', seconds)) === 'OK'; },
  addToSet: (key, member) => command('SADD', key, member),
  members: async (key) => (await command('SMEMBERS', key)) || []
};
