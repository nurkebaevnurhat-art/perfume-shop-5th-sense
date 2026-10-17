/* 5th SENSE — страницы для поисковиков и превью ссылок.
   Открытые страницы (/product-x, /brand-x, /catalog…) отдаются той же index.html,
   но с заголовком, описанием, фото и данными schema.org этой страницы (FS.seo.meta) —
   их видят Google, Яндекс, WhatsApp и Telegram, которые не ждут скриптов сайта. */
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('./catalog');
const products = require('./products');
const { siteUrl } = require('./http');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Постоянный адрес сайта: FS.config.site.url, иначе тот, по которому пришёл запрос.
function origin(req) {
  const site = catalog.load().config.site || {};
  return String(site.url || siteUrl(req) || '').replace(/\/+$/, '');
}

let shellCache = null;
async function shell(base) {
  if (shellCache) return shellCache;
  const file = [path.join(process.cwd(), 'index.html'), path.join(__dirname, '..', 'index.html'), path.join(process.cwd(), 'public', 'index.html')].find((p) => fs.existsSync(p));
  if (file) shellCache = fs.readFileSync(file, 'utf8');
  else {
    const res = await fetch(base + '/index.html');
    if (!res.ok) throw new Error('index.html ' + res.status);
    shellCache = await res.text();
  }
  return shellCache;
}

async function page(req, token) {
  const { seo } = catalog.load();
  const base = origin(req);
  const m = seo.isPublic(token) ? seo.meta(token, await products.list(), base) : { found: false, title: 'Страница не найдена | 5th SENSE' };
  let html = await shell(base);
  const set = (re, tag) => { html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', tag + '\n</head>'); };
  set(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`);
  if (m.found) {
    set(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(m.description)}">`);
    set(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(m.title)}">`);
    set(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(m.description)}">`);
    set(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(m.image)}">`);
    if (/^product-/.test(token)) set(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="product">');
    set(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(m.url)}">`);
    set(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${esc(m.url)}">`);
    if (m.schema) set(/<script type="application\/ld\+json" id="ld-page">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="ld-page">${JSON.stringify(m.schema).replace(/</g, '\\u003c')}</script>`);
  } else {
    set(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex">');
  }
  return { status: m.found ? 200 : 404, html };
}

async function sitemap(req) {
  const { seo } = catalog.load();
  const base = origin(req);
  const urls = seo.tokens(await products.list()).map((t) => `  <url><loc>${esc(base + seo.path(t))}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// Касса, админка и служебные адреса поисковикам не нужны.
function robots(req) {
  return `User-agent: *\nDisallow: /api/\nDisallow: /kassa/\nAllow: /api/image\n\nSitemap: ${origin(req)}/sitemap.xml\n`;
}

module.exports = { page, sitemap, robots, origin };
