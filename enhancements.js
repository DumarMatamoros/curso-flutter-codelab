// enhancements.js - Mejoras de experiencia del codelab, sin modificar los archivos originales.
// Progreso por paso, última posición, navegación, búsqueda e impresión.
// Todo degrada en silencio: sin almacenamiento o sin APIs modernas la página queda como el original.
(function () {
  'use strict';

  const PROGRESS_KEY = 'curso_flutter_progress';
  const LAST_KEY = 'curso_flutter_last';
  const api = (window.CursoFlutterEnhancements = window.CursoFlutterEnhancements || {});

  // ---------- Almacenamiento ----------
  function readJson(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* almacenamiento no disponible: la sesión sigue funcionando sin persistencia */
    }
  }

  // Memoria de respaldo para que las casillas funcionen aunque no haya almacenamiento.
  let memoryProgress = {};

  function readProgress() {
    const data = readJson(PROGRESS_KEY);
    const source = data && typeof data === 'object' && !Array.isArray(data) ? data : memoryProgress;
    const clean = {};
    Object.keys(source).forEach((session) => {
      if (!/^\d+$/.test(session) || !Array.isArray(source[session])) return;
      const steps = source[session].filter((step) => Number.isInteger(step) && step > 0);
      if (steps.length) clean[session] = Array.from(new Set(steps)).sort((a, b) => a - b);
    });
    return clean;
  }

  function setStepDone(session, step, done) {
    const progress = readProgress();
    const key = String(session);
    const steps = new Set(progress[key] || []);
    if (done) steps.add(step); else steps.delete(step);
    if (steps.size) progress[key] = Array.from(steps).sort((a, b) => a - b);
    else delete progress[key];
    memoryProgress = progress;
    writeJson(PROGRESS_KEY, progress);
    window.dispatchEvent(new CustomEvent('codelabprogress', { detail: { session } }));
  }

  function sessionProgress(session, total) {
    const done = (readProgress()[String(session)] || []).filter((step) => step <= total).length;
    return { done, total, complete: total > 0 && done === total };
  }

  function readLast() {
    const data = readJson(LAST_KEY);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const { session, step, ts } = data;
    if (!Number.isInteger(session) || session < 1 || session > 16 || !Number.isInteger(step) || step < 1) return null;
    return { session, step, ts: Number(ts) || 0 };
  }

  function rememberPosition(session, step) {
    writeJson(LAST_KEY, { session, step, ts: Date.now() });
  }

  // ---------- Codelabs ----------
  const pad = (n) => String(n).padStart(2, '0');

  // Las páginas sesion-XX y codelab-NN muestran un único codelab: allí se registra la posición.
  function isSingleCodelabPage() {
    return /(?:sesion|codelab)-\d{2}\.html$/.test(window.location.pathname);
  }

  function sessionOf(section) {
    const match = /^codelab-(\d+)$/.exec(section.id || '');
    return match ? Number(match[1]) : null;
  }

  function stepsOf(section) {
    return Array.from(section.querySelectorAll('.lab-step'));
  }

  function refreshSection(section) {
    const session = sessionOf(section);
    const steps = stepsOf(section);
    const done = new Set(readProgress()[String(session)] || []);
    steps.forEach((step, index) => {
      const isDone = done.has(index + 1);
      step.classList.toggle('is-done', isDone);
      const box = step.querySelector('.step-done input');
      if (box) box.checked = isDone;
    });
    const status = sessionProgress(session, steps.length);
    const counter = section.querySelector('.step-progress');
    if (counter) {
      counter.querySelector('.step-progress-text').textContent = `${status.done}/${status.total} pasos`;
      const bar = counter.querySelector('progress');
      bar.max = status.total;
      bar.value = status.done;
      counter.classList.toggle('is-complete', status.complete);
    }
  }

  function enhanceCodelab(section) {
    if (section.dataset.enhanced === 'true') return;
    const session = sessionOf(section);
    const steps = stepsOf(section);
    if (!session || !steps.length) return;
    section.dataset.enhanced = 'true';
    section.dataset.totalSteps = String(steps.length);

    steps.forEach((step, index) => {
      const number = index + 1;
      if (!step.id) step.id = `paso-${number}`;
      const label = document.createElement('label');
      label.className = 'step-done';
      label.innerHTML = '<input type="checkbox"><span>Hecho</span>';
      const box = label.querySelector('input');
      box.setAttribute('aria-label', `Marcar paso ${number} como hecho`);
      box.addEventListener('change', () => {
        setStepDone(session, number, box.checked);
        if (isSingleCodelabPage()) rememberPosition(session, number);
      });
      const content = step.querySelector('.step-number + *') || step;
      content.prepend(label);
    });

    const counter = document.createElement('div');
    counter.className = 'step-progress';
    counter.setAttribute('role', 'status');
    counter.innerHTML = '<span class="step-progress-text"></span><progress aria-label="Progreso del codelab"></progress>';
    const title = section.querySelector('.codelab-title');
    if (title) title.after(counter); else section.prepend(counter);

    refreshSection(section);
    observeSteps(section, session);
    window.dispatchEvent(new CustomEvent('codelabenhanced', { detail: { session, section } }));
  }

  // Recuerda el paso más visible mientras se lee (sólo con IntersectionObserver).
  function observeSteps(section, session) {
    if (!isSingleCodelabPage() || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const number = stepsOf(section).indexOf(entry.target) + 1;
        if (number > 0) {
          rememberPosition(session, number);
          window.dispatchEvent(new CustomEvent('codelabstep', { detail: { session, step: number } }));
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    stepsOf(section).forEach((step) => observer.observe(step));
  }

  function refreshSidebar() {
    const progress = readProgress();
    document.querySelectorAll('.sidebar-week a').forEach((link) => {
      const match = /sesion-(\d+)\.html$/.exec(link.getAttribute('href') || '');
      if (!match) return;
      const session = Number(match[1]);
      const section = document.getElementById(`codelab-${session}`);
      const total = Number(section?.dataset.totalSteps) || storedTotal(session);
      const done = (progress[String(session)] || []).length;
      const complete = total > 0 && done >= total;
      link.classList.toggle('is-complete', complete);
      link.classList.toggle('is-started', done > 0 && !complete);
    });
  }

  // Guarda el total de pasos de cada sesión vista, para marcar el menú en otras páginas.
  function storedTotal(session) {
    const totals = readJson('curso_flutter_totals');
    return totals && Number.isInteger(totals[session]) ? totals[session] : 0;
  }

  function rememberTotal(session, total) {
    const totals = readJson('curso_flutter_totals') || {};
    if (totals[session] === total) return;
    totals[session] = total;
    writeJson('curso_flutter_totals', totals);
  }

  function enhanceAll(scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    const sections = [];
    if (root.id && sessionOf(root)) sections.push(root);
    root.querySelectorAll('[id^="codelab-"]').forEach((el) => sections.push(el));
    sections.forEach((section) => {
      enhanceCodelab(section);
      if (section.dataset.enhanced === 'true') rememberTotal(sessionOf(section), Number(section.dataset.totalSteps));
    });
    refreshSidebar();
  }

  function refreshAll() {
    document.querySelectorAll('[data-enhanced="true"]').forEach(refreshSection);
    refreshSidebar();
  }

  window.addEventListener('codelabprogress', refreshAll);
  window.addEventListener('storage', (event) => {
    if (event.key === PROGRESS_KEY || event.key === null) {
      memoryProgress = {};
      refreshAll();
    }
  });

  // ---------- Lectura: barra de progreso, volver arriba y píldora de pasos ----------
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior = () => (reduceMotion() ? 'auto' : 'smooth');

  function buildReadingAids() {
    const bar = document.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span></span>';
    document.body.prepend(bar);

    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'back-to-top floating-control';
    top.setAttribute('aria-label', 'Volver arriba');
    top.title = 'Volver arriba';
    top.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: scrollBehavior() }));
    floatingStack().append(top);

    let scheduled = false;
    const update = () => {
      scheduled = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.firstChild.style.transform = `scaleX(${ratio})`;
      top.classList.toggle('is-visible', window.scrollY > 600);
    };
    window.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      (window.requestAnimationFrame || window.setTimeout)(update);
    }, { passive: true });
    update();
  }

  function floatingStack() {
    let stack = document.querySelector('.floating-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'floating-stack';
      document.body.append(stack);
    }
    return stack;
  }

  function buildStepPill(section, session) {
    if (!isSingleCodelabPage() || document.querySelector('.step-pill')) return;
    const steps = stepsOf(section);
    const nav = document.createElement('nav');
    nav.className = 'step-pill';
    nav.setAttribute('aria-label', 'Pasos del codelab');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'step-pill-toggle floating-control';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'step-pill-list');
    const list = document.createElement('ol');
    list.id = 'step-pill-list';
    list.className = 'step-pill-list';
    list.hidden = true;
    steps.forEach((step, index) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${step.id}`;
      const heading = step.querySelector('h3');
      link.textContent = heading ? heading.textContent.trim() : `Paso ${index + 1}`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        close(false);
        step.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        step.querySelector('h3')?.setAttribute('tabindex', '-1');
        step.querySelector('h3')?.focus({ preventScroll: true });
        setCurrent(index + 1);
      });
      item.append(link);
      list.append(item);
    });
    nav.append(list, toggle);

    function setCurrent(number) {
      toggle.innerHTML = `<span class="step-pill-label">Paso ${number} de ${steps.length}</span><span aria-hidden="true">▴</span>`;
      list.querySelectorAll('a').forEach((link, index) => {
        if (index + 1 === number) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      });
    }
    function open() {
      list.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      (list.querySelector('[aria-current]') || list.querySelector('a'))?.focus();
    }
    function close(returnFocus = true) {
      list.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus();
    }
    toggle.addEventListener('click', () => (list.hidden ? open() : close()));
    nav.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !list.hidden) {
        event.stopPropagation();
        close();
      }
    });
    document.addEventListener('click', (event) => {
      if (!list.hidden && !nav.contains(event.target)) close(false);
    });
    window.addEventListener('codelabstep', (event) => {
      if (event.detail.session === session) setCurrent(event.detail.step);
    });

    const hash = /^#paso-(\d+)$/.exec(window.location.hash);
    setCurrent(hash ? Math.min(Number(hash[1]), steps.length) : 1);
    floatingStack().prepend(nav);
  }

  window.addEventListener('codelabenhanced', (event) => buildStepPill(event.detail.section, event.detail.session));

  function init() {
    buildReadingAids();
    enhanceAll(document);
    // session-page.js inserta el codelab de forma asíncrona: se mejora cuando aparece.
    if ('MutationObserver' in window) {
      new MutationObserver((mutations) => {
        mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) enhanceAll(node);
        }));
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  Object.assign(api, {
    readProgress,
    setStepDone,
    sessionProgress,
    readLast,
    rememberPosition,
    enhanceCodelab,
    pad
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
