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
    const { session, step, label, ts } = data;
    if (!Number.isInteger(session) || session < 1 || session > 16 || !Number.isInteger(step) || step < 1) return null;
    const last = { session, step, ts: Number(ts) || 0 };
    if (typeof label === 'string' && /^[\w-]{1,6}$/.test(label)) last.label = label;
    return last;
  }

  // step es la posición (1..n, coincide con #paso-N); label es el número impreso en el paso,
  // que en el curso empieza en 0 y puede repetirse o llevar letras ("4A").
  function rememberPosition(session, step, label) {
    const record = { session, step, ts: Date.now() };
    if (label !== undefined) record.label = String(label);
    writeJson(LAST_KEY, record);
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

  function stepLabel(step, index) {
    const printed = step.querySelector('.step-number')?.textContent.trim();
    return printed || String(index + 1);
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
      box.setAttribute('aria-label', `Marcar paso ${stepLabel(step, index)} como hecho`);
      box.addEventListener('change', () => {
        setStepDone(session, number, box.checked);
        if (isSingleCodelabPage()) rememberPosition(session, number, stepLabel(step, index));
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
          rememberPosition(session, number, stepLabel(entry.target, number - 1));
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
      const num = document.createElement('span');
      num.className = 'step-pill-num';
      num.textContent = stepLabel(step, index);
      link.append(num, document.createTextNode(heading ? heading.textContent.trim() : `Paso ${index + 1}`));
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
      const label = stepLabel(steps[number - 1], number - 1);
      toggle.innerHTML = `<span class="step-pill-label">Paso ${label} · ${number}/${steps.length}</span><span aria-hidden="true">▴</span>`;
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

  // ---------- Sesiones, búsqueda y navegación ----------
  // Respaldo para páginas que no cargan app.js; window.courseWeeks es la fuente de verdad.
  const FALLBACK_SESSIONS = [
    [1, 1, 'Introducción a Flutter, Dart y el entorno'],
    [2, 1, 'Widgets, estado e interfaces básicas'],
    [3, 2, 'Layouts, listas y componentes reutilizables'],
    [4, 2, 'Navegación y comunicación entre pantallas'],
    [5, 3, 'Especificación del proyecto y modelado de datos'],
    [6, 3, 'Arquitectura MVVM y estructura por funcionalidades'],
    [7, 4, 'HTTP, asincronía, JSON y modelos'],
    [8, 4, 'Repository, ViewModel y estados asíncronos'],
    [9, 5, 'Formularios y validación de datos'],
    [10, 5, 'POST, PATCH/PUT y DELETE'],
    [11, 6, 'Errores, excepciones y resiliencia'],
    [12, 6, 'Pruebas unitarias y de widgets'],
    [13, 7, 'Sesión, preferencias y persistencia ligera'],
    [14, 7, 'Búsqueda, filtros y accesibilidad básica'],
    [15, 8, 'Refactorización, documentación y preparación de entrega'],
    [16, 8, 'Generación de APK y presentación escrita final']
  ];

  const stripTags = (html) => String(html || '').replace(/<[^>]*>/g, '');

  function sessions() {
    if (Array.isArray(window.courseWeeks)) {
      return window.courseWeeks.flatMap((week) => week.sessions.map((session) => ({
        number: session.number,
        week: week.number,
        title: session.title,
        goal: stripTags(session.goal)
      })));
    }
    return FALLBACK_SESSIONS.map(([number, week, title]) => ({ number, week, title, goal: '' }));
  }

  function normalize(text) {
    return String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  }

  function searchSessions(query) {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return sessions().filter((session) => {
      const haystack = normalize(`${session.number} ${session.title} ${session.goal}`);
      return words.every((word) => haystack.includes(word));
    });
  }

  const sessionUrl = (number) => `sesion-${pad(number)}.html`;
  const currentSessionNumber = () => Number(document.body.dataset.session) || null;

  function navigate(url) {
    window.location.href = url;
  }

  function isTyping(target) {
    return !!target && (target.isContentEditable || /^(?:input|textarea|select)$/i.test(target.tagName || ''));
  }

  function buildPager(section) {
    const current = currentSessionNumber();
    if (!current || sessionOf(section) !== current || document.querySelector('.session-pager')) return;
    const all = sessions();
    const prev = all.find((s) => s.number === current - 1);
    const next = all.find((s) => s.number === current + 1);
    const pager = document.createElement('nav');
    pager.className = 'session-pager';
    pager.setAttribute('aria-label', 'Sesiones anterior y siguiente');
    const link = (session, rel, label) => {
      const a = document.createElement('a');
      a.href = sessionUrl(session.number);
      a.rel = rel;
      a.className = `pager-${rel}`;
      a.innerHTML = `<span class="pager-label"></span><strong></strong>`;
      a.querySelector('.pager-label').textContent = `${label} · Sesión ${session.number}`;
      a.querySelector('strong').textContent = session.title;
      return a;
    };
    if (prev) pager.append(link(prev, 'prev', '← Anterior'));
    if (next) pager.append(link(next, 'next', 'Siguiente →'));
    section.after(pager);
  }

  function scrollToHashStep(section) {
    if (!isSingleCodelabPage()) return;
    const match = /^#(paso-\d+)$/.exec(window.location.hash);
    const step = match && section.querySelector(`#${match[1]}`);
    if (step) step.scrollIntoView({ block: 'start' });
  }

  window.addEventListener('codelabenhanced', (event) => {
    buildPager(event.detail.section);
    scrollToHashStep(event.detail.section);
  });

  function buildResumeBanner() {
    const hero = document.querySelector('header.hero, header.codelab-hero');
    const last = readLast();
    if (!hero || !last || document.querySelector('.resume-banner')) return;
    const session = sessions().find((s) => s.number === last.session);
    const banner = document.createElement('aside');
    banner.className = 'resume-banner container';
    banner.setAttribute('aria-label', 'Retomar el curso');
    banner.innerHTML = '<p><span class="resume-eyebrow">CONTINUAR DONDE LO DEJASTE</span><strong></strong><span class="resume-title"></span></p><a class="resume-link"></a>';
    banner.querySelector('strong').textContent = `Sesión ${last.session} · paso ${last.label ?? last.step}`;
    banner.querySelector('.resume-title').textContent = session ? session.title : '';
    const link = banner.querySelector('a');
    link.href = `${sessionUrl(last.session)}#paso-${last.step}`;
    link.textContent = 'Continuar →';
    hero.after(banner);
  }

  // Paleta de búsqueda: diálogo modal accesible con lista de opciones.
  let palette;
  let opener;

  function buildPalette() {
    palette = document.createElement('div');
    palette.className = 'search-palette';
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    palette.setAttribute('aria-label', 'Buscar sesiones');
    palette.hidden = true;
    palette.innerHTML = `
      <div class="search-panel">
        <div class="search-field">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input type="search" placeholder="Buscar sesión, tema o número…" autocomplete="off" spellcheck="false"
            role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list" aria-label="Buscar sesiones">
          <button type="button" class="search-close">Cerrar</button>
        </div>
        <ul id="search-results" class="search-results" role="listbox" aria-label="Resultados"></ul>
        <p class="search-hint"><kbd>↑</kbd><kbd>↓</kbd> elegir · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> cerrar · <kbd>←</kbd><kbd>→</kbd> sesión anterior/siguiente</p>
      </div>`;
    document.body.append(palette);
    const input = palette.querySelector('input');
    const list = palette.querySelector('ul');
    let results = [];
    let selected = 0;

    function render() {
      results = searchSessions(input.value);
      selected = Math.min(selected, Math.max(0, results.length - 1));
      list.replaceChildren();
      if (!results.length) {
        const empty = document.createElement('li');
        empty.className = 'search-empty';
        empty.textContent = 'Sin resultados. Prueba con otra palabra.';
        list.append(empty);
        input.removeAttribute('aria-activedescendant');
        return;
      }
      results.forEach((session, index) => {
        const item = document.createElement('li');
        item.id = `search-option-${session.number}`;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(index === selected));
        item.innerHTML = '<span class="search-num"></span><span class="search-text"><strong></strong><small></small></span>';
        item.querySelector('.search-num').textContent = pad(session.number);
        item.querySelector('strong').textContent = session.title;
        item.querySelector('small').textContent = `Semana ${session.week}`;
        if (session.number === currentSessionNumber()) item.classList.add('is-current');
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.addEventListener('click', () => api.navigate(sessionUrl(session.number)));
        list.append(item);
      });
      const active = list.children[selected];
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView?.({ block: 'nearest' });
    }

    input.addEventListener('input', () => {
      selected = 0;
      render();
    });
    palette.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePalette();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!results.length) return;
        selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        render();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (results[selected]) api.navigate(sessionUrl(results[selected].number));
      } else if (event.key === 'Tab') {
        // Foco atrapado: alterna entre el campo y el botón Cerrar.
        event.preventDefault();
        (document.activeElement === input ? palette.querySelector('.search-close') : input).focus();
      }
      event.stopPropagation();
    });
    palette.addEventListener('click', (event) => {
      if (event.target === palette) closePalette();
    });
    palette.querySelector('.search-close').addEventListener('click', closePalette);
    palette.render = render;
  }

  function openPalette() {
    if (!palette) buildPalette();
    opener = document.activeElement;
    palette.hidden = false;
    document.documentElement.classList.add('search-open-lock');
    const input = palette.querySelector('input');
    input.value = '';
    palette.render();
    input.focus();
  }

  function closePalette() {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    document.documentElement.classList.remove('search-open-lock');
    const fallback = document.querySelector('.search-open');
    (opener && opener !== document.body && document.contains(opener) ? opener : fallback)?.focus();
  }

  function placeSearchButton() {
    const host = document.querySelector('.nav, .theme-toolbar');
    if (!host) return;
    let button = document.querySelector('.search-open');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-open';
      button.setAttribute('aria-label', 'Buscar sesiones (atajo: /)');
      button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="search-open-label">Buscar</span><kbd aria-hidden="true">/</kbd>';
      button.addEventListener('click', () => {
        openPalette();
        opener = button;
      });
    }
    const toggle = host.querySelector('.theme-toggle');
    if (toggle) toggle.before(button);
    else if (button.parentNode !== host) host.append(button);
  }

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (palette && !palette.hidden) return;
    if (event.key === '/') {
      event.preventDefault();
      openPalette();
      return;
    }
    const current = currentSessionNumber();
    if (!current || event.shiftKey) return;
    // Sólo sin foco en ningún control: las flechas también desplazan bloques de código y listas.
    if (event.target !== document.body && event.target !== document.documentElement) return;
    if (event.key === 'ArrowLeft' && current > 1) api.navigate(sessionUrl(current - 1));
    if (event.key === 'ArrowRight' && current < 16) api.navigate(sessionUrl(current + 1));
  });

  // ---------- Impresión: muestra las explicaciones plegadas y luego restaura el estado ----------
  let printState = null;
  window.addEventListener('beforeprint', () => {
    const details = Array.from(document.querySelectorAll('details'));
    printState = details.map((d) => [d, d.open]);
    details.forEach((d) => { d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    printState?.forEach(([d, open]) => { d.open = open; });
    printState = null;
  });

  function init() {
    buildReadingAids();
    placeSearchButton();
    buildResumeBanner();
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
    normalize,
    searchSessions,
    navigate,
    openPalette,
    closePalette
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // theme.js crea su botón en DOMContentLoaded: se recoloca la búsqueda junto a él.
  document.addEventListener('DOMContentLoaded', placeSearchButton);
})();
