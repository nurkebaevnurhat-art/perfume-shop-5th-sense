/* 5th SENSE — личная карта клиента (#card-<токен>). Ссылку клиент получает
   с кассы: QR-код, WhatsApp или SMS. Показывает только счёт покупок и сколько
   осталось до подарка — без сумм и названий подарков. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.card = (function () {
  let root = null;
  const esc = (s) => FS.ui.esc(s);
  const plural = (n, a, b, c) => FS.ui.plural(n, a, b, c);

  function progress(d) {
    // Круг из N покупок: N-я — с подарком. После подарочной начинается новый круг.
    const inRound = d.count % d.every;
    const marks = Array.from({ length: d.every }, (_, i) => {
      const gift = i === d.every - 1;
      const on = i < inRound;
      const next = !on && i === inRound;
      return `<li class="cd-step ${on ? 'is-on' : ''} ${gift ? 'is-gift' : ''} ${next ? 'is-next' : ''}"><span>${gift ? '🎁' : i + 1}</span></li>`;
    }).join('');
    return `<ol class="cd-steps" aria-label="Покупок в этом круге: ${inRound} из ${d.every}">${marks}</ol>`;
  }

  function headline(d) {
    if (!d.count) return 'Ваша первая покупка впереди';
    if (d.lastWasGift) return 'Последняя покупка была с подарком. Начинаем новый круг!';
    if (d.nextIsGift) return 'Следующая покупка — с подарком!';
    return `Подарок — на ${d.count + d.left + 1}-й покупке`;
  }

  function view(d) {
    return `
      <div class="cd-card">
        <img class="cd-logo" src="${FS.assetUrl('assets/img/logo-intro.png')}" alt="5th SENSE" width="520" height="962" decoding="async">
        <p class="ks-pin-kicker">Карта клиента</p>
        <h1 class="cd-name">${esc(d.name || 'Гость 5th SENSE')}</h1>
        <p class="cd-phone">${esc(d.phone)}</p>
        ${progress(d)}
        <p class="cd-head ${d.nextIsGift ? 'is-gift' : ''}">${esc(headline(d))}</p>
        <p class="cd-count">Всего покупок: <b>${d.count}</b>${!d.nextIsGift && d.count ? ` · до подарка ${d.left + 1} ${plural(d.left + 1, 'покупка', 'покупки', 'покупок')}` : ''}</p>
        <p class="cd-rule">Каждая ${d.every}-я покупка — с подарком от бутика. Покупки считаются по номеру телефона: на сайте и в бутике.</p>
        ${d.recent.length ? `<div class="cd-recent"><p class="cd-recent-title">Последние покупки</p><ul>${d.recent.map((p) => `<li><span>${new Date(p.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>${p.note ? `<em>${esc(p.note)}</em>` : ''}</li>`).join('')}</ul></div>` : ''}
        <div class="cd-actions">
          <a class="btn btn--primary btn--sm cd-shop" href="#catalog">Каталог ароматов</a>
          <button class="install-btn cd-install" type="button" data-action="install">Сохранить карту на телефон</button>
        </div>
        <p class="cd-note">Сохраните эту ссылку — карта всегда показывает актуальный счёт.</p>
      </div>`;
  }

  async function load(token) {
    const box = root && root.querySelector('[data-card]');
    if (!box) return;
    try {
      await FS.backend.status();
      if (!FS.backend.usable) throw new Error('Карта открывается на сайте бутика.');
      const d = await FS.backend.call('GET', `/api/card?t=${encodeURIComponent(token)}`);
      box.innerHTML = view(d);
    } catch (err) {
      box.innerHTML = `<div class="cd-card"><p class="ks-pin-kicker">Карта клиента</p><p class="cd-head">${esc(err.message)}</p><a class="btn btn--primary btn--sm cd-shop" href="#home">На главную</a></div>`;
    }
  }

  return {
    title: () => 'Карта клиента',
    render() {
      return '<div class="ks-stage is-pin cd-stage" data-head="dark"><div class="kassa" data-card><div class="cd-card"><p class="ks-pin-kicker">Карта клиента</p><p class="cd-head">Загружаем…</p></div></div></div>';
    },
    mount(el, route) {
      root = el;
      load(route.token);
    },
    unmount() { root = null; }
  };
})();
