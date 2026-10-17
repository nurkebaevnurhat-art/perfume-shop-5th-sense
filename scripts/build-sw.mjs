// Собирает sw.js: список файлов для офлайн-кэша и версию кэша по содержимому.
// Запускайте после изменения файлов сайта: node scripts/build-sw.mjs
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Касса — отдельное приложение по адресу /kassa/: своя страница и свой манифест
   (scope /kassa/), чтобы Chrome и iPhone ставили её рядом с приложением 5th SENSE.
   Страница собирается из index.html: <base href="../"> — те же файлы сайта. */
const index = readFileSync(join(root, 'index.html'), 'utf8');
const swap = (s, from, to) => { if (!s.includes(from)) throw new Error(`kassa/index.html: не нашли «${from}» в index.html`); return s.replace(from, to); };
let kassaHtml = swap(index, '<head>\n', '<head>\n<!-- Собрано из index.html скриптом scripts/build-sw.mjs — не правьте руками. -->\n<base href="../">\n');
kassaHtml = kassaHtml.replace(/<title>[^<]*<\/title>/, '<title>Касса — 5th SENSE</title>');
kassaHtml = swap(kassaHtml, '<link rel="manifest" href="manifest.webmanifest">', `<link rel="manifest" href="kassa.webmanifest">\n<script>if (location.hash !== '#kassa') history.replaceState(null, '', location.pathname + '#kassa');</script>`);
kassaHtml = swap(kassaHtml, '<meta name="apple-mobile-web-app-title" content="5th SENSE">', '<meta name="apple-mobile-web-app-title" content="Касса">');
// Касса — рабочая страница: поисковикам не показываем.
kassaHtml = swap(kassaHtml, '<link rel="canonical" href="/">', '<meta name="robots" content="noindex">');
// На сайте код кассы догружается при входе (LAZY в app.js), а здесь он нужен сразу.
kassaHtml = swap(kassaHtml, '<script src="assets/js/pwa.js"></script>', '<script src="assets/js/qr.js"></script>\n<script src="assets/js/views/kassa.js"></script>\n<script src="assets/js/pwa.js"></script>');
mkdirSync(join(root, 'kassa'), { recursive: true });
writeFileSync(join(root, 'kassa/index.html'), kassaHtml);
const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(dir, f);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});
const files = ['index.html', 'kassa/index.html', 'manifest.webmanifest', 'kassa.webmanifest', ...walk('assets')]
  // Фото товаров и файлы для скачивания не скачиваем заранее: при сотнях товаров это десятки мегабайт.
  // Они сохраняются в телефон по мере просмотра (см. sw.template.js).
  .filter((f) => !/\.(md|DS_Store)$/.test(f) && !f.includes('brand-sign') && !/^assets[\\/](products|files)[\\/]/.test(f))
  .map((f) => f.split('\\').join('/'))
  .sort();
const hash = createHash('sha256');
files.forEach((f) => hash.update(f).update(readFileSync(join(root, f))));
const version = hash.digest('hex').slice(0, 10);
const template = readFileSync(join(root, 'scripts/sw.template.js'), 'utf8');
const out = template
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(['./', ...files], null, 2));
writeFileSync(join(root, 'sw.js'), out);
console.log(`sw.js — версия ${version}, файлов в кэше: ${files.length + 1}`);
