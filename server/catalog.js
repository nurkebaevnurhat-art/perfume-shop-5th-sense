/* 5th SENSE — каталог и настройки магазина на сервере.
   Сервер читает те же файлы, что и сайт (assets/js/config.js и data.js),
   поэтому цены и способы доставки в заказе считаются по каталогу, а не
   по данным из браузера покупателя. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FILES = ['assets/js/config.js', 'assets/js/data.js'];
let cached = null;

function locate(file) {
  const candidates = [path.join(process.cwd(), file), path.join(__dirname, '..', file)];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function load() {
  if (cached) return cached;
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of FILES) vm.runInContext(fs.readFileSync(locate(file), 'utf8'), sandbox, { filename: file });
  const FS = sandbox.FS;
  const products = new Map(FS.defaultProducts.map((p) => [p.id, p]));
  cached = { config: FS.config, delivery: FS.delivery, payments: FS.paymentMethods, products };
  return cached;
}

module.exports = { load };
