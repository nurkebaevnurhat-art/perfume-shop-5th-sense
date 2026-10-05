/* 5th SENSE — оформление заказа. */
window.FS = window.FS || {};
FS.views = FS.views || {};

FS.views.checkout = (function () {
  const { $, $$, esc, money, volumeLabel } = FS.ui;
  const DRAFT_KEY = 'fs.checkout.draft.v1';
  let root = null;
  let unsubscribe = null;
  let placed = null;

  const FIELDS = [
    { id: 'firstName', label: 'Имя', autocomplete: 'given-name', required: true },
    { id: 'lastName', label: 'Фамилия', autocomplete: 'family-name', required: true },
    { id: 'phone', label: 'Телефон', type: 'tel', autocomplete: 'tel', required: true, placeholder: '+7 ___ ___ __ __' },
    { id: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true },
    { id: 'city', label: 'Город', autocomplete: 'address-level2', required: true },
    { id: 'address', label: 'Адрес', autocomplete: 'street-address', required: true, placeholder: 'Улица, дом, квартира', wide: true }
  ];

  function draft() { return FS.storage.get(DRAFT_KEY, {}); }

  function field(f, values) {
    return `<div class="field ${f.wide ? 'field--wide' : ''}" data-field="${f.id}">
      <label for="co-${f.id}">${f.label}${f.required ? '' : ' <span class="optional">необязательно</span>'}</label>
      <input id="co-${f.id}" name="${f.id}" type="${f.type || 'text'}" autocomplete="${f.autocomplete}" ${f.placeholder ? `placeholder="${f.placeholder}"` : ''} value="${esc(values[f.id] || '')}" aria-describedby="co-${f.id}-error">
      <p class="field-error" id="co-${f.id}-error" aria-live="polite"></p>
    </div>`;
  }

  function summary(values) {
    const lines = FS.store.lines();
    const subtotal = FS.store.subtotal();
    const method = values.delivery || FS.delivery[0].id;
    const ship = FS.shipping.quote(method, subtotal);
    const total = subtotal + (ship || 0);
    return `
      <h2>Ваш заказ</h2>
      <ul class="summary-lines">
        ${lines.map((l) => `
          <li>
            <span class="summary-thumb">${FS.bottle.media(l.product)}</span>
            <span class="summary-name"><span>${esc(l.product.brand)}</span>${esc(l.product.name)}<em>${esc(volumeLabel(l.volume))} × ${l.qty}</em></span>
            <span class="summary-price">${money(l.total)}</span>
          </li>`).join('')}
      </ul>
      <button class="link-btn" type="button" data-action="cart">Изменить корзину</button>
      <dl class="summary-sum">
        <div><dt>Товары</dt><dd>${money(subtotal)}</dd></div>
        <div><dt>Доставка</dt><dd>${ship === null ? 'рассчитает менеджер' : ship === 0 ? 'бесплатно' : money(ship)}</dd></div>
        <div class="summary-total"><dt>Итого</dt><dd>${money(total)}${ship === null ? '<small>без учёта доставки</small>' : ''}</dd></div>
      </dl>`;
  }

  function emptyState() {
    return `<section class="page-head">
        <h1>Оформление заказа</h1>
        <p class="page-lead">В корзине нет товаров. Добавьте аромат, чтобы оформить заказ.</p>
      </section>
      <div class="page-body"><div class="empty">
        <p class="empty-title">Корзина пуста</p>
        <p>Загляните на витрины бутика: бестселлеры, новинки и подарочные наборы.</p>
        <a class="btn btn--primary" href="#catalog">Перейти в каталог</a>
      </div></div>`;
  }

  function successState(order) {
    return `<section class="page-head page-head--center page-head--success">
        <p class="kicker">Заказ ${esc(order.number)}</p>
        <h1>Заказ принят</h1>
        <p class="page-lead">Спасибо, ${esc(order.customer.firstName)}. Мы позвоним по номеру ${esc(order.customer.phone)}, чтобы подтвердить заказ и время доставки.</p>
      </section>
      <div class="page-body success">
        ${FS.config.demoMode ? `<p class="notice"><strong>Демо-режим.</strong> Заказ сохранён только в этом браузере и не отправлен в бутик. Чтобы получать заказы, подключите сервер в assets/js/api.js.</p>` : ''}
        <div class="success-card">
          <dl class="summary-sum">
            <div><dt>Получатель</dt><dd>${esc(order.customer.firstName)} ${esc(order.customer.lastName)}</dd></div>
            <div><dt>Доставка</dt><dd>${esc(order.delivery.name)}</dd></div>
            ${order.delivery.id === 'pickup' ? '' : `<div><dt>Адрес</dt><dd>${esc(order.customer.city)}, ${esc(order.customer.address)}</dd></div>`}
            <div><dt>Оплата</dt><dd>${esc(order.payment.name)}, заказ не оплачен</dd></div>
            <div class="summary-total"><dt>Итого</dt><dd>${money(order.total)}${order.shipping === null ? '<small>без учёта доставки</small>' : ''}</dd></div>
          </dl>
        </div>
        <a class="btn btn--primary" href="#catalog">Вернуться в каталог</a>
      </div>`;
  }

  function render() {
    if (placed) {
      const order = placed;
      placed = null;
      return successState(order);
    }
    if (!FS.store.count()) return emptyState();
    const values = draft();
    const method = values.delivery || FS.delivery[0].id;
    return `
      <section class="page-head">
        <nav class="crumbs" aria-label="Навигационная цепочка"><a href="#home">Главная</a><span aria-hidden="true">/</span><span aria-current="page">Оформление заказа</span></nav>
        <h1>Оформление заказа</h1>
      </section>
      <div class="checkout">
        <form class="checkout-form" novalidate data-checkout>
          <fieldset class="co-step">
            <legend>Покупатель</legend>
            <div class="field-grid">${FIELDS.slice(0, 4).map((f) => field(f, values)).join('')}</div>
          </fieldset>

          <fieldset class="co-step">
            <legend>Доставка</legend>
            <div class="options">
              ${FS.delivery.map((d) => `
                <label class="option">
                  <input type="radio" name="delivery" value="${d.id}" ${d.id === method ? 'checked' : ''}>
                  <span class="option-body"><span class="option-name">${esc(d.name)}</span><span class="option-note">${esc(d.note)}</span></span>
                </label>`).join('')}
            </div>
            <div class="field-grid" data-address>${FIELDS.slice(4).map((f) => field(f, values)).join('')}</div>
          </fieldset>

          <fieldset class="co-step">
            <legend>Оплата</legend>
            <div class="options">
              ${FS.paymentMethods.map((m, i) => `
                <label class="option ${m.enabled ? '' : 'is-disabled'}">
                  <input type="radio" name="payment" value="${m.id}" ${m.enabled ? '' : 'disabled'} ${i === 0 ? 'checked' : ''}>
                  <span class="option-body"><span class="option-name">${esc(m.name)}</span><span class="option-note">${esc(m.note)}</span></span>
                </label>`).join('')}
            </div>
            <p class="co-hint">Онлайн-оплата пока не подключена. Заказ оплачивается при получении: картой или наличными.</p>
          </fieldset>

          <fieldset class="co-step">
            <legend>Комментарий</legend>
            <div class="field field--wide">
              <label for="co-comment">Комментарий к заказу <span class="optional">необязательно</span></label>
              <textarea id="co-comment" name="comment" rows="3" placeholder="Например, удобное время доставки или текст открытки">${esc(values.comment || '')}</textarea>
            </div>
            <label class="check">
              <input type="checkbox" name="gift" ${values.gift ? 'checked' : ''}>
              <span class="check-box" aria-hidden="true"></span>
              <span class="check-label">Упаковать в подарочную коробку</span>
            </label>
          </fieldset>

          <p class="form-error" data-form-error role="alert"></p>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Подтвердить заказ</button>
          <p class="co-legal">Нажимая кнопку, вы соглашаетесь на обработку персональных данных для доставки заказа.</p>
        </form>

        <aside class="summary" data-summary aria-label="Ваш заказ">${summary(values)}</aside>
      </div>`;
  }

  function values() {
    const form = $('[data-checkout]', root);
    const data = Object.fromEntries(new FormData(form).entries());
    data.gift = form.elements.gift.checked;
    return data;
  }

  function validate(data) {
    const errors = {};
    const pickup = data.delivery === 'pickup';
    FIELDS.forEach((f) => {
      if (pickup && (f.id === 'address' || f.id === 'city')) return;
      if (f.required && !String(data[f.id] || '').trim()) errors[f.id] = `Заполните поле «${f.label}»`;
    });
    const digits = String(data.phone || '').replace(/\D/g, '');
    if (data.phone && (digits.length < 10 || digits.length > 12)) errors.phone = 'Введите номер телефона из 10–11 цифр, например +7 701 123 45 67';
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Проверьте адрес почты: в нём должны быть @ и домен, например name@mail.kz';
    return errors;
  }

  function showErrors(errors) {
    $$('.field', root).forEach((el) => {
      const id = el.dataset.field;
      const msg = id && errors[id];
      el.classList.toggle('has-error', Boolean(msg));
      const input = $('input, textarea', el);
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      const out = $('.field-error', el);
      if (out) out.textContent = msg || '';
    });
  }

  function syncAddress() {
    const pickup = $('input[name="delivery"]:checked', root).value === 'pickup';
    const box = $('[data-address]', root);
    box.hidden = pickup;
  }

  function mount(el) {
    root = el;
    const form = $('[data-checkout]', root);
    if (!form) return;
    syncAddress();
    let touched = false;

    form.addEventListener('input', () => {
      const data = values();
      FS.storage.set(DRAFT_KEY, { ...data, payment: undefined });
      if (touched) showErrors(validate(data));
    });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'delivery') {
        syncAddress();
        $('[data-summary]', root).innerHTML = summary(values());
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      touched = true;
      const data = values();
      const errors = validate(data);
      showErrors(errors);
      const errorBox = $('[data-form-error]', root);
      if (Object.keys(errors).length) {
        errorBox.textContent = 'Проверьте отмеченные поля.';
        const first = $('.has-error input, .has-error textarea', root);
        if (first) first.focus();
        return;
      }
      errorBox.textContent = '';
      const submit = $('button[type="submit"]', form);
      submit.disabled = true;
      submit.textContent = 'Оформляем…';

      const lines = FS.store.lines();
      const subtotal = FS.store.subtotal();
      const delivery = FS.delivery.find((d) => d.id === data.delivery);
      const payment = FS.paymentMethods.find((m) => m.id === data.payment);
      const shipping = FS.shipping.quote(delivery.id, subtotal);
      try {
        const order = await FS.api.createOrder({
          customer: { firstName: data.firstName.trim(), lastName: data.lastName.trim(), phone: data.phone.trim(), email: data.email.trim(), city: data.city.trim(), address: (data.address || '').trim() },
          items: lines.map((l) => ({ id: l.product.id, name: l.product.name, brand: l.product.brand, ml: l.ml, qty: l.qty, price: l.volume.price })),
          delivery: { id: delivery.id, name: delivery.name },
          payment: { id: payment.id, name: payment.name },
          comment: data.comment || '',
          gift: data.gift,
          subtotal,
          shipping,
          total: subtotal + (shipping || 0)
        });
        await FS.payments.start(payment.id, order);
        placed = order;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        FS.store.clear();
        FS.storage.set(DRAFT_KEY, {});
        FS.app.go('checkout');
      } catch (err) {
        submit.disabled = false;
        submit.textContent = 'Подтвердить заказ';
        errorBox.textContent = 'Не удалось оформить заказ. Проверьте соединение и попробуйте ещё раз или позвоните в бутик.';
      }
    });

    unsubscribe = FS.store.subscribe((kind) => {
      if (kind !== 'cart') return;
      if (!FS.store.count()) { FS.app.go('checkout'); return; }
      $('[data-summary]', root).innerHTML = summary(values());
    });
  }

  function unmount() { if (unsubscribe) { unsubscribe(); unsubscribe = null; } }

  return { render, mount, unmount, title: () => 'Оформление заказа' };
})();
