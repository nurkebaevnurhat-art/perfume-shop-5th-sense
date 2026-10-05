/* 5th SENSE — движение.
   Один цикл requestAnimationFrame на прокрутку: сцены страницы регистрируются
   через FS.motion.scene(fn) и получают текущую прокрутку и высоту окна.
   Всё отключается при prefers-reduced-motion. */
window.FS = window.FS || {};

FS.motion = (function () {
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let scenes = [];
  let ticking = false;
  let io = null;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  /* ---------- Появление при прокрутке ---------- */
  function reveals(root) {
    const items = $$('.reveal:not(.is-in)', root);
    if (reduce.matches || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
    if (!io) {
      io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }), { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    }
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Разбивка текста на слова и буквы для анимаций ---------- */
  function splitWords(el) {
    if (!el || el.dataset.split) return [];
    el.dataset.split = 'words';
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true" style="--wi:${i}"><span class="wi">${w}</span></span>`).join(' ');
    return $$('.w', el);
  }

  function splitChars(el) {
    if (!el || el.dataset.split) return;
    el.dataset.split = 'chars';
    const text = el.textContent;
    el.setAttribute('aria-label', text.trim());
    let i = 0;
    el.innerHTML = text.split(/(\s+)/).map((part) => (/^\s+$/.test(part) ? ' ' :
      `<span class="cw" aria-hidden="true">${[...part].map((ch) => `<span class="c" style="--ci:${i++}">${ch}</span>`).join('')}</span>`)).join('');
  }

  /* ---------- Логотип во всю ширину ---------- */
  function fit(root) {
    $$('[data-fit]', root).forEach((el) => {
      const parent = el.parentElement;
      const cs = getComputedStyle(parent);
      const box = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (!box) return;
      el.style.fontSize = '100px';
      const w = el.scrollWidth;
      if (w) el.style.fontSize = `${Math.floor((box / w) * 100 * 0.995)}px`;
    });
  }

  /* ---------- Сцены прокрутки ---------- */
  function scene(fn) { scenes.push(fn); requestTick(); }
  function clearScenes() { scenes = []; }
  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      const h = window.innerHeight;
      scenes.forEach((fn) => fn(y, h));
      headerTone();
    });
  }

  // Прогресс прохождения секции: 0 — верх секции у верха окна, 1 — секция прокручена на свою высоту минус окно.
  function progress(el, h) {
    const r = el.getBoundingClientRect();
    const span = r.height - h;
    return span > 0 ? clamp(-r.top / span, 0, 1) : (r.top <= 0 ? 1 : 0);
  }

  /* ---------- Цвет шапки по фону секции под ней ---------- */
  function headerTone() {
    const header = document.getElementById('site-header');
    if (!header) return;
    const y = header.offsetHeight / 2;
    let tone = 'light';
    const sections = $$('[data-head], .page-head');
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { tone = s.dataset.head || 'dark'; break; }
    }
    header.dataset.tone = tone;
    header.classList.toggle('is-scrolled', window.scrollY > 20);
  }

  /* ---------- Курсор «Смотреть»: стеклянное кольцо с бегущей по кругу надписью ---------- */
  function cursor() {
    if (!finePointer.matches || reduce.matches) return;
    const el = document.createElement('div');
    el.className = 'cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<span class="cursor-badge">
        <svg class="cursor-ring" viewBox="0 0 76 76" focusable="false">
          <defs><path id="cursor-path" d="M38 38m-27 0a27 27 0 1 1 54 0a27 27 0 1 1 -54 0"/></defs>
          <text><textPath href="#cursor-path" textLength="168" lengthAdjust="spacing"></textPath></text>
        </svg>
        <span class="cursor-dot"></span>
      </span>`;
    document.body.appendChild(el);
    const path = el.querySelector('textPath');
    let current = '';
    // Надпись повторяется, чтобы заполнить окружность: «СМОТРЕТЬ · СМОТРЕТЬ ·».
    const setLabel = (label) => {
      if (label === current) return;
      current = label;
      const word = label.toUpperCase();
      const reps = word.length <= 6 ? 3 : 2;
      path.textContent = Array(reps).fill(word + ' · ').join('');
    };
    let x = -100; let y = -100; let cx = x; let cy = y; let running = false;
    const step = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      if (Math.abs(x - cx) + Math.abs(y - cy) > 0.3) requestAnimationFrame(step); else running = false;
    };
    document.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      const target = e.target.closest && e.target.closest('[data-cursor]');
      if (target) { setLabel(target.dataset.cursor); el.classList.add('is-on'); } else el.classList.remove('is-on');
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => el.classList.remove('is-on'));
  }

  /* ---------- Вступление: эмблема, счётчик, логотип ---------- */
  function intro(done) {
    const el = document.getElementById('intro');
    let seen = false;
    try { seen = sessionStorage.getItem('fs.intro') === '1'; sessionStorage.setItem('fs.intro', '1'); } catch (e) { /* без хранилища показываем каждый раз */ }
    if (!el || seen || reduce.matches) {
      if (el) el.remove();
      done();
      return;
    }
    el.hidden = false;
    document.body.classList.add('is-intro');
    const counter = el.querySelector('[data-intro-count]');
    const start = performance.now();
    const dur = 1500;
    const tick = (t) => {
      const k = clamp((t - start) / dur, 0, 1);
      counter.textContent = String(Math.round(ease(k) * 100)).padStart(3, '0');
      if (k < 1) requestAnimationFrame(tick);
      else {
        el.classList.add('is-leaving');
        setTimeout(done, 350);
        setTimeout(() => { document.body.classList.remove('is-intro'); el.remove(); }, 1300);
      }
    };
    requestAnimationFrame(tick);
  }

  function init() {
    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', () => { fit(); requestTick(); }, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { fit(); requestTick(); });
      // Шрифт логотипа может догрузиться позже первой отрисовки: пересчитываем размер.
      document.fonts.addEventListener('loadingdone', () => { fit(); requestTick(); });
    }
    // Элементы, добавленные позже (фильтры каталога, избранное), тоже получают появление.
    if ('MutationObserver' in window) {
      let queued = false;
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; reveals(document.getElementById('view')); });
      }).observe(document.getElementById('view'), { childList: true, subtree: true });
    }
    cursor();
  }

  return {
    reduce, finePointer, clamp, ease,
    init, intro, reveals, splitWords, splitChars, fit,
    scene, clearScenes, progress, refresh: requestTick
  };
})();
