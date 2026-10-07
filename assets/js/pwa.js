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

  function canInstall() {
    if (standalone()) return false;
    return Boolean(deferred) || (ios() && supported());
  }

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
    if (ios()) iosHint();
  }

  // Ненавязчивое предложение один раз: на телефоне, через полминуты на сайте.
  function suggest() {
    if (!touch() || !canInstall() || FS.storage.get(DISMISSED, 0) || FS.tg.inside) return;
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
    refresh();
    setTimeout(suggest, 30000);
  }

  return { init, install, canInstall, standalone };
})();
