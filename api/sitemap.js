/* /sitemap.xml и /robots.txt (через vercel.json) — для Google и Яндекса.
   Карта сайта собирается из каталога сама: новые ароматы и бренды попадают в неё без настройки. */
const seo = require('../server/seo');

module.exports = async (req, res) => {
  const robots = new URL(req.url, 'http://x').searchParams.has('robots');
  try {
    res.statusCode = 200;
    res.setHeader('Content-Type', robots ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.end(robots ? seo.robots(req) : await seo.sitemap(req));
  } catch (err) {
    console.error('sitemap', err);
    res.statusCode = 500;
    res.end('error');
  }
};
