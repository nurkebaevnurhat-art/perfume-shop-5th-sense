/* 5th SENSE — состояние покупателя: корзина и избранное.
   Хранится в localStorage; если хранилище недоступно (приватный режим),
   работает в памяти до перезагрузки страницы. */
window.FS = window.FS || {};

FS.storage = (function () {
  const memory = {};
  return {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return key in memory ? memory[key] : fallback;
      }
    },
    set(key, value) {
      memory[key] = value;
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* память */ }
    }
  };
})();

FS.store = (function () {
  const CART_KEY = 'fs.cart.v1';
  const FAV_KEY = 'fs.favorites.v1';
  let cart = FS.storage.get(CART_KEY, []);
  let favorites = FS.storage.get(FAV_KEY, []);
  const listeners = new Set();

  function emit(kind) {
    listeners.forEach((fn) => fn(kind));
  }

  function variant(productId, ml) {
    const p = FS.api.productSync(productId);
    if (!p) return null;
    return { product: p, volume: p.volumes.find((v) => v.ml === ml) || p.volumes[0] };
  }

  // Убираем из сохранённой корзины позиции, которых больше нет в каталоге.
  function sanitize() {
    cart = cart.filter((line) => variant(line.id, line.ml));
  }

  const MAX_QTY = 10;

  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    lines() {
      sanitize();
      return cart.map((line) => {
        const v = variant(line.id, line.ml);
        return { ...line, product: v.product, volume: v.volume, total: v.volume.price * line.qty };
      });
    },
    count() { return cart.reduce((n, l) => n + l.qty, 0); },
    subtotal() { return this.lines().reduce((s, l) => s + l.total, 0); },

    maxQty(productId, ml) {
      const v = variant(productId, ml);
      return v ? Math.min(MAX_QTY, v.volume.stock) : 0;
    },

    /* Возвращает фактически добавленное количество (с учётом остатка). */
    add(productId, ml, qty) {
      const v = variant(productId, ml);
      if (!v || v.volume.stock < 1) return 0;
      const limit = this.maxQty(productId, v.volume.ml);
      const line = cart.find((l) => l.id === productId && l.ml === v.volume.ml);
      const current = line ? line.qty : 0;
      const added = Math.max(0, Math.min(qty || 1, limit - current));
      if (!added) return 0;
      if (line) line.qty += added;
      else cart.push({ id: productId, ml: v.volume.ml, qty: added });
      FS.storage.set(CART_KEY, cart);
      emit('cart');
      return added;
    },
    setQty(productId, ml, qty) {
      const line = cart.find((l) => l.id === productId && l.ml === ml);
      if (!line) return;
      const q = Math.max(1, Math.min(qty, this.maxQty(productId, ml)));
      line.qty = q;
      FS.storage.set(CART_KEY, cart);
      emit('cart');
    },
    remove(productId, ml) {
      cart = cart.filter((l) => !(l.id === productId && l.ml === ml));
      FS.storage.set(CART_KEY, cart);
      emit('cart');
    },
    clear() {
      cart = [];
      FS.storage.set(CART_KEY, cart);
      emit('cart');
    },

    isFavorite(id) { return favorites.includes(id); },
    favorites() { return favorites.slice(); },
    toggleFavorite(id) {
      favorites = favorites.includes(id) ? favorites.filter((f) => f !== id) : favorites.concat(id);
      FS.storage.set(FAV_KEY, favorites);
      emit('favorites');
      return favorites.includes(id);
    }
  };
})();
