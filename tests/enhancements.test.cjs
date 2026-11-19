const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Reproduce el orden real del navegador: scripts del documento y, al final, los diferidos.
async function load(name, { storage = {}, storageBlocked = false, scripts, hash = '', stepTop = null } = {}) {
  const dom = new JSDOM(read(name), { url: `https://example.test/curso/${name}${hash}`, runScripts: 'outside-only' });
  const win = dom.window;
  const scrolled = [];
  win.Element.prototype.scrollIntoView = function () { scrolled.push(this.id); };
  if (stepTop !== null) {
    // jsdom no calcula diseño: simula pasos por debajo de la ventana visible.
    const original = win.Element.prototype.getBoundingClientRect;
    win.Element.prototype.getBoundingClientRect = function () {
      if (this.classList?.contains('lab-step')) return { top: stepTop, bottom: stepTop + 300, left: 0, right: 300, width: 300, height: 300 };
      return original.call(this);
    };
  }
  win.matchMedia = () => Object.assign(new win.EventTarget(), { matches: false });
  for (const [key, value] of Object.entries(storage)) win.localStorage.setItem(key, value);
  if (storageBlocked) Object.defineProperty(win, 'localStorage', { get() { throw new Error('bloqueado'); } });
  win.fetch = async (url) => ({ ok: true, text: async () => read(url) });
  const navigated = [];
  win.eval(read('theme.js'));
  const pageScripts = scripts ?? Array.from(win.document.querySelectorAll('script[src]'), (s) => s.getAttribute('src'))
    .filter((src) => !['theme.js', 'enhancements.js'].includes(src));
  for (const src of pageScripts) win.eval(read(src));
  win.eval(read('enhancements.js'));
  win.CursoFlutterEnhancements.navigate = (url) => navigated.push(url);
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  await tick();
  await tick();
  return { dom, win, doc: win.document, api: win.CursoFlutterEnhancements, navigated, scrolled };
}

const page = (n) => `sesion-${String(n).padStart(2, '0')}.html`;

test('guarda y lee el progreso por sesión', async () => {
  const { dom, api } = await load('index.html');
  api.setStepDone(7, 2, true);
  api.setStepDone(7, 5, true);
  api.setStepDone(7, 2, false);
  assert.deepEqual(JSON.parse(JSON.stringify(api.readProgress())), { 7: [5] });
  assert.deepEqual({ ...api.sessionProgress(7, 9) }, { done: 1, total: 9, complete: false });
  dom.window.close();
});

test('ignora datos corruptos y almacenamiento bloqueado', async () => {
  const corrupt = await load('index.html', { storage: { curso_flutter_progress: '{oops', curso_flutter_last: '[1,2]' } });
  assert.deepEqual({ ...corrupt.api.readProgress() }, {});
  assert.equal(corrupt.api.readLast(), null);
  corrupt.dom.window.close();
  const blocked = await load(page(7), { storageBlocked: true });
  assert.doesNotThrow(() => blocked.api.setStepDone(7, 1, true));
  assert.equal(blocked.api.readLast(), null);
  assert.ok(blocked.doc.querySelector('.lab-step input[type=checkbox]'));
  blocked.dom.window.close();
});

test('sesion-07 añade casillas tras la carga asíncrona', async () => {
  const { dom, doc, win } = await load(page(7));
  const steps = doc.querySelectorAll('#detailed-codelab .lab-step');
  assert.ok(steps.length > 0);
  const boxes = doc.querySelectorAll('#detailed-codelab .lab-step input[type=checkbox]');
  assert.equal(boxes.length, steps.length);
  assert.equal(steps[0].id, 'paso-1');
  assert.equal(boxes[0].getAttribute('aria-label'), 'Marcar paso 0 como hecho'); // usa el número impreso en el paso
  boxes[0].click();
  assert.match(doc.querySelector('.step-progress').textContent, new RegExp(`1/${steps.length}`));
  assert.ok(steps[0].classList.contains('is-done'));
  assert.ok(doc.querySelector('.sidebar-week a[href="sesion-07.html"]').classList.contains('is-started'));
  assert.deepEqual({ ...JSON.parse(win.localStorage.getItem('curso_flutter_last')), ts: 0 }, { session: 7, step: 1, label: '0', ts: 0 });
  dom.window.close();
});

test('codelabs.html lleva progreso independiente por codelab', async () => {
  const { dom, doc } = await load('codelabs.html');
  doc.querySelector('#codelab-2 .lab-step input[type=checkbox]').click();
  assert.match(doc.querySelector('#codelab-2 .step-progress').textContent, /^1\//);
  assert.match(doc.querySelector('#codelab-1 .step-progress').textContent, /^0\//);
  dom.window.close();
});

test('marcar todos los pasos completa la sesión', async () => {
  const { dom, doc } = await load(page(5));
  doc.querySelectorAll('#detailed-codelab .lab-step input[type=checkbox]').forEach((box) => box.click());
  const link = doc.querySelector('.sidebar-week a[href="sesion-05.html"]');
  assert.ok(link.classList.contains('is-complete'));
  assert.equal(link.classList.contains('is-started'), false);
  dom.window.close();
});

test('restaura el progreso guardado y lo sincroniza entre pestañas', async () => {
  const { dom, doc, win } = await load(page(5), { storage: { curso_flutter_progress: '{"5":[2]}' } });
  const boxes = doc.querySelectorAll('#detailed-codelab .lab-step input[type=checkbox]');
  assert.equal(boxes[1].checked, true);
  win.localStorage.setItem('curso_flutter_progress', '{"5":[1]}');
  win.dispatchEvent(new win.StorageEvent('storage', { key: 'curso_flutter_progress' }));
  assert.equal(boxes[0].checked, true);
  assert.equal(boxes[1].checked, false);
  dom.window.close();
});

test('la píldora lista los pasos y se abre con el botón', async () => {
  const { dom, doc, win } = await load(page(5));
  const pill = doc.querySelector('.step-pill');
  assert.ok(pill, 'falta la píldora');
  const steps = doc.querySelectorAll('#detailed-codelab .lab-step');
  const links = pill.querySelectorAll('a[href^="#paso-"]');
  assert.equal(links.length, steps.length);
  const toggle = pill.querySelector('button');
  assert.match(toggle.textContent, new RegExp(`Paso 0 · 1/${steps.length}`));
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  win.dispatchEvent(new win.CustomEvent('codelabstep', { detail: { session: 5, step: 3 } }));
  assert.match(toggle.textContent, /Paso 2 · 3\//);
  assert.match(links[2].textContent, /^2/);
  assert.equal(links[2].getAttribute('aria-current'), 'step');
  doc.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(doc.activeElement, toggle);
  dom.window.close();
});

test('index.html no muestra la píldora pero sí la barra de lectura y volver arriba', async () => {
  const { dom, doc } = await load('index.html');
  assert.equal(doc.querySelector('.step-pill'), null);
  assert.ok(doc.querySelector('.reading-progress[aria-hidden="true"] span'));
  const top = doc.querySelector('.back-to-top');
  assert.equal(top.getAttribute('aria-label'), 'Volver arriba');
  dom.window.close();
});

const key = (win, target, init) => target.dispatchEvent(new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

test('busca sin acentos ni mayúsculas', async () => {
  for (const name of ['index.html', 'codelab-05.html']) {
    const { dom, api } = await load(name);
    const numbers = (q) => Array.from(api.searchSessions(q), (s) => s.number);
    assert.ok(numbers('navegacion').includes(4), name);
    assert.ok(numbers('APK').includes(16), name);
    assert.deepEqual(numbers('zzz'), []);
    assert.equal(numbers('').length, 16);
    assert.deepEqual(numbers('busqueda filtros'), [14]);
    assert.equal(api.normalize('Sesión ÁRBOL'), 'sesion arbol');
    dom.window.close();
  }
});

test('el paginador respeta los límites', async () => {
  const first = await load(page(1));
  assert.equal(first.doc.querySelector('.session-pager a[rel="prev"]'), null);
  assert.equal(first.doc.querySelector('.session-pager a[rel="next"]').getAttribute('href'), 'sesion-02.html');
  first.dom.window.close();
  const last = await load(page(16));
  assert.equal(last.doc.querySelector('.session-pager a[rel="next"]'), null);
  assert.equal(last.doc.querySelector('.session-pager a[rel="prev"]').getAttribute('href'), 'sesion-15.html');
  last.dom.window.close();
});

test('las flechas cambian de sesión salvo mientras se escribe', async () => {
  const { dom, doc, win, navigated } = await load(page(7));
  key(win, doc.body, { key: 'ArrowRight' });
  assert.deepEqual(navigated, ['sesion-08.html']);
  key(win, doc.body, { key: 'ArrowLeft', altKey: true });
  assert.equal(navigated.length, 1);
  key(win, doc.body, { key: '/' });
  const input = doc.querySelector('.search-palette input[type=search]');
  assert.equal(doc.activeElement, input);
  key(win, input, { key: '/' });
  key(win, input, { key: 'ArrowRight' });
  assert.equal(doc.querySelectorAll('.search-palette').length, 1);
  assert.deepEqual(navigated, ['sesion-08.html']);
  dom.window.close();
});

test('la búsqueda abre el resultado con Enter y se cierra con Escape', async () => {
  const { dom, doc, win, navigated } = await load('index.html');
  doc.querySelector('.search-open').click();
  const palette = doc.querySelector('.search-palette');
  assert.equal(palette.getAttribute('role'), 'dialog');
  assert.equal(palette.getAttribute('aria-modal'), 'true');
  const input = palette.querySelector('input[type=search]');
  input.value = 'filtros';
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  const options = palette.querySelectorAll('[role="option"]');
  assert.equal(options.length, 1);
  assert.equal(options[0].getAttribute('aria-selected'), 'true');
  key(win, input, { key: 'Enter' });
  assert.deepEqual(navigated, ['sesion-14.html']);
  doc.querySelector('.search-open').click();
  key(win, doc.querySelector('.search-palette input'), { key: 'Escape' });
  assert.equal(doc.querySelector('.search-palette').hidden, true);
  assert.equal(doc.activeElement, doc.querySelector('.search-open'));
  dom.window.close();
});

test('el botón de búsqueda aparece también en los codelabs independientes', async () => {
  const { dom, doc } = await load('codelab-09.html');
  const button = doc.querySelector('.search-open');
  assert.ok(button);
  assert.equal(button.nextElementSibling, doc.querySelector('.theme-toggle'));
  dom.window.close();
});

test('muestra Continuar cuando hay una posición guardada', async () => {
  const saved = await load('index.html', { storage: { curso_flutter_last: '{"session":7,"step":5,"ts":1}' } });
  const link = saved.doc.querySelector('.resume-banner a');
  assert.equal(link.getAttribute('href'), 'sesion-07.html#paso-5');
  assert.match(saved.doc.querySelector('.resume-banner').textContent, /Sesión 7 · paso 5/);
  saved.dom.window.close();
  const labelled = await load('index.html', { storage: { curso_flutter_last: '{"session":10,"step":6,"label":"4","ts":1}' } });
  assert.match(labelled.doc.querySelector('.resume-banner').textContent, /Sesión 10 · paso 4/);
  assert.equal(labelled.doc.querySelector('.resume-banner a').getAttribute('href'), 'sesion-10.html#paso-6');
  labelled.dom.window.close();
  const empty = await load('codelabs.html');
  assert.equal(empty.doc.querySelector('.resume-banner'), null);
  empty.dom.window.close();
});

test('al abrir sesion-07.html#paso-3 se desplaza al paso tras la carga asíncrona', async () => {
  const { dom, scrolled } = await load(page(7), { hash: '#paso-3' });
  assert.ok(scrolled.includes('paso-3'));
  dom.window.close();
});

test('beforeprint abre los details y afterprint restaura su estado', async () => {
  const { dom, doc, win } = await load('codelab-05.html');
  const details = Array.from(doc.querySelectorAll('details'));
  assert.ok(details.length > 0);
  details.forEach((d, i) => { d.open = i > 0; });
  const before = details.map((d) => d.open);
  assert.equal(before[0], false);
  win.dispatchEvent(new win.Event('beforeprint'));
  assert.ok(details.every((d) => d.open));
  win.dispatchEvent(new win.Event('afterprint'));
  assert.deepEqual(details.map((d) => d.open), before);
  dom.window.close();
});

test('la búsqueda tiene un botón Cerrar para pantallas táctiles', async () => {
  const { dom, doc } = await load('index.html');
  doc.querySelector('.search-open').click();
  const close = doc.querySelector('.search-palette button.search-close');
  assert.ok(close, 'falta el botón Cerrar');
  assert.equal(close.textContent.trim(), 'Cerrar');
  close.click();
  assert.equal(doc.querySelector('.search-palette').hidden, true);
  dom.window.close();
});

test('las flechas no cambian de sesión con el foco en código, botones o enlaces', async () => {
  const { dom, doc, win, navigated } = await load(page(7));
  const pre = doc.querySelector('#detailed-codelab pre');
  // syntax.js se inyecta de forma dinámica y jsdom no lo ejecuta: se reproduce su botón Copiar.
  const copy = doc.querySelector('#detailed-codelab .code-copy') || pre.appendChild(Object.assign(doc.createElement('button'), { className: 'code-copy', textContent: 'Copiar' }));
  pre.tabIndex = 0;
  const pillLink = doc.querySelector('.step-pill a');
  for (const target of [copy, pre, pillLink, doc.querySelector('.search-open')]) {
    target.focus();
    key(win, target, { key: 'ArrowRight' });
    key(win, target, { key: 'ArrowLeft' });
  }
  assert.deepEqual(navigated, []);
  doc.activeElement.blur();
  key(win, doc.body, { key: 'ArrowLeft' });
  assert.deepEqual(navigated, ['sesion-06.html']);
  dom.window.close();
});

test('el paso actual se calcula desde la posición de scroll', async () => {
  const { dom, api } = await load('index.html');
  // tops de cada paso relativos al viewport; la línea de lectura está al 40 % de 1000 px
  assert.equal(api.currentStepIndex([-900, -300, 200, 900], 1000), 2);
  assert.equal(api.currentStepIndex([500, 900], 1000), 0);
  assert.equal(api.currentStepIndex([-3000, -2000, -1000], 1000), 2);
  assert.equal(api.currentStepIndex([], 1000), -1);
  dom.window.close();
});

test('los controles flotantes aparecen al llegar a los pasos y se ocultan al bajar si taparían el contenido', async () => {
  const { dom, api } = await load('index.html');
  const show = api.floatingVisible;
  assert.equal(show({ firstStepTop: 1200, viewport: 800, direction: 'none', crowded: false }), false);
  // crowded: los controles taparían el contenido (móvil o ventanas de escritorio estrechas)
  assert.equal(show({ firstStepTop: 300, viewport: 800, direction: 'down', crowded: false }), true);
  assert.equal(show({ firstStepTop: 300, viewport: 800, direction: 'down', crowded: true }), false);
  assert.equal(show({ firstStepTop: 300, viewport: 800, direction: 'up', crowded: true }), true);
  assert.equal(show({ firstStepTop: null, viewport: 800, direction: 'none', crowded: true }), true);
  dom.window.close();
});

test('en las sesiones el menú lateral se puede plegar y empieza plegado', async () => {
  const { dom, doc } = await load(page(5));
  const sidebar = doc.querySelector('.codelab-sidebar');
  const toggle = sidebar.querySelector('button.sidebar-toggle');
  assert.ok(toggle, 'falta el botón para plegar el menú');
  assert.match(toggle.textContent, /Sesión 5 de 16/);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), sidebar.querySelector('.codelab-sidebar-menu').id);
  assert.equal(sidebar.classList.contains('is-open'), false);
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(sidebar.classList.contains('is-open'));
  dom.window.close();
  const index = await load('codelabs.html');
  assert.equal(index.doc.querySelector('button.sidebar-toggle'), null);
  index.dom.window.close();
});

test('codelabs.html no repite ids aunque tenga varios codelabs', async () => {
  const { dom, doc } = await load('codelabs.html');
  const ids = Array.from(doc.querySelectorAll('[id]'), (el) => el.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  assert.equal(doc.querySelector('#codelab-2 .lab-step').id, 'codelab-2-paso-1');
  dom.window.close();
});

test('los codelabs independientes enlazan al índice y a su vista de sesión', async () => {
  const { dom, doc } = await load('codelab-09.html');
  const bar = doc.querySelector('.theme-toolbar');
  assert.ok(bar.querySelector('a[href="codelabs.html"]'), 'falta el enlace al índice');
  const session = bar.querySelector('a[href="sesion-09.html"]');
  assert.ok(session, 'falta el enlace a la vista de sesión');
  assert.match(session.textContent, /sesión 9/i);
  dom.window.close();
});

test('el check general marca y desmarca todos los pasos de la sesión', async () => {
  const { dom, doc } = await load(page(5));
  const all = doc.querySelector('#detailed-codelab .steps-all input[type=checkbox]');
  assert.ok(all, 'falta el check general');
  assert.equal(all.getAttribute('aria-label'), 'Marcar todos los pasos de la sesión 5');
  const boxes = () => Array.from(doc.querySelectorAll('#detailed-codelab .step-done input'));
  all.click();
  assert.ok(boxes().every((b) => b.checked));
  assert.match(doc.querySelector('#detailed-codelab .step-progress-text').textContent, new RegExp(`^${boxes().length}/${boxes().length}`));
  assert.ok(doc.querySelector('.sidebar-week a[href="sesion-05.html"]').classList.contains('is-complete'));
  assert.equal(all.checked, true);
  assert.match(doc.querySelector('#detailed-codelab .steps-all').textContent, /Desmarcar todos/);
  all.click();
  assert.ok(boxes().every((b) => !b.checked));
  assert.equal(all.checked, false);
  assert.match(doc.querySelector('#detailed-codelab .steps-all').textContent, /Marcar todos/);
  dom.window.close();
});

test('el check general queda a medias con progreso parcial', async () => {
  const { dom, doc } = await load(page(5), { storage: { curso_flutter_progress: '{"5":[2]}' } });
  const all = doc.querySelector('#detailed-codelab .steps-all input');
  assert.equal(all.indeterminate, true);
  assert.equal(all.checked, false);
  all.click(); // desde a medias, completa todo
  assert.ok(Array.from(doc.querySelectorAll('#detailed-codelab .step-done input')).every((b) => b.checked));
  assert.equal(all.indeterminate, false);
  dom.window.close();
});

test('en codelabs.html cada check general afecta sólo a su codelab', async () => {
  const { dom, doc } = await load('codelabs.html');
  doc.querySelector('#codelab-2 .steps-all input').click();
  assert.ok(Array.from(doc.querySelectorAll('#codelab-2 .step-done input')).every((b) => b.checked));
  assert.ok(Array.from(doc.querySelectorAll('#codelab-1 .step-done input')).every((b) => !b.checked));
  dom.window.close();
});

test('los controles flotantes empiezan ocultos si los pasos aún no están en pantalla', async () => {
  const { dom, doc } = await load(page(5), { stepTop: 2000 });
  assert.ok(doc.querySelector('.floating-stack').classList.contains('is-hidden'));
  dom.window.close();
});

test('la visibilidad de los controles se recalcula al terminar de cargar la página', async () => {
  // Simula que, antes de cargar fuentes, el primer paso estaba arriba y luego baja.
  const { dom, doc, win } = await load(page(5), { stepTop: 100 });
  assert.equal(doc.querySelector('.floating-stack').classList.contains('is-hidden'), false);
  const original = win.Element.prototype.getBoundingClientRect;
  win.Element.prototype.getBoundingClientRect = function () {
    if (this.classList?.contains('lab-step')) return { top: 2000, bottom: 2300, left: 0, right: 300, width: 300, height: 300 };
    return original.call(this);
  };
  win.dispatchEvent(new win.Event('load'));
  assert.ok(doc.querySelector('.floating-stack').classList.contains('is-hidden'));
  dom.window.close();
});

test('los atajos funcionan con el foco en las casillas de progreso', async () => {
  const { dom, doc, win, navigated } = await load(page(7));
  const box = doc.querySelector('#detailed-codelab .step-done input');
  box.focus();
  key(win, box, { key: 'ArrowRight' });
  assert.deepEqual(navigated, ['sesion-08.html']);
  const all = doc.querySelector('#detailed-codelab .steps-all input');
  all.focus();
  key(win, all, { key: '/' });
  const palette = doc.querySelector('.search-palette');
  assert.ok(palette && !palette.hidden, 'la búsqueda no se abrió con el foco en «Marcar todos»');
  dom.window.close();
});

test('el aviso Continuar se actualiza al cambiar la posición o al volver atrás', async () => {
  const { dom, doc, win } = await load('index.html', { storage: { curso_flutter_last: '{"session":3,"step":2,"label":"1","ts":1}' } });
  assert.match(doc.querySelector('.resume-banner strong').textContent, /Sesión 3 · paso 1/);
  win.localStorage.setItem('curso_flutter_last', '{"session":7,"step":6,"label":"5","ts":2}');
  win.dispatchEvent(new win.StorageEvent('storage', { key: 'curso_flutter_last' }));
  assert.match(doc.querySelector('.resume-banner strong').textContent, /Sesión 7 · paso 5/);
  assert.equal(doc.querySelector('.resume-banner a').getAttribute('href'), 'sesion-07.html#paso-6');
  assert.equal(doc.querySelectorAll('.resume-banner').length, 1);
  // Restaurada desde la caché de ida y vuelta, sin evento storage.
  win.localStorage.setItem('curso_flutter_last', '{"session":9,"step":1,"label":"0","ts":3}');
  const restored = new win.Event('pageshow');
  Object.defineProperty(restored, 'persisted', { value: true });
  win.dispatchEvent(restored);
  assert.match(doc.querySelector('.resume-banner strong').textContent, /Sesión 9 · paso 0/);
  win.localStorage.removeItem('curso_flutter_last');
  win.dispatchEvent(new win.StorageEvent('storage', { key: 'curso_flutter_last' }));
  assert.equal(doc.querySelector('.resume-banner'), null);
  dom.window.close();
});

test('el scroll se procesa aunque el navegador no ejecute requestAnimationFrame', async () => {
  const { dom, doc, win } = await load(page(5), { stepTop: 100 });
  win.requestAnimationFrame = () => 0; // dibujado congelado (pestaña en segundo plano, ahorro de energía)
  const original = win.Element.prototype.getBoundingClientRect;
  win.Element.prototype.getBoundingClientRect = function () {
    if (this.classList?.contains('lab-step')) return { top: 2000, bottom: 2300, left: 0, right: 300, width: 300, height: 300 };
    return original.call(this);
  };
  win.dispatchEvent(new win.Event('scroll'));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.ok(doc.querySelector('.floating-stack').classList.contains('is-hidden'));
  dom.window.close();
});
