/* 5th SENSE — информационные страницы. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.delivery = {
  title: () => 'Доставка и оплата',
  render() {
    const { esc, money } = FS.ui;
    return `
      <section class="page-head">
        <nav class="crumbs" aria-label="Навигационная цепочка"><a href="#home">Главная</a><span aria-hidden="true">/</span><span aria-current="page">Доставка и оплата</span></nav>
        <h1>Доставка и оплата</h1>
        <p class="page-lead">Как получить заказ, как его оплатить и что делать, если что-то пошло не так.</p>
      </section>
      <div class="page-body info">
        <section>
          <h2>Доставка</h2>
          <dl class="info-list">
            ${FS.delivery.map((d) => `<div><dt>${esc(d.name)}</dt><dd>${esc(d.note)}</dd></div>`).join('')}
          </dl>
          <p>Курьерская доставка по городу бесплатна для заказов от ${money(FS.config.freeShippingFrom)}.</p>
        </section>
        <section>
          <h2>Оплата</h2>
          <p>Сейчас заказ оплачивается при получении: картой или наличными курьеру либо в бутике. Онлайн-оплата картой появится позже.</p>
        </section>
        <section>
          <h2>Возврат и обмен</h2>
          <p>Парфюмерия надлежащего качества обмену и возврату не подлежит. Если флакон пришёл повреждённым или не тот, сообщите нам в течение 24 часов после получения, и мы заменим его.</p>
        </section>
        <section>
          <h2>Подлинность</h2>
          <p>В бутике продаётся только оригинальная продукция. По запросу покажем документы на любой аромат.</p>
        </section>
        <section>
          <h2>Связаться с бутиком</h2>
          <p><span class="selectable">${esc(FS.config.contacts.phone)}</span><br><span class="selectable">${esc(FS.config.contacts.email)}</span><br>${esc(FS.config.contacts.hours)}</p>
        </section>
      </div>`;
  }
};

FS.views.notfound = {
  title: () => 'Страница не найдена',
  render() {
    return `
      <section class="page-head page-head--center">
        <h1>Такой страницы нет</h1>
        <p class="page-lead">Возможно, аромат сняли с витрины или ссылка устарела. Загляните в каталог: там все ароматы бутика.</p>
      </section>
      <div class="page-body"><div class="empty"><a class="line-link" href="#catalog">Перейти в каталог</a></div></div>`;
  }
};
