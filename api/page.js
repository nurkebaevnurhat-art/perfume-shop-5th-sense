/* /api/page?p=<страница> — открытые страницы сайта по обычным адресам (/product-x, /catalog…).
   Сюда их направляет vercel.json (rewrites): та же index.html, но с заголовком,
   описанием и фото страницы для поисковиков и превью ссылок (server/seo.js). */
const seo = require('../server/seo');

module.exports = async (req, res) => {
  const token = new URL(req.url, 'http://x').searchParams.get('p') || '';
  try {
    const { status, html } = await seo.page(req, token);
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // CDN держит страницу 10 минут и обновляет в фоне: новые цены и ароматы появляются сами.
    res.setHeader('Cache-Control', status === 200 ? 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' : 'no-store');
    res.end(html);
  } catch (err) {
    console.error('page', err);
    // Что-то сломалось — отправляем на главную со старым адресом-якорем: сайт откроет страницу сам.
    res.statusCode = 302;
    res.setHeader('Location', '/#' + token.replace(/[^a-z0-9-]/g, ''));
    res.end();
  }
};
