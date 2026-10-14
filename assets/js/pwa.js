/* 5th SENSE — приложение на телефоне (PWA).
   Регистрирует сервис-воркер (офлайн-кэш) и предлагает установить сайт
   на главный экран: на Android — системным окном, на iPhone — подсказкой,
   потому что Safari не умеет показывать окно установки сам. */
window.FS = window.FS || {};

FS.pwa = (function () {
  const DISMISSED = 'fs.install.dismissed';
  let deferred = null;

  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const touch = () => window.matchMedia('(pointer: coarse)').matches;
  // Сервис-воркер работает только на https и на localhost, и только в полной версии сайта.
  const supported = () => 'serviceWorker' in navigator && !!document.querySelector('link[rel="manifest"]') &&
    (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));

  // Кнопку показываем всегда, пока сайт не установлен: если браузер не дал окно
  // установки (уже отказывались, другой браузер), подскажем, где установить в меню.
  function canInstall() {
    if (standalone() || FS.tg.inside) return false;
    return Boolean(deferred) || supported();
  }
  const isKassa = () => /\/kassa\/?$/.test(location.pathname);

  function refresh() {
    document.body.classList.toggle('is-standalone', standalone());
    document.body.classList.toggle('can-install', canInstall());
  }

  async function install() {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
      deferred = null;
      if (outcome !== 'accepted') FS.storage.set(DISMISSED, Date.now());
      refresh();
      return;
    }
    howTo();
  }

  // Окно с шагами установки под этот телефон (когда браузер не показал своё окно).
  function howTo() {
    const what = isKassa() ? 'кассу' : 'приложение 5th SENSE';
    const inApp = /Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(navigator.userAgent);
    const steps = inApp
      ? ['Нажмите ⋮ или «…» в углу экрана.', 'Выберите «Открыть в браузере» (Chrome или Safari).', 'Затем снова нажмите «Установить».']
      : ios()
        ? ['Внизу экрана нажмите «Поделиться» — квадрат со стрелкой вверх.', 'Прокрутите список и выберите «На экран „Домой“».', 'Нажмите «Добавить».']
        : ['Нажмите ⋮ в правом верхнем углу Chrome.', 'Выберите «Установить приложение» или «Добавить на главный экран».', 'Нажмите «Установить».'];
    const layer = document.createElement('div');
    layer.className = 'ks-qr-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', `Как установить ${what}`);
    layer.innerHTML = `<div class="ks-qr-card pwa-howto"><p class="ks-pin-kicker">Установка</p>
      <h2 class="pwa-howto-title">Как установить ${what}</h2>
      <ol class="pwa-steps">${steps.map((t) => `<li>${t}</li>`).join('')}</ol>
      <p class="ks-qr-text">${ios() ? 'На iPhone это делается только так — Apple не даёт сайтам своей кнопки установки.' : 'Если пункта «Установить» нет, а на телефоне уже стоит приложение 5th SENSE, откройте этот адрес в Chrome — касса ставится отдельным приложением.'}</p>
      <button class="btn btn--outline btn--sm" type="button" data-howto-close>Понятно</button></div>`;
    document.body.appendChild(layer);
    const close = () => { layer.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    layer.addEventListener('click', (e) => { if (e.target === layer || e.target.closest('[data-howto-close]')) close(); });
    layer.querySelector('[data-howto-close]').focus();
  }


  // Переход на кассу внутри сайта: меняем манифест, чтобы установилась именно «Касса».
  function syncManifest() {
    const link = document.querySelector('link[rel="manifest"]');
    const card = /^#card-([\w-]{12,32})$/.exec(location.hash);
    if (link) link.setAttribute('href', card ? `api/card?manifest=1&t=${card[1]}` : isKassa() ? 'kassa.webmanifest' : 'manifest.webmanifest');
  }

  // Ненавязчивое предложение один раз: на телефоне, через полминуты на сайте.
  function suggest() {
    if (!touch() || !deferred || standalone() || FS.storage.get(DISMISSED, 0) || FS.tg.inside || isKassa()) return;
    FS.storage.set(DISMISSED, Date.now());
    FS.ui.toast('Установите 5th SENSE на телефон', { label: 'Установить', run: install }, { duration: 8000 });
  }

  function init() {
    if (supported()) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайн-кэша сайт работает как обычно */ });
      });
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      refresh();
    });
    window.addEventListener('appinstalled', () => {
      deferred = null;
      refresh();
      FS.ui.toast('Приложение 5th SENSE установлено');
    });
    window.addEventListener('hashchange', syncManifest);
    syncManifest();
    refresh();
    setTimeout(suggest, 30000);
  }

  return { init, install, canInstall, standalone };
})();
