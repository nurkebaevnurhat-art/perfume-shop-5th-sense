/* 5th SENSE — маршрутизация и переходы между страницами.
   Маршруты — простые якоря (#catalog-men, #product-aventus), поэтому сайт
   работает на любом статическом хостинге без настройки сервера. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.app = (function () {
  const { $ } = FS.ui;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pending = {};
  let current = null;
  let busy = null;
  let mountCtl = null; // слушатели текущей страницы снимаются при переходе

  function resolve(token) {
    const t = (token || '').replace(/^#/, '') || 'home';
    let m;
    if (t === 'home') return { name: 'home', key: 'home' };
    if (t === 'aromaty' || t === 'vitriny' || t === 'boutique') return { name: 'home', key: 'home', anchor: t };
    if (t === 'catalog') return { name: 'catalog', key: t };
    if ((m = t.match(/^catalog-([a-z]+)$/)) && FS.categories.some((c) => c.id === m[1])) return { name: 'catalog', key: t, category: m[1] };
    if ((m = t.match(/^family-([a-z]+)$/)) && FS.families.some((f) => f.id === m[1])) return { name: 'catalog', key: t, family: m[1] };
    if ((m = t.match(/^product-([a-z0-9-]+)$/))) return { name: 'product', key: t, id: m[1] };
    if (t === 'checkout') return { name: 'checkout', key: t };
    if (t === 'favorites') return { name: 'favorites', key: t };
    if (t === 'delivery') return { name: 'delivery', key: t };
    if (t === 'offer' || t === 'privacy' || t === 'returns') return { name: t, key: t };
    if (t === 'admin') return { name: 'admin', key: t, tab: 'overview' };
    if ((m = t.match(/^admin-(orders|products|data)$/))) return { name: 'admin', key: t, tab: m[1] };
    if (t === 'admin-new') return { name: 'admin', key: t, tab: 'edit', id: null };
    if ((m = t.match(/^admin-edit-([a-z0-9-]+)$/))) return { name: 'admin', key: t, tab: 'edit', id: m[1] };
    return { name: 'notfound', key: t };
  }

  function currentToken() {
    try { return window.location.hash.replace(/^#/, ''); } catch (e) { return ''; }
  }

  /* Переход из кода: go('catalog', { q: 'роза' }).
     Рендерим сразу, а хэш обновляем для истории браузера и ссылок —
     так навигация работает и там, где менять адрес нельзя (встроенный фрейм). */
  let echo = null;
  function go(token, params) {
    pending = params || {};
    const route = resolve(token);
    try {
      if (currentToken() !== token) { echo = token; window.location.hash = token; }
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

  function render(route, force) {
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
    const animate = !first && !reduceMotion.matches;
    if (busy) clearTimeout(busy);
    if (current && current.impl.unmount) current.impl.unmount();

    const swap = () => {
      FS.motion.clearScenes();
      document.body.className = document.body.className.replace(/\broute-\S+/g, '').trim();
      document.body.classList.add('route-' + route.name);
      FS.ui.setStructuredData(null);
      view.innerHTML = impl.render(route, params);
      document.title = (impl.title ? impl.title(route) + ' | ' : '') + '5th SENSE';
      if (mountCtl) mountCtl.abort();
      mountCtl = new AbortController();
      if (impl.mount) impl.mount(view, route, params, mountCtl.signal);
      FS.ui.setActiveNav(route.key);
      FS.motion.fit(view);
      if (!(route.anchor && scrollToAnchor(route.anchor, false))) window.scrollTo(0, 0);
      FS.motion.reveals(view);
      FS.ui.refreshHeader();
      if (!first) {
        const h1 = view.querySelector('h1');
        if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      }
    };

    current = { key: route.key, impl };
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

  function start() {
    FS.motion.init();
    FS.ui.renderHeader();
    FS.ui.renderFooter();
    FS.ui.bind();
    window.addEventListener('hashchange', () => {
      const token = currentToken();
      if (echo !== null && token === echo) { echo = null; return; } // переход уже отрисован
      echo = null;
      render(resolve(token));
    });
    // Все внутренние ссылки идут через маршрутизатор.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      // Ссылки, открывающиеся в новой вкладке (оферта из формы заказа), браузер обрабатывает сам.
      if (a.target === '_blank') return;
      const token = a.getAttribute('href').slice(1);
      if (!token) return;
      // Обычные якоря внутри страницы (например, «Перейти к содержимому») не трогаем.
      if (resolve(token).name === 'notfound' && document.getElementById(token)) return;
      e.preventDefault();
      go(token);
    });
    render(resolve(currentToken()));
    FS.motion.intro(() => { document.body.classList.add('is-ready'); FS.motion.refresh(); });
  }

  return { start, go, resolve };
})();

document.addEventListener('DOMContentLoaded', FS.app.start);
