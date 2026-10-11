// Собирает sw.js: список файлов для офлайн-кэша и версию кэша по содержимому.
// Запускайте после изменения файлов сайта: node scripts/build-sw.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(dir, f);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});
const files = ['index.html', 'manifest.webmanifest', ...walk('assets')]
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
