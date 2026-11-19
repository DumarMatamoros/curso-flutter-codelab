# Mejoras de diseño y calidad de vida — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir progreso por paso, retomar, navegación rápida, búsqueda, mejor lectura, impresión y contraste AA en modo oscuro sin modificar los archivos originales del curso.

**Architecture:** Una capa nueva (`enhancements.css` + `enhancements.js`) cargada en cada HTML junto al tema. El JS expone funciones puras en `window.CursoFlutterEnhancements` para probarlas con jsdom y mejora el DOM cuando aparece cada codelab (incluida la carga asíncrona de `sesion-XX.html`). El contraste oscuro se corrige en `theme.css`.

**Tech Stack:** HTML/CSS/JS sin compilación; pruebas con `node --test` + jsdom 31; Python 3 para la verificación de hashes; Chrome DevTools MCP para la auditoría visual y de contraste.

**Spec:** `docs/superpowers/specs/2026-11-19-mejoras-diseno-calidad-de-vida-design.md`

## Global Constraints

- Los archivos de `tests/original-content.json` siguen siendo idénticos al original, salvo `codelab-navigation.js` (excepción documentada).
- Sin dependencias de ejecución ni paso de compilación; GitHub Pages publica `main` en la raíz.
- Todo acceso a `localStorage` va en `try/catch`; sin JS o sin almacenamiento el sitio funciona igual que hoy.
- Claves: `curso_flutter_progress` = `{ "<sesión>": [pasos 1-based] }`, `curso_flutter_last` = `{ session, step, ts }`.
- Toda animación respeta `prefers-reduced-motion`.
- Contraste en modo oscuro: texto ≥ 4.5:1, texto de cuerpo ≥ 7:1 cuando sea viable, bordes y controles ≥ 3:1.
- Textos de interfaz en español.
- Trabajo en la rama `mejoras-ux`; `main` no se toca hasta la integración.

## Review Focus

1. Sesión cargada de forma asíncrona: las casillas y el contador deben aparecer después de que `session-page.js` inserte el codelab, no antes.
2. `codelabs.html` contiene cuatro codelabs en una página: el progreso de cada uno debe ser independiente.
3. Datos corruptos en `localStorage` (JSON inválido, tipos raros): se ignoran sin romper la página.
4. Teclas `/`, `←` y `→` pulsadas mientras se escribe en un campo de texto (incluida la propia búsqueda): no deben disparar atajos.
5. Sesiones 1 y 16: "Anterior" y "Siguiente" no deben enlazar a sesiones inexistentes.

---

### Task 1: Base del repositorio e integración de la capa

**Files:**
- Create: `.gitattributes`, `enhancements.css` (vacío con comentario), `enhancements.js` (IIFE vacía que define `window.CursoFlutterEnhancements = {}`), `tests/enhancements.test.cjs`
- Modify: los 32 `*.html` (añadir dos líneas tras `<script src="theme.js"></script>`), `scripts/verify_content.py` (`THEME_HEAD`), `codelab-navigation.js:6-7`, `tests/original-content.json` (hash de `codelab-navigation.js`), `tests/codelab.test.cjs` (`openPage` también evalúa `enhancements.js`)

**Interfaces:**
- Produces: bloque de integración exacto en cada HTML:
  ```
    <link rel="stylesheet" href="theme.css" />
    <script src="theme.js"></script>
    <link rel="stylesheet" href="enhancements.css" />
    <script src="enhancements.js" defer></script>
  ```
  (con el mismo sangrado que hoy tiene cada archivo; `verify_content.py` lo elimina antes de calcular el hash).

- [ ] **Step 1:** Crear la rama `mejoras-ux`. Añadir `.gitattributes` con `* text=auto eol=lf` y `*.png binary`. Ejecutar `git add --renormalize .` y volver a sacar los archivos (`git rm --cached -r . -q && git reset --hard`) para que el árbol quede en LF.
- [ ] **Step 2:** `python scripts/verify_content.py` → `OK: 39 archivos idénticos…`
- [ ] **Step 3:** Prueba nueva en `tests/codelab.test.cjs`: `'todas las páginas cargan la capa de mejoras una sola vez'`. Cada HTML tiene exactamente un `link[href="enhancements.css"]` y un `script[src="enhancements.js"][defer]`. Ejecutarla y verla fallar.
- [ ] **Step 4:** Insertar las dos líneas en los 32 HTML con un script y actualizar `THEME_HEAD` en `verify_content.py` al bloque de cuatro líneas.
- [ ] **Step 5:** Corregir `codelab-navigation.js`: semana 6 → `{11, 'Pruebas unitarias y de widgets'}`, `{12, 'Sesión, preferencias y persistencia ligera'}`; semana 7 → `{13, 'Búsqueda, filtros y accesibilidad básica'}`, `{14, …}` según `app.js` (comprobar los títulos 11 a 16 contra `window.courseWeeks`). Recalcular el hash en `tests/original-content.json` y añadir allí `"exceptions": {"codelab-navigation.js": "títulos de sesiones 11-14 alineados con app.js"}`.
- [ ] **Step 6:** Prueba `'el menú de codelabs usa los mismos títulos que app.js'`: los 16 enlaces de `codelabs.html` coinciden con `courseWeeks`.
- [ ] **Step 7:** `npm test` → todo PASS. Commit `chore: integrar capa de mejoras, normalizar LF y corregir títulos del menú`.

### Task 2: Progreso por paso y última posición

**Files:**
- Modify: `enhancements.js`, `enhancements.css`
- Test: `tests/enhancements.test.cjs`

**Interfaces:**
- Produces en `window.CursoFlutterEnhancements`:
  - `readProgress(): Record<string, number[]>`: `{}` si no hay datos o son inválidos.
  - `setStepDone(session: number, step: number, done: boolean): void`
  - `sessionProgress(session: number, total: number): { done: number, total: number, complete: boolean }`
  - `readLast(): { session: number, step: number, ts: number } | null`
  - `rememberPosition(session: number, step: number): void`
  - `enhanceCodelab(section: Element): void`: idempotente (marca `data-enhanced`).
  - Evento `window` `codelabprogress` con `detail: { session }` tras cada cambio.
- DOM producido: cada `.lab-step` recibe `id="paso-N"` (si no tiene id) y un `<label class="step-done"><input type="checkbox"> Hecho</label>` con `aria-label="Marcar paso N como hecho"`. En la cabecera del codelab (`.codelab-title`) va `<div class="step-progress" role="status">` con el texto `N/M pasos` y un `<progress>`. En los enlaces del menú lateral (`.sidebar-week a`), la clase `is-complete` o `is-started`.

- [ ] **Step 1:** Pruebas (fallan primero):
  - `'guarda y lee el progreso por sesión'`: `setStepDone(7,2,true)`, `setStepDone(7,5,true)`, `setStepDone(7,2,false)` → `readProgress()` es `{ "7": [5] }`; `sessionProgress(7,9)` es `{done:1,total:9,complete:false}`.
  - `'ignora datos corruptos y almacenamiento bloqueado'`: el valor `"{oops"` → `{}`; con `localStorage` lanzando excepción, `setStepDone` no lanza y `readLast()` es `null`.
  - `'sesion-07 añade casillas tras la carga asíncrona'`: misma preparación que la prueba existente de 16 sesiones; tras `setImmediate`, el número de `input[type=checkbox]` es igual al de `.lab-step`; al marcar el primero, `.step-progress` contiene `1/` y el enlace de la sesión 7 en el menú tiene `is-started`.
  - `'codelabs.html lleva progreso independiente por codelab'`: marcar un paso en `#codelab-2` no cambia el contador de `#codelab-1`.
  - `'marcar todos los pasos completa la sesión'` → el enlace tiene `is-complete`.
- [ ] **Step 2:** Implementar. Detección: `document.querySelectorAll('[id^="codelab-"]')` que contengan `.lab-step`; sesión = número del id. Un `MutationObserver` sobre `body` (`childList, subtree`) llama a `enhanceCodelab` para los nodos nuevos. La última posición se actualiza con un IntersectionObserver por paso (umbral 0.5) y con el clic de la casilla, sólo en `sesion-XX.html` y `codelab-NN.html`. El evento `storage` de las dos claves refresca casillas y marcas.
- [ ] **Step 3:** CSS: casilla alineada con `.step-number`, paso hecho con `.lab-step.is-done` (borde menta y número con ✓), barra `<progress>` con el morado del tema, marcas ✓ y punto parcial en el menú. Ambos temas.
- [ ] **Step 4:** `npm test` PASS. Commit `feat: progreso por paso y última posición en los codelabs`.

### Task 3: Lectura: barra de progreso, volver arriba y píldora de pasos

**Files:** Modify `enhancements.js`, `enhancements.css`; Test `tests/enhancements.test.cjs`

**Interfaces:**
- Consumes: `enhanceCodelab` y los ids `paso-N` de la Task 2.
- Produces DOM: `<div class="reading-progress" aria-hidden="true"><span></span></div>` (en todas las páginas, con `scaleX` según el desplazamiento); `<button class="back-to-top" aria-label="Volver arriba">`, visible tras 600 px; `<nav class="step-pill" aria-label="Pasos del codelab">` con un botón `Paso X de M` (`aria-expanded`) y una lista de enlaces `#paso-N` con `aria-current="step"` en el actual. La píldora sólo aparece en las páginas con un único codelab visible (`sesion-XX`, `codelab-NN`).

- [ ] **Step 1:** Pruebas: `'la píldora lista los pasos y se abre con el botón'` (sesion-05: el número de enlaces es igual al de `.lab-step`; al hacer clic, `aria-expanded="true"`; con `Escape` se cierra y el foco vuelve al botón). `'index.html no muestra la píldora pero sí la barra de lectura'`.
- [ ] **Step 2:** Implementar (scroll con `requestAnimationFrame` y `passive: true`; `scrollTo` con `behavior` según `prefers-reduced-motion`).
- [ ] **Step 3:** CSS: píldora y volver arriba abajo a la derecha, apiladas, a 16 px del borde en móvil, sin tapar el botón Copiar; z-index por encima del contenido y por debajo de la paleta.
- [ ] **Step 4:** `npm test` PASS. Commit `feat: barra de lectura, volver arriba y navegador de pasos`.

### Task 4: Retomar, anterior/siguiente, atajos y búsqueda

**Files:** Modify `enhancements.js`, `enhancements.css`; Test `tests/enhancements.test.cjs`

**Interfaces:**
- Consumes: `readLast()` (Task 2).
- Produces:
  - `SESSIONS: Array<{ number: number, week: number, title: string, goal?: string }>`: a partir de `window.courseWeeks` si existe; si no, una lista interna de 16 entradas copiada de `app.js`.
  - `normalize(text: string): string`: minúsculas y sin diacríticos (`NFD` y quitar `\p{M}`).
  - `searchSessions(query: string): SESSIONS[number][]`: todas las palabras deben aparecer en `normalize(number + ' ' + title + ' ' + goal)`. Una consulta vacía devuelve las 16 en orden.
  - DOM: `.resume-banner` (en `index.html` tras el hero y en `codelabs.html` antes del menú) con `Continuar: Sesión S · paso P` y enlace `sesion-SS.html#paso-P`; `.session-pager` al final de `#detailed-codelab` con enlaces `rel="prev"`/`rel="next"`; botón `.search-open` ("Buscar", con `kbd /`) añadido a `.nav` antes del botón de tema; diálogo `.search-palette` con `role="dialog" aria-modal="true"`, `input[type=search]` y `ul[role=listbox]`.
  - Teclas: `/` abre la búsqueda; `←`/`→` van a la sesión anterior/siguiente en `sesion-XX`; `Esc` cierra; `↑`/`↓`/`Enter` en la lista. Todas se ignoran si `event.target` es `input`, `textarea`, `select` o `contenteditable`, o si hay `ctrl`/`meta`/`alt` pulsado (salvo las flechas dentro de la paleta).

- [ ] **Step 1:** Pruebas:
  - `'busca sin acentos ni mayúsculas'`: `searchSessions('navegacion')` incluye la sesión 4; `searchSessions('apk')` incluye la 16; `searchSessions('zzz')` es `[]`; `searchSessions('')` tiene 16 elementos.
  - `'el paginador respeta los límites'`: sesion-01 sin `rel=prev` y con `rel=next` a `sesion-02.html`; sesion-16 sin `rel=next`.
  - `'los atajos no se disparan mientras se escribe'`: con la paleta abierta, al pulsar `/` en el input sigue habiendo un solo diálogo y el input contiene el texto; `ArrowRight` con foco en el input no cambia `location`.
  - `'muestra Continuar cuando hay una posición guardada'`: `curso_flutter_last={session:7,step:5}` → en index el enlace del banner es `sesion-07.html#paso-5`; sin datos no hay banner.
  - `'Enter abre el resultado seleccionado'`: escribir `filtros` y pulsar `Enter` → `location.href` termina en `sesion-14.html` (en jsdom, espiar la función de navegación expuesta como `CursoFlutterEnhancements.navigate`).
- [ ] **Step 2:** Implementar; `navigate(url)` es el único punto que asigna `location.href`.
- [ ] **Step 3:** CSS de la paleta (centrada, ancho máx. 560 px, a pantalla completa en móvil), del banner y del paginador. Ambos temas.
- [ ] **Step 4:** `npm test` PASS. Commit `feat: retomar, paginación entre sesiones, atajos y búsqueda rápida`.

### Task 5: Tipografía e impresión

**Files:** Modify `enhancements.css`

- [ ] **Step 1:** Lectura: dentro de `.codelab-content`, los `p` y `li` con `max-width: 72ch` y `line-height: 1.7`; `.lab-step h3` más grande, con separación clara entre pasos; sin tocar `pre`, que mantiene el ancho completo.
- [ ] **Step 2:** `@media print`: ocultar `.nav`, `.codelab-sidebar`, `.theme-toggle`, `.search-open`, `.step-pill`, `.back-to-top`, `.reading-progress`, `.code-copy`, `.step-done`, `.session-pager`, `.resume-banner` y `footer`; colores claros forzados (`color-scheme: light`, fondo blanco y texto negro, también en modo oscuro); `pre { white-space: pre-wrap; break-inside: avoid; }`; `.lab-step { break-inside: avoid-page; }`; mostrar la URL tras los enlaces externos.
- [ ] **Step 3:** En JS, `beforeprint` abre todos los `details` y `afterprint` restaura su estado. Prueba `'beforeprint abre los details'`.
- [ ] **Step 4:** Revisión en el navegador (Task 7). `npm test` PASS. Commit `style: tipografía de lectura y hoja de impresión`.

### Task 6: Contraste del modo oscuro

**Files:** Modify `theme.css`; Create `scripts/contrast-audit.js` (fragmento para ejecutar en el navegador; no se carga en el sitio)

**Interfaces:**
- `contrast-audit.js` define `auditContrast(): Array<{ selector, text, fg, bg, ratio, size, required }>`. Recorre los nodos de texto visibles, toma el color calculado, sube por los ancestros hasta un fondo opaco (los degradados toman el color de su capa `::before` del tema) y calcula la razón WCAG. `required` es 4.5, o 3 para texto ≥ 24 px o ≥ 18.66 px en negrita.

- [ ] **Step 1:** Servir el sitio (`python -m http.server 8000`) y, con Chrome DevTools en modo oscuro, ejecutar `auditContrast()` en las 32 páginas (en `sesion-XX` tras la carga). Guardar los incumplimientos.
- [ ] **Step 2:** Corregir en `theme.css`: tokens (`--muted` y similares), colores fijos de `styles.css` sin variante oscura y tokens del resaltado de sintaxis (`syntax.js`/clases de `pre`). También los componentes nuevos de las Tasks 2 a 4.
- [ ] **Step 3:** Repetir la auditoría hasta que no haya ningún texto bajo `required`. Comprobar que el modo claro no cambia (con `verify_content.py`, más una captura de antes y después de `index.html` en claro).
- [ ] **Step 4:** Commit `style: contraste AA en el modo oscuro`.

### Task 7: Documentación y verificación final

**Files:** Modify `README.md`, `AUDITORIA_MIGRACION.md`

- [ ] **Step 1:** README: lista de mejoras y atajos. Auditoría: la nueva capa, la excepción de `codelab-navigation.js`, `.gitattributes` y la tabla de contraste (de cuántos incumplimientos se pasó a 0, con ejemplos de las razones antes y después).
- [ ] **Step 2:** Recorrido en el navegador, en claro y oscuro, a 390 px y 1440 px: index, codelabs, sesion-01, sesion-07 y sesion-16, integrador y vista de impresión. Sin errores de consola.
- [ ] **Step 3:** `python scripts/verify_content.py && npm test` → PASS. Commit `docs: documentar mejoras de experiencia y auditoría de contraste`.
