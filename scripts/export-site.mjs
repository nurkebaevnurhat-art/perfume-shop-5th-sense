// Собирает готовый к выкладке сайт в папку public/ (для Vercel и других хостингов):
// пересобирает sw.js и копирует только файлы сайта, без служебных файлов проекта.
// Запуск: node scripts/export-site.mjs
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(root, 'scripts/build-sw.mjs')], { stdio: 'inherit' });

const out = join(root, 'public');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
// Новый файл или папку сайта в корне проекта добавляйте сюда — иначе на Vercel будет 404.
// kassa/ и kassa.webmanifest — касса как отдельное приложение (/kassa/).
for (const f of ['index.html', 'manifest.webmanifest', 'kassa.webmanifest', 'kassa', 'sw.js', '_headers', '_redirects', 'assets']) {
  cpSync(join(root, f), join(out, f), { recursive: true });
}
/* Превью ссылки на главную (WhatsApp, Telegram) требует полный адрес фото.
   Адрес сайта: FS.config.site.url, иначе основной адрес проекта на Vercel. */
const site = (readFileSync(join(root, 'assets/js/config.js'), 'utf8').match(/site:\s*\{[^}]*url:\s*'([^']*)'/) || [])[1]
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
if (site) {
  const origin = site.replace(/\/+$/, '');
  const file = join(out, 'index.html');
  writeFileSync(file, readFileSync(file, 'utf8')
    .replace('<meta property="og:image" content="/', `<meta property="og:image" content="${origin}/`)
    .replace('<meta property="og:url" content="/">', `<meta property="og:url" content="${origin}/">`)
    .replace('<link rel="canonical" href="/">', `<link rel="canonical" href="${origin}/">`));
}
console.log('public/ — сайт готов к выкладке' + (site ? ` (адрес ${site})` : ''));
