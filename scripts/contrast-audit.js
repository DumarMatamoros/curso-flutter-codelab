// Auditoría de contraste WCAG para ejecutar en el navegador (Chrome DevTools o consola).
// No se carga en el sitio. Uso: pegar el archivo en la consola y llamar a auditContrast().
// Para fondos con degradado se toma el peor caso entre sus colores.
function auditContrast({ root = document.body } = {}) {
  const parse = (value) => {
    const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\)/.exec(value || '');
    if (!m) return null;
    let a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (String(m[4]).endsWith('%')) a /= 100;
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  };
  const colorsIn = (image) => (image.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean);
  const blend = (top, bottom) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
  };
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  // Devuelve los posibles fondos efectivos (varios si hay degradados).
  function backgrounds(el) {
    const layers = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const cs = getComputedStyle(node);
      const candidates = [];
      const before = getComputedStyle(node, '::before');
      if (before.content !== 'none' && parseFloat(before.opacity) > 0.5 && before.position === 'absolute' && /gradient/.test(before.backgroundImage)) {
        candidates.push(...colorsIn(before.backgroundImage));
      }
      if (!candidates.length && /gradient/.test(cs.backgroundImage)) candidates.push(...colorsIn(cs.backgroundImage));
      const bg = parse(cs.backgroundColor);
      if (candidates.length) {
        layers.push(candidates.map((c) => (c[3] < 1 && bg ? blend(c, bg) : c)));
        if (candidates.every((c) => c[3] >= 1)) return combine(layers);
      } else if (bg && bg[3] > 0) {
        layers.push([bg]);
        if (bg[3] >= 1) return combine(layers);
      }
    }
    layers.push([[255, 255, 255, 1]]);
    return combine(layers);
  }
  function combine(layers) {
    let result = layers.pop();
    while (layers.length) {
      const top = layers.pop();
      result = top.flatMap((t) => result.map((b) => (t[3] >= 1 ? t : blend(t, b))));
    }
    return result;
  }

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false;
    }
    return true;
  };
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') +
    (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');

  const seen = new Set();
  const results = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode.nodeValue.trim();
    const el = walker.currentNode.parentElement;
    if (!text || !el || seen.has(el) || el.closest('script, style, noscript, svg, [aria-hidden="true"]')) continue;
    seen.add(el);
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const fgRaw = parse(cs.color);
    if (!fgRaw || fgRaw[3] === 0) continue; // texto transparente: oculto a propósito, sin requisito de contraste
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    const worst = backgrounds(el).map((bg) => {
      const fg = fgRaw[3] < 1 ? blend(fgRaw, bg) : fgRaw;
      return { bg, ratio: ratio(fg, bg) };
    }).sort((a, b) => a.ratio - b.ratio)[0];
    results.push({
      selector: describe(el),
      text: text.slice(0, 50),
      fg: cs.color,
      bg: `rgb(${worst.bg.slice(0, 3).map(Math.round).join(', ')})`,
      ratio: Math.round(worst.ratio * 100) / 100,
      size,
      required
    });
  }
  return results;
}

if (typeof module !== 'undefined') module.exports = { auditContrast };
