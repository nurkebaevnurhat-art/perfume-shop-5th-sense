/* 5th SENSE — иллюстрации флаконов.
   Пока у товаров нет фотографий, флакон рисуется в SVG по параметрам
   product.bottle. Если у товара задан product.image, используется фото. */
window.FS = window.FS || {};

FS.bottle = (function () {
  let uid = 0;

  const METALS = {
    gold: ['#5e4520', '#ead39d', '#a98549', '#4d3819'],
    silver: ['#4f5153', '#f1f2f3', '#a7aaad', '#3d3f41'],
    black: ['#020202', '#4a4542', '#151311', '#000000'],
    clear: ['#d9d4cc', '#ffffff', '#ebe6de', '#bdb6ab']
  };

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function mix(hex, target, t) {
    const a = hexToRgb(hex);
    const b = hexToRgb(target);
    return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  /* Геометрия корпуса: прямоугольник корпуса, горлышко и колпачок. */
  const SHAPES = {
    block: { x1: 34, x2: 166, y1: 168, y2: 300, path: (g) => roundRect(g, 12), neck: [83, 117, 154], cap: [64, 136, 92] },
    tower: { x1: 56, x2: 144, y1: 108, y2: 300, path: (g) => roundRect(g, 8), neck: [86, 114, 96], cap: [72, 128, 30] },
    cylinder: { x1: 52, x2: 148, y1: 126, y2: 300, path: (g) => roundRect(g, 6), neck: [85, 115, 114], cap: [66, 134, 70] },
    flask: { x1: 42, x2: 158, y1: 142, y2: 300, path: (g) => `M${g.x1},${g.y2 - 8} Q${g.x1},${g.y2} ${g.x1 + 8},${g.y2} H${g.x2 - 8} Q${g.x2},${g.y2} ${g.x2},${g.y2 - 8} V${g.y1 + 40} Q${g.x2},${g.y1} ${g.x2 - 40},${g.y1} H${g.x1 + 40} Q${g.x1},${g.y1} ${g.x1},${g.y1 + 40} Z`, neck: [85, 115, 130], cap: [68, 132, 76] },
    facet: { x1: 40, x2: 160, y1: 150, y2: 300, path: (g) => { const c = 24; return `M${g.x1 + c},${g.y1} H${g.x2 - c} L${g.x2},${g.y1 + c} V${g.y2 - c} L${g.x2 - c},${g.y2} H${g.x1 + c} L${g.x1},${g.y2 - c} V${g.y1 + c} Z`; }, neck: [84, 116, 138], cap: [66, 134, 82] },
    amphora: { x1: 48, x2: 152, y1: 138, y2: 300, path: () => 'M100,138 C72,150 48,188 50,236 C52,276 74,300 100,300 C126,300 148,276 150,236 C152,188 128,150 100,138 Z', neck: [91, 109, 92], cap: [74, 126, 40] }
  };

  function roundRect(g, r) {
    return `M${g.x1 + r},${g.y1} H${g.x2 - r} Q${g.x2},${g.y1} ${g.x2},${g.y1 + r} V${g.y2 - r} Q${g.x2},${g.y2} ${g.x2 - r},${g.y2} H${g.x1 + r} Q${g.x1},${g.y2} ${g.x1},${g.y2 - r} V${g.y1 + r} Q${g.x1},${g.y1} ${g.x1 + r},${g.y1} Z`;
  }

  function metalGradient(id, metal) {
    const c = METALS[metal] || METALS.gold;
    return `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${c[0]}"/><stop offset=".35" stop-color="${c[1]}"/>
      <stop offset=".6" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[3]}"/></linearGradient>`;
  }

  function drawCap(type, box, fill, neckTop) {
    const [x1, x2, y1] = box;
    const y2 = neckTop + 1;
    const w = x2 - x1;
    const cx = (x1 + x2) / 2;
    switch (type) {
      case 'sphere': {
        const r = Math.min(w, y2 - y1) / 2;
        return `<circle cx="${cx}" cy="${y2 - r}" r="${r}" fill="${fill}"/>
          <ellipse cx="${cx - r * 0.35}" cy="${y2 - r * 1.35}" rx="${r * 0.28}" ry="${r * 0.18}" fill="#fff" opacity=".35"/>`;
      }
      case 'orb': {
        const r = Math.min(w, y2 - y1) / 2.3;
        return `<rect x="${cx - r * 0.55}" y="${y2 - 10}" width="${r * 1.1}" height="10" fill="${fill}"/>
          <circle cx="${cx}" cy="${y2 - 10 - r}" r="${r}" fill="${fill}"/>
          <ellipse cx="${cx - r * 0.35}" cy="${y2 - 10 - r * 1.35}" rx="${r * 0.3}" ry="${r * 0.2}" fill="#fff" opacity=".4"/>`;
      }
      case 'disc':
        return `<rect x="${x1}" y="${y1}" width="${w}" height="${y2 - y1}" rx="3" fill="${fill}"/>
          <rect x="${x1}" y="${y1}" width="${w}" height="5" rx="2.5" fill="#fff" opacity=".18"/>`;
      case 'tall':
        return `<rect x="${x1}" y="${y1}" width="${w}" height="${y2 - y1}" rx="6" fill="${fill}"/>
          <rect x="${x1 + w * 0.18}" y="${y1 + 6}" width="${w * 0.08}" height="${y2 - y1 - 12}" rx="2" fill="#fff" opacity=".22"/>`;
      default: // cube
        return `<rect x="${x1}" y="${y1}" width="${w}" height="${y2 - y1}" rx="4" fill="${fill}"/>
          <rect x="${x1 + w * 0.14}" y="${y1 + 5}" width="${w * 0.09}" height="${y2 - y1 - 10}" rx="2" fill="#fff" opacity=".2"/>`;
    }
  }

  function labelMarkup(b, g, liquid) {
    const text = (b.label || '').toUpperCase() === '5TH SENSE' ? '5th SENSE' : (b.label || '');
    if (!text) return '';
    const bw = g.x2 - g.x1;
    const cy = g.y1 + (g.y2 - g.y1) * 0.56;
    const size = Math.min(15, (bw * 0.78) / (text.length * 0.78));
    const font = `font-family="Onest, 'Helvetica Neue', Arial, sans-serif" font-size="${size.toFixed(1)}" letter-spacing="${(size * 0.14).toFixed(1)}" text-anchor="middle"`;
    if (b.labelStyle === 'paper') {
      const lw = bw * 0.62;
      return `<rect x="${100 - lw / 2}" y="${cy - 20}" width="${lw}" height="34" fill="#f4efe6"/>
        <text x="100" y="${cy + 1}" ${font} fill="#1b130d">${text}</text>
        <line x1="${100 - lw / 2 + 8}" x2="${100 + lw / 2 - 8}" y1="${cy + 7}" y2="${cy + 7}" stroke="#1b130d" stroke-width=".6" opacity=".5"/>`;
    }
    const light = luminance(liquid) > 0.55;
    return `<text x="100" y="${cy}" ${font} fill="${light ? '#2a1d12' : '#f6efe3'}" opacity="${light ? 0.75 : 0.82}">${text}</text>`;
  }

  function glassBody(id, b, g, path) {
    const liquid = b.liquid || '#b07a3c';
    const dark = mix(liquid, '#000000', 0.45);
    const light = mix(liquid, '#ffffff', 0.35);
    const bw = g.x2 - g.x1;
    return `
      <defs>
        <linearGradient id="${id}l" x1="0" x2="1">
          <stop offset="0" stop-color="${dark}"/><stop offset=".22" stop-color="${liquid}"/>
          <stop offset=".48" stop-color="${light}"/><stop offset=".78" stop-color="${liquid}"/>
          <stop offset="1" stop-color="${dark}"/></linearGradient>
        <linearGradient id="${id}v" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".16" stop-color="#fff" stop-opacity="0"/>
          <stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
        <clipPath id="${id}c"><path d="${path}"/></clipPath>
      </defs>
      <g clip-path="url(#${id}c)">
        <path d="${path}" fill="url(#${id}l)"/>
        <rect x="0" y="0" width="200" height="320" fill="url(#${id}v)"/>
        <rect x="0" y="${g.y1}" width="200" height="${(g.y2 - g.y1) * 0.12}" fill="#fff" opacity=".16"/>
        <rect x="0" y="${g.y2 - 15}" width="200" height="15" fill="#fff" opacity=".1"/>
        <rect x="${g.x1 + bw * 0.09}" y="${g.y1}" width="${bw * 0.07}" height="${g.y2 - g.y1}" fill="#fff" opacity=".42"/>
        <rect x="${g.x1 + bw * 0.2}" y="${g.y1}" width="2" height="${g.y2 - g.y1}" fill="#fff" opacity=".22"/>
        <rect x="${g.x2 - bw * 0.12}" y="${g.y1}" width="${bw * 0.04}" height="${g.y2 - g.y1}" fill="#fff" opacity=".14"/>
      </g>
      <path d="${path}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.2"/>`;
  }

  function single(b, id) {
    const shape = SHAPES[b.shape] || SHAPES.block;
    const g = shape;
    const path = shape.path(g);
    const [nx1, nx2, ny] = shape.neck;
    const neckH = b.shape === 'amphora' ? 50 : g.y1 - ny + 2;
    const capType = b.cap || 'cube';
    let neck = `<rect x="${nx1}" y="${ny}" width="${nx2 - nx1}" height="${neckH}" fill="url(#${id}m)"/>`;
    if (b.shape === 'amphora') {
      neck += [0, 1, 2].map((i) => `<rect x="${nx1 - 3}" y="${ny + 8 + i * 12}" width="${nx2 - nx1 + 6}" height="4" fill="url(#${id}m)"/>`).join('');
    }
    return `
      <defs>${metalGradient(id + 'm', b.capColor === 'clear' ? 'gold' : b.capColor)}${metalGradient(id + 'k', b.capColor)}</defs>
      ${glassBody(id, b, g, path)}
      ${labelMarkup(b, g, b.liquid || '#b07a3c')}
      ${neck}
      ${drawCap(capType, shape.cap, `url(#${id}k)`, ny)}`;
  }

  function set(b, id) {
    const count = b.count || 3;
    const inner = 136;
    const step = inner / count;
    const bw = Math.min(30, step - 8);
    let bottles = '';
    for (let i = 0; i < count; i++) {
      const cx = 32 + step * i + step / 2;
      const top = 150 + (i % 2) * 6;
      const g = { x1: cx - bw / 2, x2: cx + bw / 2, y1: top, y2: 262 };
      const path = roundRect(g, 4);
      const tint = i % 2 ? mix(b.liquid, '#ffffff', 0.25) : b.liquid;
      bottles += glassBody(`${id}b${i}`, { liquid: tint }, g, path) +
        `<rect x="${cx - bw * 0.32}" y="${top - 26}" width="${bw * 0.64}" height="27" rx="3" fill="url(#${id}k)"/>`;
    }
    const label = b.label === '5th SENSE' ? '5th SENSE' : (b.label || '');
    return `
      <defs>
        ${metalGradient(id + 'k', b.capColor)}${metalGradient(id + 'g', 'gold')}
        <linearGradient id="${id}w" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5a3a22"/><stop offset="1" stop-color="#2a1a0f"/></linearGradient>
        <linearGradient id="${id}i" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1a110b"/><stop offset="1" stop-color="#3b2416"/></linearGradient>
      </defs>
      <rect x="18" y="104" width="164" height="124" rx="4" fill="url(#${id}i)"/>
      <rect x="18" y="104" width="164" height="3" fill="#c9a66b" opacity=".5"/>
      ${bottles}
      <rect x="14" y="226" width="172" height="74" rx="4" fill="url(#${id}w)"/>
      <rect x="14" y="226" width="172" height="2" fill="#fff" opacity=".18"/>
      <rect x="62" y="250" width="76" height="26" rx="2" fill="url(#${id}g)"/>
      <text x="100" y="267.5" text-anchor="middle" font-family="Onest, 'Helvetica Neue', Arial, sans-serif" font-size="${label.length > 8 ? 9.5 : 11}" letter-spacing="1.2" fill="#2a1d10">${label}</text>`;
  }

  /* render(product, { view: 'full' | 'detail', title }) → строка <svg>. */
  function render(product, opts) {
    const o = opts || {};
    const b = product.bottle || {};
    const id = 'fsb' + ++uid;
    const body = b.shape === 'set' ? set(b, id) : single(b, id);
    const viewBox = o.view === 'detail' ? '26 24 148 170' : '0 0 200 320';
    const title = o.title ? `<title>${o.title}</title>` : '';
    const role = o.title ? 'role="img"' : 'aria-hidden="true" focusable="false"';
    return `<svg class="bottle-svg" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" ${role} preserveAspectRatio="xMidYMax meet">${title}
      <ellipse cx="100" cy="303" rx="78" ry="7" fill="#000" opacity=".45"/>${body}</svg>`;
  }

  /* ---------- Чертёж и силуэт ----------
     Флакон как технический чертёж: контур, толщина стекла, осевая линия,
     размерные линии и выноски. Используется в карточках и на странице товара. */

  // Колпачок без бликов: только геометрия, цвет задаёт родительская группа.
  function capGeom(type, box, ny) {
    const [x1, x2, y1] = box;
    const y2 = ny + 1;
    const w = x2 - x1;
    const cx = (x1 + x2) / 2;
    if (type === 'sphere') { const r = Math.min(w, y2 - y1) / 2; return { svg: `<circle cx="${cx}" cy="${y2 - r}" r="${r}"/>`, top: y2 - 2 * r, right: cx + r }; }
    if (type === 'orb') { const r = Math.min(w, y2 - y1) / 2.3; return { svg: `<rect x="${cx - r * 0.55}" y="${y2 - 10}" width="${r * 1.1}" height="10"/><circle cx="${cx}" cy="${y2 - 10 - r}" r="${r}"/>`, top: y2 - 10 - 2 * r, right: cx + r }; }
    return { svg: `<rect x="${x1}" y="${y1}" width="${w}" height="${y2 - y1}" rx="${type === 'tall' ? 6 : type === 'disc' ? 3 : 4}"/>`, top: y1, right: x2 };
  }

  function parts(b) {
    if (b.shape === 'set') return null;
    const shape = SHAPES[b.shape] || SHAPES.block;
    const [nx1, nx2, ny] = shape.neck;
    const neckH = b.shape === 'amphora' ? 50 : shape.y1 - ny + 2;
    let neck = `<rect x="${nx1}" y="${ny}" width="${nx2 - nx1}" height="${neckH}"/>`;
    if (b.shape === 'amphora') neck += [0, 1, 2].map((i) => `<rect x="${nx1 - 3}" y="${ny + 8 + i * 12}" width="${nx2 - nx1 + 6}" height="4"/>`).join('');
    const cap = capGeom(b.cap || 'cube', shape.cap, ny);
    return { g: shape, path: shape.path(shape), neck, cap, ny };
  }

  function setGeom(b) {
    const count = b.count || 3;
    const step = 136 / count;
    const bw = Math.min(30, step - 8);
    let s = '';
    for (let i = 0; i < count; i++) {
      const cx = 32 + step * i + step / 2;
      const top = 150 + (i % 2) * 6;
      s += `<rect x="${cx - bw / 2}" y="${top}" width="${bw}" height="${226 - top}" rx="4"/><rect x="${cx - bw * 0.32}" y="${top - 26}" width="${bw * 0.64}" height="27" rx="3"/>`;
    }
    return { bottles: s, box: '<rect x="14" y="226" width="172" height="74" rx="4"/>', lid: '<rect x="18" y="104" width="164" height="122" rx="4"/>' };
  }

  function blueprint(product, opts) {
    const o = opts || {};
    const b = product.bottle || {};
    const id = 'fsp' + ++uid;
    const ink = 'var(--bp-ink, #1464d6)';
    const thin = `stroke="${ink}" fill="none" stroke-width=".6"`;
    const title = o.title ? `<title>${o.title}</title>` : '';
    const role = o.title ? 'role="img"' : 'aria-hidden="true" focusable="false"';
    const text = (x, y, t, anchor) => `<text x="${x}" y="${y}" text-anchor="${anchor || 'start'}" font-family="Onest, 'Helvetica Neue', Arial, sans-serif" font-size="7.6" fill="${ink}">${t}</text>`;
    const tick = (x, y, horizontal) => horizontal
      ? `<line x1="${x}" x2="${x}" y1="${y - 4}" y2="${y + 4}" ${thin}/><line x1="${x - 3}" x2="${x + 3}" y1="${y + 3}" y2="${y - 3}" ${thin}/>`
      : `<line x1="${x - 4}" x2="${x + 4}" y1="${y}" y2="${y}" ${thin}/><line x1="${x - 3}" x2="${x + 3}" y1="${y + 3}" y2="${y - 3}" ${thin}/>`;

    let drawing;
    let top;
    let x1 = 14;
    let x2 = 186;
    let bottom = 300;
    let capRight = 160;
    let capMid = 90;
    if (b.shape === 'set') {
      const s = setGeom(b);
      top = 104;
      capMid = 140;
      drawing = `<g stroke="${ink}" stroke-width="1.2" fill="${ink}" fill-opacity=".05">${s.lid}${s.bottles}${s.box}</g>
        <line x1="40" x2="160" y1="263" y2="263" ${thin} stroke-dasharray="3 3"/>`;
    } else {
      const p = parts(b);
      const g = p.g;
      x1 = g.x1; x2 = g.x2; bottom = g.y2;
      top = p.cap.top;
      capRight = p.cap.right;
      capMid = (top + p.ny) / 2;
      const cy = (g.y1 + g.y2) / 2;
      const sx = ((g.x2 - g.x1) - 12) / (g.x2 - g.x1);
      const sy = ((g.y2 - g.y1) - 12) / (g.y2 - g.y1);
      const level = g.y1 + (g.y2 - g.y1) * 0.17;
      const labelY = g.y1 + (g.y2 - g.y1) * 0.58;
      const label = (b.label || '').toUpperCase() === '5TH SENSE' ? '5th SENSE' : (b.label || '');
      drawing = `
        <defs><clipPath id="${id}c"><path d="${p.path}"/></clipPath></defs>
        <path d="${p.path}" fill="${ink}" fill-opacity=".05" stroke="${ink}" stroke-width="1.3"/>
        <path d="${p.path}" fill="none" stroke="${ink}" stroke-width=".6" transform="translate(100 ${cy}) scale(${sx} ${sy}) translate(-100 -${cy})"/>
        <g clip-path="url(#${id}c)"><line x1="0" x2="200" y1="${level}" y2="${level}" ${thin} stroke-dasharray="4 3"/>
          <g ${thin} opacity=".35">${Array.from({ length: 9 }, (_, i) => `<line x1="${g.x1 + i * 16 - 40}" x2="${g.x1 + i * 16 + 40}" y1="${g.y2}" y2="${g.y2 - 80}"/>`).join('')}</g></g>
        <g fill="${ink}" fill-opacity=".05" stroke="${ink}" stroke-width="1.2">${p.neck}${p.cap.svg}</g>
        ${label ? `<text x="100" y="${labelY}" text-anchor="middle" font-family="Onest, 'Helvetica Neue', Arial, sans-serif" font-size="${Math.min(12, ((g.x2 - g.x1) * 0.7) / (label.length * 0.7)).toFixed(1)}" letter-spacing="1.5" fill="${ink}">${label}</text>` : ''}`;
    }

    // Осевая, основание и размерные линии.
    const dimX = Math.max(x2, capRight) + 20;
    const frame = `
      <line x1="100" x2="100" y1="${top - 14}" y2="${bottom + 10}" ${thin} stroke-dasharray="12 3 2 3" opacity=".7"/>
      <line x1="${x1 - 18}" x2="${x2 + 18}" y1="${bottom + 0.5}" y2="${bottom + 0.5}" ${thin}/>
      <line x1="${capRight + 3}" x2="${dimX + 5}" y1="${top}" y2="${top}" ${thin} stroke-dasharray="2 2"/>
      <line x1="${x2 + 3}" x2="${dimX + 5}" y1="${bottom}" y2="${bottom}" ${thin} stroke-dasharray="2 2"/>
      <line x1="${dimX}" x2="${dimX}" y1="${top}" y2="${bottom}" ${thin}/>${tick(dimX, top)}${tick(dimX, bottom)}
      <line x1="${x1}" x2="${x1}" y1="${bottom + 4}" y2="${bottom + 22}" ${thin} stroke-dasharray="2 2"/>
      <line x1="${x2}" x2="${x2}" y1="${bottom + 4}" y2="${bottom + 22}" ${thin} stroke-dasharray="2 2"/>
      <line x1="${x1}" x2="${x2}" y1="${bottom + 18}" y2="${bottom + 18}" ${thin}/>${tick(x1, bottom + 18, true)}${tick(x2, bottom + 18, true)}`;

    // Выноски с реальными данными товара (только на крупном виде).
    let notes = '';
    if (o.annotate) {
      const v = FS.api.mainVolume(product);
      const conc = product.type === 'set' ? 'набор' : product.concentration;
      notes = `
        <polyline points="${capRight + 2},${capMid} ${dimX - 8},${capMid - 22} ${dimX + 62},${capMid - 22}" ${thin}/>
        ${text(dimX + 8, capMid - 26, product.type === 'set' ? 'крышка' : 'колпачок')}
        <polyline points="${x1 + 6},${bottom - 30} ${x1 - 22},${bottom - 58} ${x1 - 70},${bottom - 58}" ${thin}/>
        ${text(x1 - 70, bottom - 62, product.type === 'set' ? (v.label || '') : `${v.ml} мл, ${conc}`)}
        ${text(dimX + 6, (top + bottom) / 2, 'H', 'start')}
        ${text(100, bottom + 30, 'W', 'middle')}`;
    }

    const vb = o.annotate ? '-80 20 360 330' : '-6 20 232 318';
    return `<svg class="bottle-svg bottle-svg--bp" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" ${role} preserveAspectRatio="xMidYMax meet">${title}${drawing}${frame}${notes}</svg>`;
  }

  /* Силуэт флакона одной заливкой — для коллекций и крупных акцентов. */
  function silhouette(product, fill) {
    const b = product.bottle || {};
    let body;
    if (b.shape === 'set') {
      const s = setGeom(b);
      body = s.lid + s.bottles + s.box;
    } else {
      const p = parts(b);
      body = `<path d="${p.path}"/>${p.neck}${p.cap.svg}`;
    }
    return `<svg class="bottle-svg bottle-svg--ink" viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMax meet"><g fill="${fill || 'currentColor'}">${body}</g></svg>`;
  }

  /* Возвращает либо <img> с фото, либо SVG-иллюстрацию.
     style: 'blueprint' (чертёж) или 'render' (объёмный флакон); photo:false — только рисунок. */
  function media(product, opts) {
    const o = opts || {};
    if (product.image && o.photo !== false) {
      const alt = String(o.title || `${product.brand} ${product.name}`).replace(/"/g, '&quot;');
      return `<img class="bottle-img" src="${FS.assetUrl(product.image)}" alt="${alt}" loading="lazy" decoding="async">`;
    }
    return o.style === 'blueprint' ? blueprint(product, o) : render(product, o);
  }

  return { render, media, blueprint, silhouette };
})();
