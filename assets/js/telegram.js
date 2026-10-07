/* 5th SENSE — сайт внутри Telegram (мини-приложение).
   Кнопка «Магазин» в боте открывает сайт прямо в Telegram и передаёт в адресе
   данные пользователя (#tgWebAppData=…). Здесь мы их забираем, убираем из адреса
   (иначе маршрутизатор принял бы их за страницу) и сообщаем Telegram, что
   сайт готов. Сервер проверяет подпись этих данных при оформлении заказа. */
window.FS = window.FS || {};

FS.tg = (function () {
  const KEY = 'fs.tg.init';
  let initData = '';

  function fromHash() {
    const hash = window.location.hash.slice(1);
    if (!/(^|&)tgWebApp/.test(hash)) return false;
    const params = new URLSearchParams(hash);
    initData = params.get('tgWebAppData') || '';
    try { if (initData) sessionStorage.setItem(KEY, initData); } catch (e) { /* только память */ }
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { window.location.hash = ''; }
    return true;
  }

  const opened = fromHash();
  if (!initData) { try { initData = sessionStorage.getItem(KEY) || ''; } catch (e) { /* нет хранилища */ } }
  const inside = opened || Boolean(initData);

  let user = null;
  try { user = JSON.parse(new URLSearchParams(initData).get('user')); } catch (e) { user = null; }

  // Команды для приложения Telegram (то же делает официальный telegram-web-app.js).
  function post(type, data) {
    const body = JSON.stringify(data || {});
    try {
      if (window.TelegramWebviewProxy) window.TelegramWebviewProxy.postEvent(type, body);
      else if (window.external && 'notify' in window.external) window.external.notify(JSON.stringify({ eventType: type, eventData: data || {} }));
      else if (window.parent !== window) window.parent.postMessage(JSON.stringify({ eventType: type, eventData: data || {} }), '*');
    } catch (e) { /* не внутри Telegram */ }
  }

  if (inside) {
    document.documentElement.classList.add('in-telegram');
    post('web_app_ready');
    post('web_app_expand');
    post('web_app_set_header_color', { color: '#0e0c0a' });
    post('web_app_set_background_color', { color: '#f4efe6' });
  }

  return { inside, initData, user };
})();
