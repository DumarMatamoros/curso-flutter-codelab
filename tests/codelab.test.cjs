const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function openPage(name, { saved = null, systemDark = false, storageBlocked = false } = {}) {
  const dom = new JSDOM(read(name), { url: `https://example.test/curso/${name}`, runScripts: 'outside-only' });
  const win = dom.window;
  const media = new win.EventTarget();
  media.matches = systemDark;
  win.matchMedia = () => media;
  if (saved) win.localStorage.setItem('curso_flutter_theme', saved);
  if (storageBlocked) Object.defineProperty(win, 'localStorage', { get() { throw new Error('Storage bloqueado'); } });
  win.eval(read('theme.js'));
  win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  return { dom, win, media };
}

function systemChange(win, media, dark) {
  media.matches = dark;
  const event = new win.Event('change');
  event.matches = dark;
  media.dispatchEvent(event);
}

test('todas las páginas incluyen un control de tema visible fuera del menú ocultable', () => {
  for (const name of fs.readdirSync(root).filter((name) => name.endsWith('.html'))) {
    const { dom, win } = openPage(name);
    const buttons = win.document.querySelectorAll('.theme-toggle');
    assert.equal(buttons.length, 1, name);
    assert.equal(buttons[0].closest('.nav-links'), null, name);
    assert.equal(buttons[0].getAttribute('aria-label'), 'Cambiar a modo oscuro', name);
    buttons[0].click();
    assert.equal(win.document.documentElement.dataset.theme, 'dark', name);
    assert.equal(buttons[0].getAttribute('aria-pressed'), 'true', name);
    assert.equal(win.localStorage.getItem('curso_flutter_theme'), 'dark', name);
    buttons[0].click();
    assert.equal(win.document.documentElement.dataset.theme, 'light', name);
    dom.window.close();
  }
});

test('recuerda la elección y sigue los cambios sucesivos del sistema hasta elegir', () => {
  const { dom, win, media } = openPage('index.html');
  systemChange(win, media, true);
  assert.equal(win.CursoFlutterTheme.get(), 'dark');
  assert.equal(win.localStorage.getItem('curso_flutter_theme'), null);
  systemChange(win, media, false);
  assert.equal(win.CursoFlutterTheme.get(), 'light');
  win.CursoFlutterTheme.set('dark');
  systemChange(win, media, false);
  assert.equal(win.CursoFlutterTheme.get(), 'dark');
  win.CursoFlutterTheme.set('invalid');
  assert.equal(win.CursoFlutterTheme.get(), 'dark');
  dom.window.close();
  const restored = openPage('sesion-16.html', { saved: 'dark' });
  assert.equal(restored.win.CursoFlutterTheme.get(), 'dark');
  restored.dom.window.close();
});

test('funciona sin almacenamiento y sincroniza las preferencias entre pestañas', () => {
  const blocked = openPage('index.html', { storageBlocked: true, systemDark: true });
  blocked.win.document.querySelector('.theme-toggle').click();
  assert.equal(blocked.win.CursoFlutterTheme.get(), 'light');
  systemChange(blocked.win, blocked.media, true);
  assert.equal(blocked.win.CursoFlutterTheme.get(), 'light');
  blocked.dom.window.close();
  const { dom, win } = openPage('index.html');
  win.dispatchEvent(new win.StorageEvent('storage', { key: 'curso_flutter_theme', newValue: 'dark' }));
  assert.equal(win.CursoFlutterTheme.get(), 'dark');
  win.dispatchEvent(new win.StorageEvent('storage', { key: 'curso_flutter_theme', newValue: null }));
  assert.equal(win.CursoFlutterTheme.get(), 'light');
  dom.window.close();
});

test('las 16 sesiones muestran el laboratorio completo y conservan cada bloque de código', async () => {
  for (let n = 1; n <= 16; n++) {
    const { dom, win } = openPage(`sesion-${String(n).padStart(2, '0')}.html`);
    win.eval(read('app.js'));
    assert.equal(win.courseWeeks.length, 8);
    assert.equal(win.courseWeeks.flatMap((w) => w.sessions).length, 16);
    let requested;
    win.fetch = async (url) => {
      requested = url;
      return { ok: true, text: async () => read(url) };
    };
    win.eval(read('syntax.js'));
    win.eval(read('session-page.js'));
    await new Promise((resolve) => setImmediate(resolve));
    const sourceName = n <= 4 ? 'codelabs.html' : `codelab-${String(n).padStart(2, '0')}.html`;
    assert.equal(requested, sourceName);
    const source = new JSDOM(read(sourceName));
    const expected = source.window.document.querySelector(`#codelab-${n}`);
    const actual = win.document.querySelector(`#detailed-codelab #codelab-${n}`);
    assert.ok(actual, `Sesión ${n}: falta laboratorio`);
    assert.equal(actual.hasAttribute('hidden'), false);
    assert.equal(actual.querySelectorAll('.lab-step').length, expected.querySelectorAll('.lab-step').length);
    const blocks = Array.from(actual.querySelectorAll('pre code'));
    assert.deepEqual(blocks.map((b) => b.textContent), Array.from(expected.querySelectorAll('pre code'), (b) => b.textContent));
    assert.equal(actual.querySelectorAll('.code-copy').length, blocks.length);
    if (blocks.length) {
      let copied;
      Object.defineProperty(win.navigator, 'clipboard', { value: { writeText: async (text) => { copied = text; } } });
      actual.querySelector('.code-copy').click();
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(copied, blocks[0].textContent, `Sesión ${n}: copiar conserva el código exacto`);
    }
    assert.equal(win.document.querySelectorAll('.sidebar-week a').length, 16);
    assert.ok(win.document.querySelector(`[aria-current="page"][href="sesion-${String(n).padStart(2, '0')}.html"]`));
    assert.doesNotMatch(win.document.querySelector('#detailed-codelab').textContent, /Cargando el codelab/);
    source.window.close();
    dom.window.close();
  }
});

test('todos los enlaces y recursos locales apuntan a archivos y anclas existentes', () => {
  for (const name of fs.readdirSync(root).filter((name) => name.endsWith('.html'))) {
    const dom = new JSDOM(read(name));
    for (const el of dom.window.document.querySelectorAll('[href], [src]')) {
      const link = el.getAttribute('href') || el.getAttribute('src');
      if (!link || /^(?:https?:|mailto:|data:)/.test(link)) continue;
      const [file, anchor] = link.split('#');
      const target = file || name;
      assert.ok(fs.existsSync(path.join(root, target)), `${name}: ${link}`);
      if (anchor && target.endsWith('.html')) {
        const dest = new JSDOM(read(target));
        assert.ok(dest.window.document.getElementById(anchor), `${name}: ${link}`);
        dest.window.close();
      }
    }
    dom.window.close();
  }
});

test('las ocho semanas muestran sus dos sesiones y permiten desplegarlas', () => {
  const { dom, win } = openPage('index.html');
  win.eval(read('app.js'));
  const tabs = win.document.querySelectorAll('.week-tab');
  assert.equal(tabs.length, 8);
  tabs.forEach((tab, index) => {
    tab.click();
    assert.equal(tab.getAttribute('aria-selected'), 'true');
    const sessions = win.document.querySelectorAll('#week-content .session');
    assert.equal(sessions.length, 2);
    assert.ok(sessions[0].textContent.includes(`SESIÓN ${index * 2 + 1}`));
    assert.ok(sessions[1].textContent.includes(`SESIÓN ${index * 2 + 2}`));
    const toggle = sessions[1].querySelector('.session-toggle');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  });
  dom.window.close();
});
