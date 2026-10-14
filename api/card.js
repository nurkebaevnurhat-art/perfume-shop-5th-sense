/* /api/card — личная карта клиента (открыта всем, у кого есть ссылка).
   GET ?t=…            — счёт покупок: имя, сколько покупок, сколько до подарка.
                         Суммы и названия подарков не показываем.
   GET ?t=…&manifest=1 — манифест, чтобы карту можно было поставить на главный экран. */
const { send, handler, HttpError, clientIp } = require('../server/http');
const db = require('../server/db');
const loyalty = require('../server/loyalty');

const mask = (k) => `+${k[0]} ${k.slice(1, 4)} *** ** ${k.slice(9)}`;

module.exports = handler({
  async GET(req, res) {
    if (!db.configured()) throw new HttpError(503, 'storage_not_configured', 'Карта сейчас недоступна');
    if (!(await db.allow(`card:${clientIp(req)}`, 60, 60))) throw new HttpError(429, 'too_many', 'Слишком много запросов. Подождите минуту.');
    const url = new URL(req.url, 'http://x');
    const token = url.searchParams.get('t');
    const c = await loyalty.byCard(token);
    if (!c) throw new HttpError(404, 'not_found', 'Карта не найдена. Попросите в бутике новую ссылку.');
    if (url.searchParams.get('manifest')) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.statusCode = 200;
      return res.end(JSON.stringify({
        name: 'Карта 5th SENSE', short_name: 'Моя карта', lang: 'ru', id: '/card', start_url: `/#card-${token}`, scope: '/',
        display: 'standalone', background_color: '#0e0c0a', theme_color: '#0e0c0a',
        icons: [
          { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/assets/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }));
    }
    const s = await loyalty.settings();
    const st = loyalty.status(c, s);
    const last = st.gifts[st.gifts.length - 1];
    send(res, 200, {
      name: (c.name || '').trim().split(/\s+/)[0] || '',
      phone: mask(c.phone),
      every: s.every,
      count: st.count,
      nextIsGift: st.nextIsGift,
      left: st.left,
      lastWasGift: Boolean(last && last.number === st.count),
      recent: c.purchases.slice(-5).reverse().map((p) => ({ date: p.date, note: p.note || '' }))
    });
  }
});
