// Тестовый браузер не ходит через прокси: шрифты Google отдаём через curl с кешем.
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
const dir = new URL('./fontcache/', import.meta.url).pathname; // кэш шрифтов рядом со скриптом
export async function fontRoute(ctx) {
  mkdirSync(dir, { recursive: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const url = route.request().url();
    const key = dir + createHash('md5').update(url).digest('hex');
    let body;
    if (existsSync(key)) body = readFileSync(key);
    else {
      body = execFileSync('curl', ['-s', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', url], { maxBuffer: 50e6 });
      writeFileSync(key, body);
    }
    const css = url.includes('googleapis');
    await route.fulfill({ status: 200, body, headers: { 'content-type': css ? 'text/css' : 'font/woff2', 'access-control-allow-origin': '*' } });
  });
}
