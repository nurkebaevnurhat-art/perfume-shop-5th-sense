/* /api/image — фото товаров, загруженные в админке.
   GET  ?n=имя-файла&v=версия — само изображение (кэшируется браузером и CDN).
   POST { name, type, data } — загрузить фото (base64, до 600 КБ, нужен пароль). */
const { send, readJson, handler, HttpError, requireAdmin } = require('../server/http');
const products = require('../server/products');

module.exports = handler({
  async GET(req, res) {
    const q = new URL(req.url, 'http://x').searchParams;
    const img = await products.getImage(q.get('n') || '');
    if (!img) throw new HttpError(404, 'not_found', 'Фото не найдено');
    res.statusCode = 200;
    res.setHeader('Content-Type', img.type);
    // С версией в адресе фото не меняется: кэшируем надолго.
    res.setHeader('Cache-Control', q.get('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=300, s-maxage=3600');
    res.end(Buffer.from(img.data, 'base64'));
  },

  async POST(req, res) {
    requireAdmin(req);
    const body = await readJson(req);
    send(res, 200, await products.saveImage(body.name, body.type, body.data));
  }
});
