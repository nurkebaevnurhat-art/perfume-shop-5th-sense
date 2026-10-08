/* /api/products — каталог.
   GET    — каталог для сайта: { version, products } или { products: null },
            если каталог ещё не сохраняли на сервере (сайт берёт data.js).
   PUT    — заменить весь каталог: { products: [...] } (загрузка таблицы, нужен пароль).
   PATCH  — добавить или изменить товар: { product } (нужен пароль).
   DELETE — удалить товар: ?id=… (нужен пароль).
   POST   — { action: 'reset' } вернуть каталог из data.js (нужен пароль). */
const { send, readJson, handler, HttpError, requireAdmin } = require('../server/http');
const products = require('../server/products');

module.exports = handler({
  async GET(req, res) {
    const items = await products.stored();
    const meta = items ? await products.meta() : null;
    // Короткий кэш на CDN Vercel: сотни покупателей не нагружают базу.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=60');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(items ? { version: meta && meta.version, updatedAt: meta && meta.updatedAt, products: items } : { products: null }));
  },

  async PUT(req, res) {
    requireAdmin(req);
    const body = await readJson(req);
    const meta = await products.replace(body.products);
    send(res, 200, { ok: true, ...meta });
  },

  async PATCH(req, res) {
    requireAdmin(req);
    const body = await readJson(req);
    send(res, 200, await products.upsert(body.product));
  },

  async DELETE(req, res) {
    requireAdmin(req);
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    if (!id) throw new HttpError(400, 'invalid', 'Не указан товар');
    send(res, 200, { ok: true, meta: await products.remove(id) });
  },

  async POST(req, res) {
    requireAdmin(req);
    const { action } = await readJson(req);
    if (action !== 'reset') throw new HttpError(400, 'invalid', 'Неизвестное действие');
    await products.reset();
    send(res, 200, { ok: true });
  }
});
