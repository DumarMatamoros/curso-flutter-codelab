const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Reproduce el orden real del navegador: scripts del documento y, al final, los diferidos.
async function load(name, { storage = {}, storageBlocked = false, scripts, hash = '' } = {}) {
  const dom = new JSDOM(read(name), { url: `https://example.test/curso/${name}${hash}`, runScripts: 'outside-only' });
  const win = dom.window;
  const scrolled = [];
  win.Element.prototype.scrollIntoView = function () { scrolled.push(this.id); };
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
  assert.equal(boxes[0].getAttribute('aria-label'), 'Marcar paso 1 como hecho');
  boxes[0].click();
  assert.match(doc.querySelector('.step-progress').textContent, new RegExp(`1/${steps.length}`));
  assert.ok(steps[0].classList.contains('is-done'));
  assert.ok(doc.querySelector('.sidebar-week a[href="sesion-07.html"]').classList.contains('is-started'));
  assert.deepEqual({ ...JSON.parse(win.localStorage.getItem('curso_flutter_last')), ts: 0 }, { session: 7, step: 1, ts: 0 });
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
  assert.match(toggle.textContent, new RegExp(`Paso 1 de ${steps.length}`));
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  win.dispatchEvent(new win.CustomEvent('codelabstep', { detail: { session: 5, step: 3 } }));
  assert.match(toggle.textContent, /Paso 3 de/);
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
  const empty = await load('codelabs.html');
  assert.equal(empty.doc.querySelector('.resume-banner'), null);
  empty.dom.window.close();
});

test('al abrir sesion-07.html#paso-3 se desplaza al paso tras la carga asíncrona', async () => {
  const { dom, scrolled } = await load(page(7), { hash: '#paso-3' });
  assert.ok(scrolled.includes('paso-3'));
  dom.window.close();
});
