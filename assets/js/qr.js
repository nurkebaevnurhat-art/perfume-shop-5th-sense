/* 5th SENSE — QR-коды (касса, карта клиента). Библиотека qrcode-generator
   подгружается только когда QR нужен; рисуем SVG сами: чёткий на любом экране,
   цвет — currentColor. */
window.FS = window.FS || {};

FS.qr = (function () {
  const LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  let loading = null;

  function lib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LIB;
        s.onload = () => resolve(window.qrcode);
        s.onerror = () => { loading = null; reject(new Error('Не удалось загрузить QR-код. Проверьте интернет.')); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // SVG с QR-кодом: квадраты модулей одним path, поле 2 модуля.
  async function svg(text, label) {
    const qrcode = await lib();
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const pad = 2;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + pad} ${r + pad}h1v1h-1z`;
    }
    const size = n + pad * 2;
    return `<svg class="qr-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${FS.ui.esc(label || 'QR-код')}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#0e0c0a"/></svg>`;
  }

  return { svg };
})();
