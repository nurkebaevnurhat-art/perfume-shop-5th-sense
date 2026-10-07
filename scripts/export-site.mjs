// Собирает готовый к выкладке сайт в папку public/ (для Vercel и других хостингов):
// пересобирает sw.js и копирует только файлы сайта, без служебных файлов проекта.
// Запуск: node scripts/export-site.mjs
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(root, 'scripts/build-sw.mjs')], { stdio: 'inherit' });

const out = join(root, 'public');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', '_headers', '_redirects', 'assets']) {
  cpSync(join(root, f), join(out, f), { recursive: true });
}
console.log('public/ — сайт готов к выкладке');
