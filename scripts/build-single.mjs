// Собирает весь сайт в один HTML-файл: стили, скрипты и текстуры встраиваются.
// Используется для публикации в виде Artifact или отправки одним файлом.
// Запуск: node scripts/build-single.mjs  →  dist/5th-sense.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const html = read('index.html');

const svgData = (p) => `data:image/svg+xml;base64,${Buffer.from(read(p)).toString('base64')}`;
const css = read('assets/css/style.css').replace(/url\("\.\.\/img\/([\w-]+\.svg)"\)/g, (_, f) => `url("${svgData('assets/img/' + f)}")`);

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const js = scripts.map((src) => `/* ${src} */\n${read(src)}`).join('\n');

const title = html.match(/<title>.*<\/title>/)[0];
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const ld = html.match(/<script type="application\/ld\+json">.*<\/script>/)[0];
const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script src="[^"]+"><\/script>\n?/g, '')
  .trim();

const out = `${title}
<meta name="description" content="Бутик селективной и нишевой парфюмерии 5th SENSE.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
${css}
</style>
${ld}
${body}
<script>
${js}
</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/5th-sense.html'), out);
console.log(`dist/5th-sense.html — ${(out.length / 1024).toFixed(0)} KB`);
