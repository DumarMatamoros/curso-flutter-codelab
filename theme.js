// theme.js - Gestor de tema Claro / Oscuro para el Codelab Flutter
(function () {
  const STORAGE_KEY = 'curso_flutter_theme';
  const systemPreference = window.matchMedia?.('(prefers-color-scheme: dark)');
  let explicitPreference = null;

  function getSystemPreference() {
    return systemPreference?.matches ? 'dark' : 'light';
  }

  function getInitialTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        explicitPreference = saved;
        return saved;
      }
    } catch (e) {
      /* ignore localStorage errors */
    }
    return getSystemPreference();
  }

  // 1. Aplicación inmediata en <html> para prevenir FOUC
  const currentTheme = getInitialTheme();
  document.documentElement.setAttribute('data-theme', currentTheme);

  // 2. Actualizar estado visual y accesibilidad del botón
  function updateToggleUI(theme) {
    const toggles = document.querySelectorAll('.theme-toggle');
    const isDark = theme === 'dark';

    toggles.forEach((btn) => {
      btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      btn.setAttribute('title', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');

      const label = btn.querySelector('.theme-toggle-label');
      if (label) {
        label.textContent = isDark ? 'Claro' : 'Oscuro';
      }
    });
  }

  // 3. Cambiar tema y persistir
  function setTheme(theme, persist = true) {
    if (theme !== 'dark' && theme !== 'light') return;
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
      explicitPreference = theme;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }
    updateToggleUI(theme);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  // 4. Inyección del botón de alternancia en la barra de navegación
  function injectToggleButton() {
    if (document.getElementById('theme-toggle-btn')) return;

    let nav = document.querySelector('.nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'container theme-toolbar';
      document.body.prepend(nav);
    }

    const button = document.createElement('button');
    button.id = 'theme-toggle-btn';
    button.type = 'button';
    button.className = 'theme-toggle';
    button.innerHTML = '<span class="theme-icon icon-sun" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg></span><span class="theme-icon icon-moon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></span><span class="theme-toggle-label">Oscuro</span>';

    button.addEventListener('click', function (e) {
      e.preventDefault();
      toggleTheme();
    });

    nav.appendChild(button);

    const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateToggleUI(activeTheme);

    // Espera un dibujo completo antes de habilitar transiciones de color.
    // El tema inicial se aplicó en <head>, sin animar la carga de la página.
    window.requestAnimationFrame?.(() => {
      window.requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggleButton);
  } else {
    injectToggleButton();
  }

  // Sigue al sistema hasta que la persona elige un tema explícitamente.
  systemPreference?.addEventListener('change', function (event) {
    if (!explicitPreference) setTheme(event.matches ? 'dark' : 'light', false);
  });

  // Mantiene sincronizadas las pestañas cuando cambia la preferencia guardada.
  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    explicitPreference = event.newValue === 'dark' || event.newValue === 'light'
      ? event.newValue : null;
    setTheme(explicitPreference || getSystemPreference(), false);
  });

  // Exponer a nivel de ventana
  window.CursoFlutterTheme = {
    get: function () { return document.documentElement.getAttribute('data-theme') || 'light'; },
    set: setTheme,
    toggle: toggleTheme
  };
})();

