/* 5th SENSE — данные каталога.
   Сейчас каталог лежит в этом файле. Формат объектов совпадает с тем,
   что должен отдавать будущий API (/api/products), — см. README.

   Поля товара:
   id          — slug, используется в адресе страницы
   type        — 'perfume' | 'set'
   gender      — 'men' | 'women' | 'unisex'
   family      — id из FS.families
   volumes     — [{ ml, price, stock }] — stock: остаток на складе
   main        — объём, который показываем в карточке
   notes       — { top, heart, base } — массивы нот
   longevity   — стойкость 1–5, sillage — шлейф 1–5
   bottle      — параметры иллюстрации флакона (assets/js/bottle.js)
   image       — необязательный URL фото; если задан, заменяет иллюстрацию
*/
window.FS = window.FS || {};

FS.families = [
  { id: 'woody', name: 'Древесные', notes: 'кедр, сандал, ветивер, уд', tint: '#8a5a33' },
  { id: 'amber', name: 'Восточные', notes: 'амбра, ваниль, ладан, специи', tint: '#a8642a' },
  { id: 'floral', name: 'Цветочные', notes: 'роза, жасмин, ирис, пион', tint: '#c48c88' },
  { id: 'fruity', name: 'Фруктовые', notes: 'смородина, личи, груша, ананас', tint: '#a4475f' },
  { id: 'fresh', name: 'Свежие', notes: 'бергамот, лимон, морские ноты', tint: '#9fb08a' },
  { id: 'gourmand', name: 'Гурманские', notes: 'коньяк, пралине, тонка, вишня', tint: '#6e2e1e' },
  { id: 'chypre', name: 'Шипровые', notes: 'дубовый мох, пачули, кожа', tint: '#5b6040' }
];

FS.categories = [
  { id: 'men', name: 'Мужская парфюмерия', short: 'Мужская', lead: 'Древесина, специи и кожа. Ароматы с характером и выдержкой.', match: (p) => p.gender === 'men' },
  { id: 'women', name: 'Женская парфюмерия', short: 'Женская', lead: 'Цветы, смолы и мускус. От прозрачной лёгкости до вечерней глубины.', match: (p) => p.gender === 'women' },
  { id: 'unisex', name: 'Унисекс', short: 'Унисекс', lead: 'Ароматы вне правил, которые одинаково звучат на любой коже.', match: (p) => p.gender === 'unisex' },
  { id: 'niche', name: 'Нишевая парфюмерия', short: 'Нишевая', lead: 'Независимые дома и авторские композиции малыми партиями.', match: (p) => p.niche },
  { id: 'bestsellers', name: 'Бестселлеры', short: 'Бестселлеры', lead: 'Ароматы, за которыми в бутик возвращаются снова.', match: (p) => p.bestseller },
  { id: 'new', name: 'Новинки', short: 'Новинки', lead: 'Последние поступления на полки бутика.', match: (p) => p.isNew },
  { id: 'gifts', name: 'Подарочные наборы', short: 'Наборы', lead: 'Собранные нами сеты и миниатюры в фирменной коробке.', match: (p) => p.type === 'set' }
];

FS.genderLabel = { men: 'Мужской', women: 'Женский', unisex: 'Унисекс' };
FS.concentrationLabel = {
  EDP: 'Eau de Parfum',
  EDT: 'Eau de Toilette',
  Parfum: 'Parfum',
  Cologne: 'Cologne',
  Extrait: 'Extrait de Parfum',
  Set: 'Набор'
};

/* Каталог по умолчанию. Админ-панель сохраняет изменённую копию в браузере
   (см. FS.catalog в api.js); эти данные остаются исходными. */
FS.defaultProducts = [
  {
    id: 'baccarat-rouge-540', type: 'perfume', image: 'assets/products/baccarat-rouge-540.jpg',
    name: 'Baccarat Rouge 540', brand: 'Maison Francis Kurkdjian',
    gender: 'unisex', family: 'amber', concentration: 'EDP', year: 2015,
    perfumer: 'Франсис Куркджян', country: 'Франция',
    niche: true, bestseller: true, featured: true,
    volumes: [{ ml: 35, price: 118000, stock: 4 }, { ml: 70, price: 189000, stock: 6 }, { ml: 200, price: 389000, stock: 1 }],
    main: 70,
    short: 'Шафран и жасмин над прозрачной амбровой древесиной.',
    description: 'Композиция, созданная к юбилею хрустальной мануфактуры Baccarat. Шафран и жасмин раскрываются поверх амбровой древесины и смолы ели, оставляя за собой сияющий, почти сахарный шлейф. Аромат одинаково звучит днём и вечером и узнаётся с первого вдоха.',
    notes: { top: ['шафран', 'жасмин'], heart: ['амбровое дерево', 'амбра'], base: ['смола ели', 'кедр'] },
    longevity: 5, sillage: 5,
    bottle: { shape: 'block', cap: 'cube', liquid: '#c9643f', capColor: 'gold', label: 'MFK' }
  },
  {
    id: 'oud-wood', type: 'perfume', image: 'assets/products/oud-wood.jpg',
    name: 'Oud Wood', brand: 'Tom Ford',
    gender: 'unisex', family: 'woody', concentration: 'EDP', year: 2007,
    perfumer: 'Ришар Эрпен', country: 'США',
    niche: true, bestseller: true,
    volumes: [{ ml: 30, price: 109000, stock: 3 }, { ml: 50, price: 159000, stock: 5 }, { ml: 100, price: 239000, stock: 2 }],
    main: 50,
    short: 'Мягкий уд с кардамоном и сандалом, тёплый и сдержанный.',
    description: 'Редкое дерево уд, смягчённое розовым деревом, кардамоном и сандалом. Тонка и ваниль делают его тёплым и бархатистым. Тихий, но очень узнаваемый аромат из коллекции Private Blend.',
    notes: { top: ['розовое дерево', 'кардамон', 'китайский перец'], heart: ['уд', 'сандал', 'ветивер'], base: ['бобы тонка', 'ваниль', 'амбра'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'block', cap: 'cube', liquid: '#3b2414', capColor: 'black', label: 'TOM FORD' }
  },
  {
    id: 'santal-33', type: 'perfume', image: 'assets/products/santal-33.jpg',
    name: 'Santal 33', brand: 'Le Labo',
    gender: 'unisex', family: 'woody', concentration: 'EDP', year: 2011,
    perfumer: 'Франк Фёлькль', country: 'США',
    niche: true, bestseller: true,
    volumes: [{ ml: 50, price: 139000, stock: 6 }, { ml: 100, price: 199000, stock: 4 }],
    main: 50,
    short: 'Сандал, кожа и кардамон. Сухой, дымный, узнаваемый.',
    description: 'Австралийский сандал с кожей, кедром и папирусом. Кардамон и фиалка добавляют лёгкую пряность. Аромат, который стал символом нового поколения нишевой парфюмерии.',
    notes: { top: ['кардамон', 'ирис', 'фиалка'], heart: ['амброксан', 'папирус'], base: ['сандал', 'кедр', 'кожа'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'cylinder', cap: 'disc', liquid: '#d8c9a8', capColor: 'black', label: 'SANTAL 33', labelStyle: 'paper' }
  },
  {
    id: 'le-labo-the-matcha-26', type: 'perfume', image: 'assets/products/le-labo-the-matcha-26.jpg',
    name: 'Thé Matcha 26', brand: 'Le Labo',
    gender: 'unisex', family: 'woody', concentration: 'EDP', year: 2022, country: 'США',
    niche: true, isNew: true,
    volumes: [{ ml: 50, price: 139000, stock: 4 }, { ml: 100, price: 199000, stock: 2 }],
    main: 100,
    short: 'Чай матча, инжир и кедр. Зелёный и спокойный.',
    description: 'Терпкий зелёный чай матча с мягкой сладостью инжира на древесной базе из кедра и ветивера. Чистый, медитативный аромат для каждого дня.',
    notes: { top: ['чай матча'], heart: ['инжир'], base: ['кедр', 'ветивер'] },
    longevity: 3, sillage: 2,
    bottle: { shape: 'cylinder', cap: 'tall', liquid: '#eef0ea', capColor: 'silver', label: 'THÉ MATCHA 26', labelStyle: 'paper' }
  },
  {
    id: 'le-labo-the-noir-29', type: 'perfume', image: 'assets/products/le-labo-the-noir-29.jpg',
    name: 'Thé Noir 29', brand: 'Le Labo',
    gender: 'unisex', family: 'woody', concentration: 'EDP', year: 2015, country: 'США',
    niche: true,
    volumes: [{ ml: 50, price: 139000, stock: 3 }, { ml: 100, price: 199000, stock: 2 }],
    main: 100,
    short: 'Чёрный чай, инжир и лавровый лист на кедре.',
    description: 'Дымный чёрный чай с инжиром, бергамотом и лавровым листом. Кедр, ветивер и табачные ноты дают глубокий тёплый шлейф.',
    notes: { top: ['бергамот', 'инжир', 'лавровый лист'], heart: ['чёрный чай'], base: ['кедр', 'ветивер', 'мускус', 'табак'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'cylinder', cap: 'tall', liquid: '#f1efe8', capColor: 'silver', label: 'THÉ NOIR 29', labelStyle: 'paper' }
  },
  {
    id: 'byredo-blanche', type: 'perfume', image: 'assets/products/byredo-blanche.jpg',
    name: 'Blanche', brand: 'Byredo',
    gender: 'women', family: 'floral', concentration: 'EDP', year: 2009,
    perfumer: 'Жером Эпинет', country: 'Швеция',
    niche: true,
    volumes: [{ ml: 50, price: 98000, stock: 5 }, { ml: 100, price: 139000, stock: 3 }],
    main: 100,
    short: 'Белая роза, альдегиды и мускус. Аромат чистоты.',
    description: 'Аромат свежевыстиранной белой ткани: альдегиды и белая роза, пион и нероли, мягкий мускус и светлые древесные ноты.',
    notes: { top: ['альдегиды', 'белая роза', 'розовый перец'], heart: ['пион', 'фиалка', 'нероли'], base: ['мускус', 'светлые древесные ноты', 'сандал'] },
    longevity: 3, sillage: 2,
    bottle: { shape: 'block', cap: 'sphere', liquid: '#efe9dc', capColor: 'black', label: 'BYREDO', labelStyle: 'paper' }
  },
  {
    id: 'byredo-bal-dafrique', type: 'perfume', image: 'assets/products/byredo-bal-dafrique.jpg',
    name: "Bal d'Afrique", brand: 'Byredo',
    gender: 'unisex', family: 'floral', concentration: 'EDP', year: 2009,
    perfumer: 'Жером Эпинет', country: 'Швеция',
    niche: true,
    volumes: [{ ml: 50, price: 98000, stock: 4 }, { ml: 100, price: 139000, stock: 3 }],
    main: 100,
    short: 'Бергамот, бархатцы и ветивер. Тёплый и солнечный.',
    description: 'Посвящение парижской моде 1920-х и Африке: цитрусы и африканские бархатцы, фиалка и жасмин, ветивер, мускус и кедр в базе.',
    notes: { top: ['бергамот', 'лимон', 'нероли', 'бархатцы'], heart: ['фиалка', 'цикламен', 'жасмин'], base: ['ветивер', 'мускус', 'амбра', 'кедр'] },
    longevity: 3, sillage: 3,
    bottle: { shape: 'block', cap: 'sphere', liquid: '#efe6d6', capColor: 'black', label: 'BYREDO', labelStyle: 'paper' }
  },
  {
    id: 'byredo-sundazed', type: 'perfume', image: 'assets/products/byredo-sundazed.jpg',
    name: 'Sundazed', brand: 'Byredo',
    gender: 'unisex', family: 'fruity', concentration: 'EDP', year: 2019, country: 'Швеция',
    niche: true, isNew: true,
    volumes: [{ ml: 50, price: 98000, stock: 4 }, { ml: 100, price: 139000, stock: 2 }],
    main: 100,
    short: 'Мандарин, жасмин и сахарная вата. Аромат лета.',
    description: 'Беззаботный летний аромат: сочные мандарин и лимон, жасмин самбак и нероли, мягкий мускус и нота сахарной ваты.',
    notes: { top: ['мандарин', 'лимон'], heart: ['жасмин самбак', 'нероли'], base: ['сахарная вата', 'мускус'] },
    longevity: 3, sillage: 3,
    bottle: { shape: 'block', cap: 'sphere', liquid: '#f3ead2', capColor: 'black', label: 'BYREDO', labelStyle: 'paper' }
  },
  {
    id: 'crivelli-oud-maracuja', type: 'perfume', image: 'assets/products/crivelli-oud-maracuja.jpg',
    name: 'Oud Maracujá', brand: 'Maison Crivelli',
    gender: 'unisex', family: 'woody', concentration: 'Extrait', year: 2019,
    perfumer: 'Кантен Биш', country: 'Франция',
    niche: true,
    volumes: [{ ml: 50, price: 129000, stock: 3 }],
    main: 50,
    short: 'Маракуйя, шафран и уд. Сочный и дымный.',
    description: 'Неожиданное сочетание тропической маракуйи и тёмного уда. Шафран, роза и кожа делают экстракт глубоким и долгим.',
    notes: { top: ['маракуйя', 'шафран'], heart: ['роза', 'кожа'], base: ['уд', 'пачули'] },
    longevity: 5, sillage: 4,
    bottle: { shape: 'tower', cap: 'tall', liquid: '#1d2e5a', capColor: 'silver', label: 'CRIVELLI', labelStyle: 'paper' }
  },
  {
    id: 'kilian-straight-to-heaven', type: 'perfume', image: 'assets/products/kilian-straight-to-heaven.jpg',
    name: 'Straight to Heaven', brand: 'Kilian Paris',
    gender: 'men', family: 'gourmand', concentration: 'EDP', year: 2007,
    perfumer: 'Сидони Ланссёр', country: 'Франция',
    niche: true,
    volumes: [{ ml: 50, price: 145000, stock: 3 }],
    main: 50,
    short: 'Ром, мускатный орех и пачули. White Cristal.',
    description: 'Тёмный ром с сухофруктами, мускатным орехом и пачули. Кедр, ваниль и амбра дают бархатный шлейф. Флакон в чёрной лакированной шкатулке.',
    notes: { top: ['ром', 'мускатный орех'], heart: ['пачули', 'сухофрукты'], base: ['кедр', 'ваниль', 'амбра'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'tower', cap: 'tall', liquid: '#1a1714', capColor: 'gold', label: 'KILIAN' }
  },
  {
    id: 'clive-christian-1872', type: 'perfume', image: 'assets/products/clive-christian-1872.jpg',
    name: '1872 Masculine', brand: 'Clive Christian',
    gender: 'men', family: 'fresh', concentration: 'Parfum', year: 2001, country: 'Великобритания',
    niche: true,
    volumes: [{ ml: 50, price: 189000, stock: 2 }],
    main: 50,
    short: 'Грейпфрут, розмарин и ветивер. Британская классика.',
    description: 'Свежий цитрусовый аромат с травами: грейпфрут, мандарин и бергамот, розмарин и шалфей, ветивер и сандал в базе. Флакон с короной Clive Christian.',
    notes: { top: ['грейпфрут', 'мандарин', 'бергамот'], heart: ['розмарин', 'мускатный шалфей'], base: ['ветивер', 'сандал', 'мускус'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'block', cap: 'orb', liquid: '#1f5a2a', capColor: 'gold', label: 'CLIVE CHRISTIAN' }
  },
  {
    id: 'clive-christian-matsukita', type: 'perfume', image: 'assets/products/clive-christian-matsukita.jpg',
    name: 'Matsukita', brand: 'Clive Christian',
    gender: 'unisex', family: 'woody', concentration: 'Parfum', year: 2019, country: 'Великобритания',
    niche: true, isNew: true, featured: true,
    volumes: [{ ml: 50, price: 249000, stock: 2 }],
    main: 50,
    short: 'Японский кедр, ладан и уд. Crown Collection.',
    description: 'Аромат из Crown Collection, вдохновлённый японскими садами: пряное начало, ладан и кедр в сердце и тёмный древесный шлейф.',
    notes: { top: ['юдзу', 'перец'], heart: ['ладан', 'кедр'], base: ['уд', 'ветивер'] },
    longevity: 5, sillage: 4,
    bottle: { shape: 'block', cap: 'orb', liquid: '#c51a1a', capColor: 'gold', label: 'CLIVE CHRISTIAN' }
  },
  {
    id: 'montale-vanilla-extasy', type: 'perfume', image: 'assets/products/montale-vanilla-extasy.jpg',
    name: 'Vanilla Extasy', brand: 'Montale',
    gender: 'women', family: 'gourmand', concentration: 'EDP', year: 2009, country: 'Франция',
    niche: true,
    volumes: [{ ml: 100, price: 69000, stock: 5 }],
    main: 100,
    short: 'Ваниль, флёрдоранж и мускус. Сладкий и тёплый.',
    description: 'Насыщенная ваниль с белыми цветами и флёрдоранжем на мягком мускусе. Стойкий уютный аромат в узнаваемом алюминиевом флаконе Montale.',
    notes: { top: ['флёрдоранж'], heart: ['белые цветы', 'ваниль'], base: ['мускус', 'ваниль'] },
    longevity: 5, sillage: 4,
    bottle: { shape: 'cylinder', cap: 'disc', liquid: '#c9ccd0', capColor: 'silver', label: 'MONTALE' }
  },
  {
    id: 'layton', type: 'perfume', image: 'assets/products/layton.jpg',
    name: 'Layton', brand: 'Parfums de Marly',
    gender: 'men', family: 'amber', concentration: 'EDP', year: 2016,
    perfumer: 'Хамид Мерати-Кашани', country: 'Франция',
    niche: true, bestseller: true,
    volumes: [{ ml: 75, price: 99000, stock: 6 }, { ml: 125, price: 135000, stock: 4 }],
    main: 125,
    short: 'Яблоко, лаванда и ваниль с кардамоном.',
    description: 'Свежее яблоко и лаванда открывают аромат, сердце из герани и фиалки ведёт к тёплой базе: ваниль, кардамон, сандал и гваяк. Универсальный аромат для холодного сезона.',
    notes: { top: ['яблоко', 'лаванда', 'бергамот', 'мандарин'], heart: ['герань', 'фиалка', 'жасмин'], base: ['ваниль', 'кардамон', 'сандал', 'пачули'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'flask', cap: 'tall', liquid: '#1d2c4f', capColor: 'silver', label: 'MARLY' }
  },
  {
    id: 'marly-althair', type: 'perfume', image: 'assets/products/marly-althair.jpg',
    name: 'Althaïr', brand: 'Parfums de Marly',
    gender: 'men', family: 'gourmand', concentration: 'EDP', year: 2023, country: 'Франция',
    niche: true, isNew: true,
    volumes: [{ ml: 75, price: 109000, stock: 4 }, { ml: 125, price: 145000, stock: 3 }],
    main: 125,
    short: 'Корица, кардамон и пралине на бурбонской ванили.',
    description: 'Пряное начало из корицы, кардамона и флёрдоранжа переходит в бурбонскую ваниль и пралине. Мускус и гваяковое дерево делают аромат мягким и тёплым.',
    notes: { top: ['корица', 'кардамон', 'флёрдоранж', 'бергамот'], heart: ['бурбонская ваниль', 'пралине'], base: ['мускус', 'гваяк', 'амбра'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'flask', cap: 'tall', liquid: '#b8622e', capColor: 'silver', label: 'MARLY' }
  },
  {
    id: 'creed-green-irish-tweed', type: 'perfume', image: 'assets/products/creed-green-irish-tweed.jpg',
    name: 'Green Irish Tweed', brand: 'Creed',
    gender: 'men', family: 'fresh', concentration: 'EDP', year: 1985, country: 'Франция',
    niche: true, bestseller: true,
    volumes: [{ ml: 50, price: 129000, stock: 4 }, { ml: 100, price: 179000, stock: 3 }],
    main: 100,
    short: 'Вербена, листья фиалки и сандал. Зелёная свежесть.',
    description: 'Классика Creed: лимонная вербена и мята, листья фиалки и ирис, сандал и амбра. Аромат свежескошенной травы и прогулки по ирландским холмам.',
    notes: { top: ['лимонная вербена', 'мята'], heart: ['листья фиалки', 'ирис'], base: ['сандал', 'амбра'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'tower', cap: 'tall', liquid: '#232323', capColor: 'black', label: 'CREED' }
  },
  {
    id: 'tom-ford-ombre-leather', type: 'perfume', image: 'assets/products/tom-ford-ombre-leather.jpg',
    name: 'Ombré Leather', brand: 'Tom Ford',
    gender: 'unisex', family: 'chypre', concentration: 'EDP', year: 2018,
    perfumer: 'Соня Констан', country: 'США',
    bestseller: true,
    volumes: [{ ml: 50, price: 69000, stock: 7 }, { ml: 100, price: 95000, stock: 5 }],
    main: 100,
    short: 'Кожа, кардамон и жасмин. Пустынный ветер.',
    description: 'Мягкая кожа с кардамоном и жасмином самбак на фоне амбры, мха и пачули. Тёплый, чувственный и очень стойкий аромат.',
    notes: { top: ['кардамон'], heart: ['кожа', 'жасмин самбак'], base: ['амбра', 'мох', 'пачули'] },
    longevity: 5, sillage: 4,
    bottle: { shape: 'block', cap: 'cube', liquid: '#1a1a1a', capColor: 'black', label: 'TOM FORD' }
  },
  {
    id: 'dior-sauvage-elixir', type: 'perfume', image: 'assets/products/dior-sauvage-elixir.jpg',
    name: 'Sauvage Elixir', brand: 'Dior',
    gender: 'men', family: 'amber', concentration: 'Parfum', year: 2021,
    perfumer: 'Франсуа Демаши', country: 'Франция',
    bestseller: true,
    volumes: [{ ml: 60, price: 79000, stock: 8 }, { ml: 100, price: 99000, stock: 6 }],
    main: 100,
    short: 'Грейпфрут, пряности и лакрица. Концентрированный Sauvage.',
    description: 'Самая насыщенная версия Sauvage: грейпфрут, корица и мускатный орех, сердце из лаванды и густая база из лакрицы, сандала и амбры.',
    notes: { top: ['грейпфрут', 'корица', 'мускатный орех', 'кардамон'], heart: ['лаванда'], base: ['лакрица', 'сандал', 'амбра', 'пачули'] },
    longevity: 5, sillage: 5,
    bottle: { shape: 'block', cap: 'disc', liquid: '#14274d', capColor: 'black', label: 'DIOR' }
  },
  {
    id: 'dg-the-one', type: 'perfume', image: 'assets/products/dg-the-one.jpg',
    name: 'The One for Men', brand: 'Dolce & Gabbana',
    gender: 'men', family: 'amber', concentration: 'EDP', year: 2015, country: 'Италия',
    volumes: [{ ml: 50, price: 49000, stock: 9 }, { ml: 100, price: 64000, stock: 6 }],
    main: 100,
    short: 'Грейпфрут, кардамон и табак. Вечерняя классика.',
    description: 'Элегантный восточный аромат: грейпфрут и кориандр, кардамон и имбирь, тёплая база из табака, амбры и кедра.',
    notes: { top: ['грейпфрут', 'кориандр', 'базилик'], heart: ['кардамон', 'имбирь', 'флёрдоранж'], base: ['табак', 'амбра', 'кедр'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'block', cap: 'cube', liquid: '#b06a22', capColor: 'black', label: 'D&G' }
  },
  {
    id: 'armani-stronger-with-you-intensely', type: 'perfume', image: 'assets/products/armani-stronger-with-you-intensely.jpg',
    name: 'Stronger With You Intensely', brand: 'Emporio Armani',
    gender: 'men', family: 'gourmand', concentration: 'EDP', year: 2019, country: 'Италия',
    bestseller: true,
    volumes: [{ ml: 50, price: 52000, stock: 8 }, { ml: 100, price: 69000, stock: 6 }],
    main: 100,
    short: 'Ирис, корица и тоффи на ванили.',
    description: 'Тёплая гурманская версия Stronger With You: розовый перец и можжевельник, тоффи, корица и лаванда, ваниль, тонка и замша в базе.',
    notes: { top: ['розовый перец', 'можжевельник', 'мандарин'], heart: ['тоффи', 'корица', 'лаванда'], base: ['ваниль', 'тонка', 'амбра', 'замша'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'flask', cap: 'sphere', liquid: '#b3541e', capColor: 'silver', label: 'ARMANI' }
  },
  {
    id: 'jo-malone-peony-blush-suede', type: 'perfume', image: 'assets/products/jo-malone-peony-blush-suede.jpg',
    name: 'Peony & Blush Suede', brand: 'Jo Malone London',
    gender: 'women', family: 'floral', concentration: 'Cologne', year: 2013,
    perfumer: 'Кристин Нагель', country: 'Великобритания',
    volumes: [{ ml: 30, price: 39000, stock: 6 }, { ml: 100, price: 79000, stock: 4 }],
    main: 100,
    short: 'Пион, красное яблоко и замша.',
    description: 'Пышный пион с сочным красным яблоком, жасмином и розой на мягкой замше. Нежный и при этом уверенный цветочный аромат.',
    notes: { top: ['красное яблоко'], heart: ['пион', 'жасмин', 'роза'], base: ['замша'] },
    longevity: 2, sillage: 2,
    bottle: { shape: 'tower', cap: 'tall', liquid: '#f3e2cf', capColor: 'silver', label: 'JO MALONE', labelStyle: 'paper' }
  },
  {
    id: 'lv-afternoon-swim', type: 'perfume', image: 'assets/products/lv-afternoon-swim.jpg',
    name: 'Afternoon Swim', brand: 'Louis Vuitton',
    gender: 'unisex', family: 'fresh', concentration: 'Cologne', year: 2019,
    perfumer: 'Жак Кавалье-Беллетрюд', country: 'Франция',
    volumes: [{ ml: 100, price: 189000, stock: 3 }],
    main: 100,
    short: 'Мандарин, бергамот и имбирь. Солнце и море.',
    description: 'Взрыв цитрусов: мандарин, бергамот и апельсин с искрой имбиря на мягкой амбре. Аромат летнего дня у воды.',
    notes: { top: ['мандарин', 'бергамот', 'апельсин'], heart: ['имбирь'], base: ['амбра'] },
    longevity: 3, sillage: 3,
    bottle: { shape: 'flask', cap: 'cube', liquid: '#3fa3d9', capColor: 'black', label: 'LOUIS VUITTON' }
  },
  {
    id: 'lv-imagination', type: 'perfume', image: 'assets/products/lv-imagination.jpg',
    name: 'Imagination', brand: 'Louis Vuitton',
    gender: 'men', family: 'fresh', concentration: 'EDP', year: 2021,
    perfumer: 'Жак Кавалье-Беллетрюд', country: 'Франция',
    isNew: true,
    volumes: [{ ml: 100, price: 189000, stock: 3 }],
    main: 100,
    short: 'Цитрон, чёрный чай и имбирь.',
    description: 'Свежий цитрусовый аромат с калабрийским бергамотом и цитроном, китайским чёрным чаем, имбирём и корицей на базе из амброксана и гваяка.',
    notes: { top: ['цитрон', 'бергамот', 'апельсин'], heart: ['чёрный чай', 'имбирь', 'корица', 'нероли'], base: ['амброксан', 'гваяк', 'ладан'] },
    longevity: 3, sillage: 3,
    bottle: { shape: 'flask', cap: 'cube', liquid: '#7fd0cf', capColor: 'black', label: 'LOUIS VUITTON' }
  },
  {
    id: 'lv-les-sables-roses', type: 'perfume', image: 'assets/products/lv-les-sables-roses.jpg',
    name: 'Les Sables Roses', brand: 'Louis Vuitton',
    gender: 'unisex', family: 'amber', concentration: 'EDP', year: 2019,
    perfumer: 'Жак Кавалье-Беллетрюд', country: 'Франция',
    volumes: [{ ml: 100, price: 229000, stock: 2 }],
    main: 100,
    short: 'Роза, уд и амбра. Розовые пески пустыни.',
    description: 'Роза и уд с шафраном и амброй. Тёплый восточный аромат, вдохновлённый розовыми песками пустыни на закате.',
    notes: { top: ['шафран'], heart: ['роза'], base: ['уд', 'амбра', 'белый мускус'] },
    longevity: 5, sillage: 4,
    bottle: { shape: 'flask', cap: 'cube', liquid: '#3a2420', capColor: 'black', label: 'LOUIS VUITTON' }
  },
  {
    id: 'lv-stellar-times', type: 'perfume', image: 'assets/products/lv-stellar-times.jpg',
    name: 'Stellar Times', brand: 'Louis Vuitton',
    gender: 'unisex', family: 'amber', concentration: 'EDP', year: 2021,
    perfumer: 'Жак Кавалье-Беллетрюд', country: 'Франция',
    isNew: true, featured: true,
    volumes: [{ ml: 100, price: 229000, stock: 2 }],
    main: 100,
    short: 'Амбра, бензоин и тубероза. Флакон с цветком Фрэнка Гери.',
    description: 'Тёплая амбра и бензоин с туберозой и розой. Флакон с металлическим цветком, созданным архитектором Фрэнком Гери.',
    notes: { top: ['роза'], heart: ['тубероза'], base: ['амбра', 'бензоин'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'flask', cap: 'orb', liquid: '#f2b7a0', capColor: 'silver', label: 'LOUIS VUITTON' }
  },
  {
    id: 'lv-symphony', type: 'perfume', image: 'assets/products/lv-symphony.jpg',
    name: 'Symphony', brand: 'Louis Vuitton',
    gender: 'unisex', family: 'fresh', concentration: 'EDP', year: 2021,
    perfumer: 'Жак Кавалье-Беллетрюд', country: 'Франция',
    isNew: true,
    volumes: [{ ml: 100, price: 189000, stock: 3 }],
    main: 100,
    short: 'Грейпфрут, имбирь и амбра. Флакон Фрэнка Гери.',
    description: 'Яркий цитрусовый аромат: грейпфрут и бергамот, острый имбирь и мягкая амбра. Флакон с металлическим цветком Фрэнка Гери.',
    notes: { top: ['грейпфрут', 'бергамот'], heart: ['имбирь'], base: ['амбра'] },
    longevity: 3, sillage: 3,
    bottle: { shape: 'flask', cap: 'orb', liquid: '#cdb2e3', capColor: 'silver', label: 'LOUIS VUITTON' }
  },
  {
    id: 'set-five-senses', type: 'set',
    name: 'Сет «Пять чувств»', brand: '5th SENSE',
    gender: 'unisex', family: 'amber', concentration: 'Set',
    niche: true, bestseller: true,
    volumes: [{ ml: 50, price: 89000, stock: 8, label: '5 × 10 мл' }],
    main: 50,
    short: 'Пять бестселлеров бутика по 10 мл в фирменной коробке.',
    description: 'Наш сет для знакомства с бутиком: Baccarat Rouge 540, Oud Wood, Santal 33, Layton и Green Irish Tweed в отливантах по 10 мл. Коробка с карточкой, где описан каждый аромат.',
    notes: { top: ['шафран', 'кардамон', 'вербена'], heart: ['уд', 'герань', 'папирус'], base: ['амбра', 'сандал', 'ваниль'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'set', count: 5, liquid: '#b0703c', capColor: 'gold', label: '5th SENSE' }
  }
];

FS.products = FS.defaultProducts;
