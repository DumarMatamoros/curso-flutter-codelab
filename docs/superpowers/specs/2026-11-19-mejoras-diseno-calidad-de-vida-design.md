# Mejoras de diseño y calidad de vida — Diseño

Fecha: 2026-11-19

## Intención

La copia (`DumarMatamoros/curso-flutter-codelab`) tiene el mismo contenido que el original de epanchanaf más un modo oscuro. Se quiere mejorar la experiencia de quien sigue los codelabs: saber dónde va, retomar, moverse rápido entre sesiones, leer cómodo en ambos temas e imprimir. Además, mejorar el contraste del modo oscuro.

## Objetivos

1. **Progreso por paso**: casilla "hecho" en cada `.lab-step`, contador `N/M pasos` con barra en la cabecera del codelab, y marca en el menú lateral (✓ si la sesión está completa; indicador parcial si no).
2. **Barra de progreso de lectura** fija arriba y botón **volver arriba**.
3. **Navegador de pasos**: una píldora fija "Paso 3 de 9" que abre la lista de pasos y resalta el actual al desplazarse (IntersectionObserver). Funciona en cualquier ancho y no compite con el menú lateral.
4. **Retomar**: se guarda la última sesión y el último paso visitados. La portada (`index.html`) y el índice (`codelabs.html`) muestran "Continuar: Sesión 7 · paso 5" con un enlace a `sesion-07.html#paso-5`.
5. **Anterior / Siguiente sesión** al final de cada `sesion-XX.html`, con atajos `←`/`→`.
6. **Búsqueda rápida**: paleta abierta con `/` o con un botón en la barra. Busca por número, título y objetivo, sin distinguir acentos ni mayúsculas, y se navega con las flechas, `Enter` y `Esc`.
7. **Lectura**: ancho de párrafo de unos 72ch, interlineado 1.7 y más jerarquía visual en los títulos de paso, en ambos temas.
8. **Impresión/PDF**: oculta la navegación, el menú, los botones y los controles; fuerza colores claros; abre los `<details>`; evita cortar pasos y bloques de código; ajusta las líneas largas de `pre`.
9. **Contraste del modo oscuro**: todo texto con al menos 4.5:1 (AA), texto de cuerpo con al menos 7:1 cuando sea viable, y bordes o controles con al menos 3:1. Incluye los tokens del resaltado de sintaxis y los textos con colores fijos de `styles.css` que hoy no se adaptan al tema.
10. **Mantenimiento**: `.gitattributes` con `eol=lf` y renormalización, para que `verify_content.py` pase en Windows.
11. **Corrección de títulos** en `codelab-navigation.js`: hoy la semana 6 muestra "11 Pruebas…" y "12 Sesión, preferencias…", y la 7 repite "13 Sesión, preferencias…". Se alinea con `app.js` (fuente de verdad) y se actualiza su hash en `tests/original-content.json`, documentando la excepción. *(Decisión de Claude: el usuario aprobó "todo eso" sin elegir explícitamente entre corregir y reportar.)*

## No objetivos

- Cambiar el contenido didáctico, salvo la corrección del punto 11.
- Agregar un paso de compilación, frameworks o dependencias en tiempo de ejecución.
- Sincronizar el progreso entre dispositivos o usar un backend. Todo vive en `localStorage`.

## Antiobjetivos

- Romper la sincronización con el original. Los 38 archivos restantes deben seguir siendo idénticos byte a byte.
- Romper el sitio sin JavaScript o sin almacenamiento. Todas las mejoras degradan en silencio.
- Animaciones que ignoren `prefers-reduced-motion`.
- Destellos de tema o saltos de diseño durante la carga.

## Restricciones

- Sitio estático en GitHub Pages (rama `main`, raíz).
- Los archivos originales se verifican por hash (`scripts/verify_content.py`, `tests/original-content.json`).
- Las páginas `sesion-XX.html` insertan el codelab de forma asíncrona en `#detailed-codelab` vía `fetch`. Las mejoras deben aplicarse cuando aparezca el contenido (MutationObserver).
- Los codelabs 1 a 4 están en `codelabs.html` (`#codelab-1..4`); los 5 a 16 en `codelab-NN.html` (`#codelab-N`).

## Enfoques considerados

| Enfoque | Ventaja | Costo |
|---|---|---|
| **A. Capa separada: `enhancements.css` + `enhancements.js` (elegido)** | No toca los originales; integrar actualizaciones del profesor sigue siendo trivial | Hay que esperar el contenido asíncrono y no se reutilizan funciones internas de `session-page.js` |
| B. Editar `styles.css`, `app.js` y `session-page.js` | Código más directo | Cada actualización del original produce conflictos; se pierde la verificación por hash |
| C. Cargar las mejoras desde `theme.js` sin tocar el HTML | No cambia el HTML | Los estilos inyectados tarde provocan saltos visuales; acopla dos responsabilidades |

Se eligió A. El contraste del modo oscuro se corrige en `theme.css`, que ya es la capa del tema.

## Decisiones de construcción

- Cada HTML añade, después de las líneas del tema, `<link rel="stylesheet" href="enhancements.css" />` y `<script src="enhancements.js" defer></script>`. `verify_content.py` y las pruebas pasan a reconocer el bloque de integración completo (tema + mejoras).
- Almacenamiento, todo con `try/catch`:
  - `curso_flutter_progress`: `{ "<sesión>": [índices de paso completados] }`.
  - `curso_flutter_last`: `{ session, step, ts }`.
  - Se sincroniza entre pestañas con el evento `storage`, igual que el tema.
- Cada `.lab-step` recibe `id="paso-N"` si no tiene uno. La casilla es un `<input type="checkbox">` real con etiqueta accesible "Marcar paso N como hecho".
- Datos de sesiones: se usa `window.courseWeeks` cuando existe. Si no, `enhancements.js` incluye una lista mínima de las 16 sesiones (número, semana, título).
- Los atajos de teclado se ignoran con foco en campos de texto o con teclas modificadoras.
- La paleta de búsqueda es un `role="dialog"` con `aria-modal`, foco atrapado y lista `role="listbox"`.
- Auditoría de contraste: recorrido de los nodos de texto de todas las páginas en modo oscuro con un navegador real (Chrome DevTools), calculando la razón entre el color de primer plano y el fondo efectivo. Los resultados y los cambios se registran en `AUDITORIA_MIGRACION.md`.

## Verificación

- `npm test` amplía `tests/codelab.test.cjs` con: persistencia del progreso, almacenamiento bloqueado, contador y marcas del menú, aviso de retomar, anterior/siguiente en los límites (sesiones 1 y 16), filtro de búsqueda con acentos, atajos ignorados en inputs y aplicación tras la carga asíncrona.
- `verify_content.py` pasa en Windows y en Linux.
- Revisión visual en navegador de ambos temas, móvil y escritorio, e impresión.

## Para quien construya

Valores exactos de color, espaciados, iconografía y texto de las etiquetas, siempre que se respeten las razones de contraste y el estilo actual (Manrope, morado `#6257e9` / `#a69dff`, menta).
