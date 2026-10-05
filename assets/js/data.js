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
  Extrait: 'Extrait de Parfum',
  Set: 'Набор'
};

FS.products = [
  {
    id: 'baccarat-rouge-540', type: 'perfume',
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
    id: 'aventus', type: 'perfume',
    name: 'Aventus', brand: 'Creed',
    gender: 'men', family: 'chypre', concentration: 'EDP', year: 2010,
    perfumer: 'Оливье Крид', country: 'Франция',
    niche: true, bestseller: true, featured: true,
    volumes: [{ ml: 50, price: 159000, stock: 5 }, { ml: 100, price: 229000, stock: 3 }],
    main: 100,
    short: 'Ананас, берёза и дубовый мох. Аромат уверенности.',
    description: 'Фруктовый шипр с дымной берёзой и сочным ананасом. Начинается ярко и свежо, затем уходит в мускус, дубовый мох и амбру. Классика современной мужской парфюмерии.',
    notes: { top: ['ананас', 'бергамот', 'чёрная смородина', 'яблоко'], heart: ['берёза', 'пачули', 'жасмин', 'роза'], base: ['мускус', 'дубовый мох', 'амбра', 'ваниль'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'tower', cap: 'tall', liquid: '#2a3b2e', capColor: 'silver', label: 'CREED' }
  },
  {
    id: 'oud-wood', type: 'perfume',
    name: 'Oud Wood', brand: 'Tom Ford',
    gender: 'unisex', family: 'woody', concentration: 'EDP', year: 2007,
    perfumer: 'Ришар Эрпен', country: 'США',
    niche: true, bestseller: true,
    volumes: [{ ml: 30, price: 109000, stock: 3 }, { ml: 50, price: 159000, stock: 5 }, { ml: 100, price: 239000, stock: 2 }],
    main: 50,
    short: 'Мягкий уд с кардамоном и сандалом, тёплый и сдержанный.',
    description: 'Редкое дерево уд, смягчённое розовым деревом, кардамоном и сандалом. Тонка и ваниль делают его тёплым и бархатистым. Тихий, но очень узнаваемый аромат.',
    notes: { top: ['розовое дерево', 'кардамон', 'китайский перец'], heart: ['уд', 'сандал', 'ветивер'], base: ['бобы тонка', 'ваниль', 'амбра'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'block', cap: 'cube', liquid: '#3b2414', capColor: 'black', label: 'TOM FORD' }
  },
  {
    id: 'lost-cherry', type: 'perfume',
    name: 'Lost Cherry', brand: 'Tom Ford',
    gender: 'women', family: 'gourmand', concentration: 'EDP', year: 2018,
    perfumer: 'Луиза Тёрнер', country: 'США',
    niche: true, bestseller: true,
    volumes: [{ ml: 50, price: 189000, stock: 2 }, { ml: 100, price: 279000, stock: 1 }],
    main: 50,
    short: 'Тёмная вишня, вишнёвый ликёр и горький миндаль.',
    description: 'Насыщенный гурманский аромат: чёрная вишня и вишнёвый ликёр на фоне турецкой розы и жасмина. В базе перуанский бальзам, тонка и сандал.',
    notes: { top: ['чёрная вишня', 'вишнёвый ликёр', 'горький миндаль'], heart: ['турецкая роза', 'жасмин самбак'], base: ['перуанский бальзам', 'тонка', 'сандал', 'ветивер'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'block', cap: 'cube', liquid: '#7a1424', capColor: 'gold', label: 'TOM FORD' }
  },
  {
    id: 'santal-33', type: 'perfume',
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
    id: 'gypsy-water', type: 'perfume',
    name: 'Gypsy Water', brand: 'Byredo',
    gender: 'unisex', family: 'woody', concentration: 'EDP', year: 2008,
    perfumer: 'Жером Эпинет', country: 'Швеция',
    niche: true,
    volumes: [{ ml: 50, price: 105000, stock: 5 }, { ml: 100, price: 149000, stock: 3 }],
    main: 100,
    short: 'Хвоя, ладан и ваниль. Аромат дороги и костра.',
    description: 'Свежие цитрусы и можжевельник переходят в хвою и ладан, а в базе мягко теплеет ваниль с сандалом. Лёгкий и спокойный аромат на каждый день.',
    notes: { top: ['бергамот', 'лимон', 'перец', 'можжевельник'], heart: ['ладан', 'хвоя', 'ирис'], base: ['амбра', 'ваниль', 'сандал'] },
    longevity: 3, sillage: 2,
    bottle: { shape: 'cylinder', cap: 'sphere', liquid: '#e6dcc6', capColor: 'black', label: 'BYREDO', labelStyle: 'paper' }
  },
  {
    id: 'interlude-man', type: 'perfume',
    name: 'Interlude Man', brand: 'Amouage',
    gender: 'men', family: 'amber', concentration: 'EDP', year: 2012,
    perfumer: 'Пьер Негрен', country: 'Оман',
    niche: true,
    volumes: [{ ml: 100, price: 189000, stock: 2 }],
    main: 100,
    short: 'Ладан, опопонакс и кожа. Плотный дымный восток.',
    description: 'Дымная смолистая композиция: ладан, опопонакс и ладанник поверх кожи, уда и пачули. Орегано и душистый перец в начале делают аромат неожиданно травянистым.',
    notes: { top: ['бергамот', 'орегано', 'душистый перец'], heart: ['ладан', 'опопонакс', 'ладанник'], base: ['кожа', 'уд', 'сандал', 'пачули'] },
    longevity: 5, sillage: 5,
    bottle: { shape: 'flask', cap: 'orb', liquid: '#1f3a4a', capColor: 'gold', label: 'AMOUAGE' }
  },
  {
    id: 'erba-pura', type: 'perfume',
    name: 'Erba Pura', brand: 'Xerjoff',
    gender: 'unisex', family: 'fruity', concentration: 'EDP', year: 2019,
    country: 'Италия',
    niche: true, isNew: true,
    volumes: [{ ml: 50, price: 109000, stock: 4 }, { ml: 100, price: 149000, stock: 3 }],
    main: 100,
    short: 'Сицилийские цитрусы, спелые фрукты и белый мускус.',
    description: 'Яркое сочное начало из апельсина, лимона и бергамота сменяется букетом средиземноморских фруктов. Белый мускус, ваниль и амбра дают длинный тёплый шлейф.',
    notes: { top: ['сицилийский апельсин', 'лимон', 'бергамот'], heart: ['фруктовый аккорд'], base: ['белый мускус', 'ваниль', 'амбра'] },
    longevity: 5, sillage: 5,
    bottle: { shape: 'facet', cap: 'cube', liquid: '#d9b24a', capColor: 'gold', label: 'XERJOFF' }
  },
  {
    id: 'layton', type: 'perfume',
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
    bottle: { shape: 'tower', cap: 'tall', liquid: '#2b2b3a', capColor: 'gold', label: 'MARLY' }
  },
  {
    id: 'delina', type: 'perfume',
    name: 'Delina', brand: 'Parfums de Marly',
    gender: 'women', family: 'floral', concentration: 'EDP', year: 2017,
    perfumer: 'Кантен Биш', country: 'Франция',
    niche: true, bestseller: true,
    volumes: [{ ml: 75, price: 115000, stock: 5 }],
    main: 75,
    short: 'Турецкая роза, личи и ревень. Розовый и сияющий.',
    description: 'Турецкая роза и пион в обрамлении сочного личи и ревеня. Мускус и кашмеран делают аромат мягким и воздушным.',
    notes: { top: ['личи', 'ревень', 'бергамот', 'мускатный орех'], heart: ['турецкая роза', 'пион', 'мускус', 'ваниль'], base: ['кашмеран', 'ладан', 'ветивер'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'tower', cap: 'tall', liquid: '#e7b7c0', capColor: 'gold', label: 'MARLY' }
  },
  {
    id: 'coco-mademoiselle', type: 'perfume',
    name: 'Coco Mademoiselle', brand: 'Chanel',
    gender: 'women', family: 'chypre', concentration: 'EDP', year: 2001,
    perfumer: 'Жак Польж', country: 'Франция',
    bestseller: true,
    volumes: [{ ml: 50, price: 79000, stock: 8 }, { ml: 100, price: 109000, stock: 6 }],
    main: 100,
    short: 'Апельсин, роза и пачули. Современный шипр.',
    description: 'Свежий апельсин и бергамот открывают чувственное сердце из розы и жасмина. Пачули и белый мускус делают аромат смелым и элегантным.',
    notes: { top: ['апельсин', 'мандарин', 'бергамот'], heart: ['роза', 'жасмин', 'мимоза'], base: ['пачули', 'белый мускус', 'ваниль', 'ветивер'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'block', cap: 'cube', liquid: '#e9c38f', capColor: 'clear', label: 'CHANEL', labelStyle: 'paper' }
  },
  {
    id: 'bleu-de-chanel', type: 'perfume',
    name: 'Bleu de Chanel', brand: 'Chanel',
    gender: 'men', family: 'woody', concentration: 'EDP', year: 2014,
    perfumer: 'Жак Польж', country: 'Франция',
    bestseller: true,
    volumes: [{ ml: 50, price: 69000, stock: 9 }, { ml: 100, price: 95000, stock: 7 }],
    main: 100,
    short: 'Грейпфрут, ладан и кедр. Свежесть с глубиной.',
    description: 'Цитрусовая свежесть с имбирём и мускатом переходит в сухую древесную базу из ладана, кедра и сандала. Универсальный аромат на каждый день.',
    notes: { top: ['грейпфрут', 'лимон', 'мята', 'розовый перец'], heart: ['имбирь', 'мускатный орех', 'жасмин'], base: ['ладан', 'ветивер', 'кедр', 'сандал'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'block', cap: 'disc', liquid: '#14213a', capColor: 'black', label: 'CHANEL' }
  },
  {
    id: 'sauvage-edp', type: 'perfume',
    name: 'Sauvage', brand: 'Dior',
    gender: 'men', family: 'fresh', concentration: 'EDP', year: 2018,
    perfumer: 'Франсуа Демаши', country: 'Франция',
    bestseller: true,
    volumes: [{ ml: 60, price: 59000, stock: 10 }, { ml: 100, price: 79000, stock: 8 }],
    main: 100,
    short: 'Бергамот, сычуаньский перец и амброксан.',
    description: 'Сочный калабрийский бергамот и пряный сычуаньский перец. Версия Eau de Parfum мягче и теплее за счёт ванили и лаванды.',
    notes: { top: ['бергамот'], heart: ['сычуаньский перец', 'лаванда', 'бадьян', 'мускатный орех'], base: ['амброксан', 'ваниль'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'flask', cap: 'disc', liquid: '#1c2c4a', capColor: 'silver', label: 'DIOR' }
  },
  {
    id: 'jadore', type: 'perfume',
    name: "J'adore", brand: 'Dior',
    gender: 'women', family: 'floral', concentration: 'EDP', year: 1999,
    perfumer: 'Калис Беккер', country: 'Франция',
    bestseller: true,
    volumes: [{ ml: 50, price: 69000, stock: 7 }, { ml: 100, price: 92000, stock: 5 }],
    main: 100,
    short: 'Иланг-иланг, жасмин и дамасская роза.',
    description: 'Солнечный цветочный букет: иланг-иланг, жасмин самбак и дамасская роза. Светлый, женственный, с лёгкой фруктовой сладостью.',
    notes: { top: ['груша', 'дыня', 'магнолия', 'бергамот'], heart: ['жасмин', 'тубероза', 'роза', 'орхидея'], base: ['мускус', 'ваниль', 'кедр'] },
    longevity: 4, sillage: 3,
    bottle: { shape: 'amphora', cap: 'orb', liquid: '#efcf7a', capColor: 'gold', label: 'DIOR' }
  },
  {
    id: 'libre', type: 'perfume',
    name: 'Libre', brand: 'Yves Saint Laurent',
    gender: 'women', family: 'amber', concentration: 'EDP', year: 2019,
    perfumer: 'Анн Флипо, Карлос Бенаим', country: 'Франция',
    isNew: true,
    volumes: [{ ml: 50, price: 64000, stock: 6 }, { ml: 90, price: 86000, stock: 4 }],
    main: 90,
    short: 'Лаванда и флёрдоранж на ванили Мадагаскара.',
    description: 'Контраст французской лаванды и марокканского флёрдоранжа. В базе ваниль Мадагаскара, мускус и кедр. Смелый и тёплый аромат.',
    notes: { top: ['лаванда', 'мандарин', 'чёрная смородина'], heart: ['флёрдоранж', 'жасмин', 'лаванда'], base: ['ваниль', 'мускус', 'кедр', 'амбра'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'block', cap: 'cube', liquid: '#e2c08a', capColor: 'gold', label: 'YSL' }
  },
  {
    id: 'shalimar', type: 'perfume',
    name: 'Shalimar', brand: 'Guerlain',
    gender: 'women', family: 'amber', concentration: 'EDP', year: 1925,
    perfumer: 'Жак Герлен', country: 'Франция',
    volumes: [{ ml: 50, price: 62000, stock: 3 }, { ml: 90, price: 84000, stock: 2 }],
    main: 90,
    short: 'Ваниль, ирис и ладан. Легендарный восток.',
    description: 'Один из первых восточных ароматов в истории. Бергамот, ирис и жасмин переходят в дымную ваниль, ладан и кожу.',
    notes: { top: ['бергамот', 'лимон', 'мандарин'], heart: ['ирис', 'жасмин', 'роза'], base: ['ваниль', 'тонка', 'ладан', 'кожа'] },
    longevity: 5, sillage: 4,
    bottle: { shape: 'amphora', cap: 'disc', liquid: '#c98a4a', capColor: 'clear', label: 'GUERLAIN' }
  },
  {
    id: 'angels-share', type: 'perfume',
    name: "Angels' Share", brand: 'Kilian Paris',
    gender: 'unisex', family: 'gourmand', concentration: 'EDP', year: 2020,
    perfumer: 'Бенуа Лапуза', country: 'Франция',
    niche: true, isNew: true, featured: true,
    volumes: [{ ml: 50, price: 129000, stock: 4 }],
    main: 50,
    short: 'Коньяк, корица и пралине в дубовой бочке.',
    description: 'Аромат назван в честь доли коньяка, которая испаряется из бочек при выдержке. Коньяк, корица и дуб, а затем пралине, ваниль и сандал.',
    notes: { top: ['коньяк'], heart: ['корица', 'тонка', 'дуб'], base: ['пралине', 'ваниль', 'сандал'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'flask', cap: 'cube', liquid: '#a35a1c', capColor: 'black', label: 'KILIAN' }
  },
  {
    id: 'side-effect', type: 'perfume',
    name: 'Side Effect', brand: 'Initio',
    gender: 'unisex', family: 'gourmand', concentration: 'EDP', year: 2016,
    country: 'Франция',
    niche: true, isNew: true,
    volumes: [{ ml: 90, price: 145000, stock: 2 }],
    main: 90,
    short: 'Ром, табак и корица. Тёмный и тёплый.',
    description: 'Опьяняющий аромат: ром и табак с корицей и ванилью. Плотный, сладковатый и очень стойкий.',
    notes: { top: ['ром'], heart: ['табак', 'корица'], base: ['ваниль'] },
    longevity: 5, sillage: 4,
    bottle: { shape: 'tower', cap: 'cube', liquid: '#2a1a10', capColor: 'black', label: 'INITIO' }
  },
  {
    id: 'hacivat', type: 'perfume',
    name: 'Hacivat', brand: 'Nishane',
    gender: 'unisex', family: 'chypre', concentration: 'Extrait', year: 2017,
    perfumer: 'Хорхе Ли', country: 'Турция',
    niche: true, isNew: true,
    volumes: [{ ml: 50, price: 99000, stock: 3 }, { ml: 100, price: 135000, stock: 2 }],
    main: 50,
    short: 'Ананас и грейпфрут на дубовом мхе.',
    description: 'Яркий фруктовый шипр: ананас, грейпфрут и бергамот на фоне кедра, пачули и дубового мха. Стойкость экстракта.',
    notes: { top: ['ананас', 'грейпфрут', 'бергамот'], heart: ['кедр', 'пачули', 'жасмин'], base: ['дубовый мох', 'древесные ноты'] },
    longevity: 5, sillage: 4,
    bottle: { shape: 'block', cap: 'disc', liquid: '#3f4a2c', capColor: 'gold', label: 'NISHANE' }
  },
  {
    id: 'portrait-of-a-lady', type: 'perfume',
    name: 'Portrait of a Lady', brand: 'Frederic Malle',
    gender: 'women', family: 'floral', concentration: 'EDP', year: 2010,
    perfumer: 'Доминик Ропьон', country: 'Франция',
    niche: true,
    volumes: [{ ml: 50, price: 175000, stock: 2 }, { ml: 100, price: 255000, stock: 1 }],
    main: 100,
    short: 'Турецкая роза, пачули и ладан.',
    description: 'Огромная доза турецкой розы с малиной и пряностями на фоне пачули, сандала и ладана. Глубокий и благородный аромат.',
    notes: { top: ['роза', 'малина', 'чёрная смородина', 'корица'], heart: ['пачули', 'сандал', 'ладан'], base: ['мускус', 'амбра', 'бензоин'] },
    longevity: 5, sillage: 5,
    bottle: { shape: 'cylinder', cap: 'disc', liquid: '#5a1622', capColor: 'black', label: 'F. MALLE', labelStyle: 'paper' }
  },
  {
    id: 'fleur-narcotique', type: 'perfume',
    name: 'Fleur Narcotique', brand: 'Ex Nihilo',
    gender: 'unisex', family: 'floral', concentration: 'EDP', year: 2014,
    perfumer: 'Кантен Биш', country: 'Франция',
    niche: true, isNew: true,
    volumes: [{ ml: 50, price: 99000, stock: 4 }, { ml: 100, price: 139000, stock: 2 }],
    main: 100,
    short: 'Пион, жасмин и личи. Светлый цветочный.',
    description: 'Пион и жасмин с сочным личи и персиком. Мох и мускус в базе делают цветочную композицию лёгкой и долгой.',
    notes: { top: ['бергамот', 'личи', 'персик'], heart: ['пион', 'жасмин', 'флёрдоранж'], base: ['мох', 'мускус', 'древесные ноты'] },
    longevity: 3, sillage: 3,
    bottle: { shape: 'cylinder', cap: 'disc', liquid: '#f0d6d0', capColor: 'gold', label: 'EX NIHILO' }
  },
  {
    id: 'acqua-di-gio-profondo', type: 'perfume',
    name: 'Acqua di Giò Profondo', brand: 'Giorgio Armani',
    gender: 'men', family: 'fresh', concentration: 'EDP', year: 2020,
    perfumer: 'Альберто Морильяс', country: 'Италия',
    isNew: true,
    volumes: [{ ml: 75, price: 54000, stock: 7 }, { ml: 125, price: 69000, stock: 5 }],
    main: 125,
    short: 'Морские ноты, бергамот и розмарин.',
    description: 'Глубокий морской аромат: морские ноты и бергамот с розмарином, лавандой и кипарисом. Минеральная база с мускусом и пачули.',
    notes: { top: ['морские ноты', 'бергамот', 'зелёный мандарин'], heart: ['розмарин', 'лаванда', 'кипарис'], base: ['минеральные ноты', 'мускус', 'пачули'] },
    longevity: 3, sillage: 3,
    bottle: { shape: 'flask', cap: 'disc', liquid: '#1a4f63', capColor: 'silver', label: 'ARMANI' }
  },
  {
    id: 'set-five-senses', type: 'set',
    name: 'Сет «Пять чувств»', brand: '5th SENSE',
    gender: 'unisex', family: 'amber', concentration: 'Set',
    niche: true, bestseller: true, featured: true,
    volumes: [{ ml: 50, price: 89000, stock: 8, label: '5 × 10 мл' }],
    main: 50,
    short: 'Пять бестселлеров бутика по 10 мл в фирменной коробке.',
    description: 'Наш сет для знакомства с бутиком: Baccarat Rouge 540, Oud Wood, Santal 33, Delina и Angels\' Share в отливантах по 10 мл. Деревянная коробка с латунной табличкой и карточка с описанием каждого аромата.',
    notes: { top: ['шафран', 'кардамон', 'личи'], heart: ['уд', 'роза', 'корица'], base: ['амбра', 'сандал', 'пралине'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'set', count: 5, liquid: '#b0703c', capColor: 'gold', label: '5th SENSE' }
  },
  {
    id: 'set-evening', type: 'set',
    name: 'Сет «Вечер»', brand: '5th SENSE',
    gender: 'unisex', family: 'gourmand', concentration: 'Set',
    isNew: true,
    volumes: [{ ml: 30, price: 55000, stock: 6, label: '3 × 10 мл' }],
    main: 30,
    short: 'Три тёплых вечерних аромата по 10 мл.',
    description: 'Lost Cherry, Side Effect и Interlude Man для вечера и холодного сезона. Отливанты по 10 мл в коробке с бархатным ложементом.',
    notes: { top: ['вишня', 'ром', 'орегано'], heart: ['роза', 'табак', 'ладан'], base: ['тонка', 'ваниль', 'кожа'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'set', count: 3, liquid: '#6e1a22', capColor: 'black', label: '5th SENSE' }
  },
  {
    id: 'set-sauvage', type: 'set',
    name: 'Sauvage, подарочный набор', brand: 'Dior',
    gender: 'men', family: 'fresh', concentration: 'Set',
    volumes: [{ ml: 110, price: 92000, stock: 3, label: '100 мл + 10 мл' }],
    main: 110,
    short: 'Eau de Parfum 100 мл и дорожный флакон 10 мл.',
    description: 'Подарочный набор Sauvage Eau de Parfum: основной флакон 100 мл и дорожная версия 10 мл в фирменной коробке.',
    notes: { top: ['бергамот'], heart: ['сычуаньский перец', 'лаванда'], base: ['амброксан', 'ваниль'] },
    longevity: 4, sillage: 4,
    bottle: { shape: 'set', count: 2, liquid: '#1c2c4a', capColor: 'silver', label: 'DIOR' }
  }
];
