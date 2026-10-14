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
  const isKassa = () => location.hash === '#kassa';

  function refresh() {
    document.body.classList.toggle('is-standalone', standalone());
    document.body.classList.toggle('can-install', canInstall());
  }

  function iosHint() {
    FS.ui.toast('Нажмите «Поделиться» внизу экрана и выберите «На экран „Домой“»', null, { duration: 9000 });
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
    if (ios()) { iosHint(); return; }
    FS.ui.toast(`Откройте меню браузера (⋮ справа вверху) и выберите «Установить приложение» или «Добавить на главный экран»${isKassa() ? ' — установится «Касса»' : ''}`, null, { duration: 10000 });
  }

  // Переход на кассу внутри сайта: меняем манифест, чтобы установилась именно «Касса».
  function syncManifest() {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute('href', isKassa() ? 'kassa.webmanifest' : 'manifest.webmanifest');
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
