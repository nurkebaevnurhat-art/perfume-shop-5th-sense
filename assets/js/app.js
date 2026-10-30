/* 5th SENSE — маршрутизация и переходы между страницами.
   Маршруты — «токены» (catalog-men, product-aventus). Открытые страницы на сервере
   живут по обычным адресам (/catalog-men, /product-aventus — их видят поисковики,
   см. FS.seo и api/page.js), рабочие — на якорях (/#checkout, /#admin). Без сервера
   (файл с диска, однофайловая версия, касса /kassa/) всё работает на якорях, как раньше.
   Старые ссылки вида /#product-aventus (бот, закладки) по-прежнему открываются. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.app = (function () {
  const { $ } = FS.ui;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pending = {};
  let current = null;
  let busy = null;
  let mountCtl = null; // слушатели текущей страницы снимаются при переходе

  // Обычные адреса — только там, где сервер их отдаёт (Vercel, тестовый сервер).
  const pathMode = /^https?:$/.test(location.protocol) && !FS.assets && !/^\/kassa\//.test(location.pathname);
  const pathToken = () => { const p = decodeURIComponent(location.pathname.slice(1)); return FS.seo.isPublic(p) ? p : ''; };
  // Адрес ссылки на страницу: /product-x или #admin (/#admin на открытых страницах).
  function href(token) {
    if (!pathMode) return '#' + token;
    if (FS.seo.isPublic(token) || token === 'home') return FS.seo.path(token);
    return '/#' + token;
  }

  /* Рабочие разделы (админка, касса, карта клиента) покупателям не нужны: их код
     скачивается только при входе в раздел. Список читает и scripts/build-single.mjs. */
  const LAZY = {
    admin: ['assets/js/qr.js', 'assets/js/importer.js', 'assets/js/views/admin.js'],
    kassa: ['assets/js/qr.js', 'assets/js/views/kassa.js'],
    card: ['assets/js/views/card.js']
  };
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((res, rej) => {
        const el = document.createElement('script');
        el.src = FS.assetUrl(src);
        el.onload = res;
        el.onerror = () => { delete loaded[src]; rej(new Error(src)); };
        document.body.appendChild(el);
      });
    }
    return loaded[src];
  }
  function ensureView(name) {
    if (FS.views[name] || !LAZY[name]) return Promise.resolve();
    return LAZY[name].reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve());
  }
  function resolve(token) {
    const t = (token || '').replace(/^#/, '') || 'home';
    let m;
    if (t === 'home') return { name: 'home', key: 'home' };
    if (t === 'aromaty' || t === 'vitriny' || t === 'boutique') return { name: 'home', key: 'home', anchor: t };
    if (t === 'catalog') return { name: 'catalog', key: t };
    if ((m = t.match(/^catalog-([a-z]+)$/)) && FS.categories.some((c) => c.id === m[1])) return { name: 'catalog', key: t, category: m[1] };
    if ((m = t.match(/^family-([a-z]+)$/)) && FS.families.some((f) => f.id === m[1])) return { name: 'catalog', key: t, family: m[1] };
    if (t === 'brands') return { name: 'brands', key: t };
    if ((m = t.match(/^brand-([a-z0-9-]+)$/))) return { name: 'catalog', key: t, brandSlug: m[1] };
    if ((m = t.match(/^product-([a-z0-9-]+)$/))) return { name: 'product', key: t, id: m[1] };
    if (t === 'checkout') return { name: 'checkout', key: t };
    if (t === 'favorites') return { name: 'favorites', key: t };
    if (t === 'delivery') return { name: 'delivery', key: t };
    if (t === 'gifts') return { name: 'gifts', key: t };
    if (t === 'podbor') return { name: 'podbor', key: t };
    if (t === 'kassa') return { name: 'kassa', key: t };
    if ((m = t.match(/^card-([\w-]{12,32})$/))) return { name: 'card', key: t, token: m[1] };
    if (t === 'terms') return { name: 'offer', key: t }; // «Условия заказа» (старый адрес #offer тоже работает)
    if (t === 'offer' || t === 'privacy' || t === 'returns') return { name: t, key: t };
    if (t === 'admin') return { name: 'admin', key: t, tab: 'overview' };
    if ((m = t.match(/^admin-(orders|clients|products|data)$/))) return { name: 'admin', key: t, tab: m[1] };
    if (t === 'admin-new') return { name: 'admin', key: t, tab: 'edit', id: null };
    if ((m = t.match(/^admin-edit-([a-z0-9-]+)$/))) return { name: 'admin', key: t, tab: 'edit', id: m[1] };
    return { name: 'notfound', key: t };
  }

  function currentToken() {
    try { return (pathMode && pathToken()) || window.location.hash.replace(/^#/, ''); } catch (e) { return ''; }
  }

  /* Переход из кода: go('catalog', { q: 'роза' }).
     Рендерим сразу, а хэш обновляем для истории браузера и ссылок —
     так навигация работает и там, где менять адрес нельзя (встроенный фрейм). */
  let echo = null;
  function go(token, params) {
    pending = params || {};
    const route = resolve(token);
    try {
      if (pathMode) {
        const url = href(token);
        if (location.pathname + location.hash !== url) history.pushState(null, '', url);
      } else if (currentToken() !== token) { echo = token; window.location.hash = token; }
    } catch (e) { echo = null; }
    render(route, !route.anchor);
  }

  function scrollToAnchor(anchor, smooth) {
    const el = document.getElementById(anchor);
    if (!el) return false;
    const top = el.getBoundingClientRect().top + window.scrollY - (document.querySelector('.site-header').offsetHeight - 1);
    window.scrollTo({ top, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
    return true;
  }

  // quiet — тихая перерисовка той же страницы (обновился каталог): без шторки и прокрутки.
  function render(route, force, quiet) {
    if (!FS.views[route.name] && LAZY[route.name]) {
      // Раздел ещё не загружен: догружаем и рисуем, если за это время не ушли на другую страницу.
      const want = route.key;
      // Пока код раздела загружается (на медленном интернете — до пары секунд), сразу показываем,
      // что вход начался, а не оставляем прежнюю страницу без ответа.
      const view = $('#view');
      if (!view.querySelector('.view-loading')) {
        view.innerHTML = '<div class="view-loading" role="status"><span class="view-loading-mark" aria-hidden="true"></span><span>Открываем…</span></div>';
        window.scrollTo(0, 0);
      }
      ensureView(route.name).then(
        () => { if (resolve(currentToken()).key === want) render(route, force, quiet); },
        () => { FS.ui.toast('Не удалось загрузить раздел. Проверьте интернет и обновите страницу.', null, { duration: 8000 }); }
      );
      return;
    }
    const view = $('#view');
    const params = pending;
    pending = {};

    // Якорь на уже открытой главной — просто плавно прокручиваем.
    if (current && current.key === route.key && route.anchor && !force) {
      scrollToAnchor(route.anchor, true);
      return;
    }

    const impl = FS.views[route.name] || FS.views.notfound;
    const first = !current;
    // Рабочие экраны (админка, касса, карта клиента) открываются сразу, без шторки.
    const animate = !first && !quiet && !reduceMotion.matches && !LAZY[route.name];
    if (busy) clearTimeout(busy);
    if (current && current.impl.unmount) current.impl.unmount();

    const swap = () => {
      const y = window.scrollY;
      FS.motion.clearScenes();
      document.body.className = document.body.className.replace(/\broute-\S+/g, '').trim();
      document.body.classList.add('route-' + route.name);
      FS.ui.setStructuredData(null);
      view.innerHTML = impl.render(route, params);
      head(route, impl);
      if (mountCtl) mountCtl.abort();
      mountCtl = new AbortController();
      if (impl.mount) impl.mount(view, route, params, mountCtl.signal);
      FS.ui.setActiveNav(route.key);
      FS.motion.fit(view);
      if (quiet) window.scrollTo(0, y);
      else if (!(route.anchor && scrollToAnchor(route.anchor, false))) window.scrollTo(0, 0);
      FS.motion.reveals(view);
      FS.ui.refreshHeader();
      if (!first && !quiet) {
        const h1 = view.querySelector('h1');
        if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      }
    };

    current = { key: route.key, impl, name: route.name };
    // Переход: шторка с логотипом закрывает экран, страница меняется, шторка уходит вверх.
    const curtain = $('#curtain');
    if (animate && curtain) {
      curtain.classList.remove('is-out');
      curtain.classList.add('is-in');
      busy = setTimeout(() => {
        swap();
        // Короткая пауза, чтобы логотип на шторке успели увидеть.
        busy = setTimeout(() => {
          curtain.classList.add('is-out');
          busy = setTimeout(() => curtain.classList.remove('is-in', 'is-out'), 800);
        }, 220);
      }, 560);
    } else {
      swap();
    }
  }

  /* Заголовок вкладки, описание и превью ссылки — как у сервера (FS.seo.meta).
     Поисковики, которые выполняют скрипты, видят то же самое и на переходах внутри сайта. */
  function head(route, impl) {
    const token = route.name === 'home' ? 'home' : route.key;
    const pub = token === 'home' || FS.seo.isPublic(token);
    const origin = (FS.config.site && FS.config.site.url ? FS.config.site.url.replace(/\/+$/, '') : location.origin);
    const m = pub ? FS.seo.meta(token, FS.products, origin) : null;
    document.title = m ? m.title : (impl.title ? impl.title(route) + ' | ' : '') + '5th SENSE';
    if (!m) return;
    const set = (sel, attr, key, value) => {
      let el = document.head.querySelector(sel);
      if (!el) { el = document.createElement(sel.startsWith('link') ? 'link' : 'meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute(sel.startsWith('link') ? 'href' : 'content', value);
    };
    set('meta[name="description"]', 'name', 'description', m.description);
    set('meta[property="og:title"]', 'property', 'og:title', m.title);
    set('meta[property="og:description"]', 'property', 'og:description', m.description);
    set('meta[property="og:image"]', 'property', 'og:image', m.image);
    set('meta[property="og:url"]', 'property', 'og:url', m.url);
    if (pathMode) set('link[rel="canonical"]', 'rel', 'canonical', m.url);
  }

  // Ссылки вида href="#catalog" в разметке страниц превращаем в настоящие адреса (/catalog).
  function fixLinks(root) {
    if (!pathMode || !root.querySelectorAll) return;
    const list = root.matches && root.matches('a[href^="#"]') ? [root] : [];
    list.concat([...root.querySelectorAll('a[href^="#"]')]).forEach((a) => {
      const token = a.getAttribute('href').slice(1);
      if (token && resolve(token).name !== 'notfound') a.setAttribute('href', href(token));
    });
  }

  // Переход по адресу (кнопки «назад/вперёд», ссылка с якорем): рисуем, если страница сменилась.
  function onUrl() {
    const token = currentToken();
    if (echo !== null && token === echo) { echo = null; return; } // переход уже отрисован
    echo = null;
    const route = resolve(token);
    if (current && current.key === route.key && !route.anchor) return;
    render(route);
  }

  function start() {
    if (pathMode) {
      // Старая ссылка /#product-x (бот, закладка) → /product-x.
      const legacy = location.hash.slice(1);
      if (location.pathname === '/' && FS.seo.isPublic(legacy)) history.replaceState(null, '', FS.seo.path(legacy) + location.search);
      fixLinks(document.body);
      new MutationObserver((list) => list.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1) fixLinks(n); })))
        .observe(document.body, { childList: true, subtree: true });
      window.addEventListener('popstate', onUrl);
    }
    FS.backend.status(); // заранее узнаём, подключён ли сервер заказов
    FS.pwa.init();
    FS.motion.init();
    FS.ui.renderHeader();
    FS.ui.renderFooter();
    FS.ui.bind();
    window.addEventListener('hashchange', onUrl);
    // Палец коснулся ссылки на админку или карту клиента — начинаем грузить её код, не дожидаясь отпускания.
    document.addEventListener('pointerdown', (e) => {
      const a = e.target.closest('a[href*="#admin"], a[href*="#card-"]');
      if (a) ensureView(/#admin/.test(a.getAttribute('href')) ? 'admin' : 'card').catch(() => {});
    }, { passive: true });
    // Все внутренние ссылки идут через маршрутизатор.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"], a[href^="/"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      // Ссылки, открывающиеся в новой вкладке (оферта из формы заказа), браузер обрабатывает сам.
      if (a.target === '_blank') return;
      const raw = a.getAttribute('href');
      let token;
      if (raw.startsWith('#')) token = raw.slice(1);
      else {
        // /product-x, /#admin, / — свои страницы; /kassa/, /api/… и файлы открывает браузер.
        if (raw.startsWith('//')) return;
        const u = new URL(a.href);
        const p = decodeURIComponent(u.pathname.slice(1));
        if (u.origin !== location.origin || (p && !FS.seo.isPublic(p))) return;
        token = p || u.hash.slice(1) || 'home';
      }
      if (!token) return;
      // Обычные якоря внутри страницы (например, «Перейти к содержимому») не трогаем.
      if (resolve(token).name === 'notfound' && document.getElementById(token)) return;
      e.preventDefault();
      go(token);
    });
    // Каталог с сервера. При первом визите ждём его (не дольше 2,5 с), чтобы не показать
    // устаревший список; дальше сайт открывается сразу из копии в браузере и обновляется в фоне.
    const sync = FS.catalog.sync().then((changed) => {
      if (changed) FS.api.refreshProducts();
      return changed;
    });
    // Новый каталог: перерисовываем страницы со списками товаров, формы не трогаем.
    FS.api.onChange(() => {
      if (current && ['home', 'catalog', 'brands', 'product', 'favorites'].includes(current.name)) render(resolve(currentToken()), true, true);
    });
    const first = () => { if (!current) render(resolve(currentToken())); };
    if (FS.catalog.hasCache() || !FS.backend.usable) first();
    else Promise.race([sync, new Promise((r) => setTimeout(r, 2500))]).then(first);
    FS.motion.intro(() => { document.body.classList.add('is-ready'); FS.motion.refresh(); });
  }

  return { start, go, resolve, href, ensureView };
})();

document.addEventListener('DOMContentLoaded', FS.app.start);
