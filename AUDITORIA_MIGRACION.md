# Auditoría de la migración del codelab

Comparación realizada el 18 de noviembre de 2026 con https://epanchanaf.github.io/curso-flutter/ y su repositorio https://github.com/epanchanaf/curso-flutter, commit `5d5d7b307386b5cfb4a8c7e6c9a6ab4b8fbad912`.

Se descargaron los 40 archivos del sitio original: todos coincidieron byte por byte con ese commit. La comparación partió del commit local `95a859db5fb0afc7b9f843b3be771805e31fc602`.

## Fallos encontrados y corregidos

- Faltaban `codelab-05.html` a `codelab-16.html`: 12 laboratorios, con 93 pasos y 95 bloques de código. Las sesiones 5 a 14 mostraban una plantilla resumida en su lugar.
- Faltaban `sesion-15.html` y `sesion-16.html`, así como sus entradas en el menú lateral y su carga en el visor.
- `app.js` fusionaba sesiones y reducía el programa de ocho semanas y dieciséis sesiones a siete semanas y catorce sesiones. Se restauraron los datos y el comportamiento originales.
- La portada y el índice indicaban siete semanas y 35 horas. Se recuperaron las ocho semanas y 40 horas originales, junto con sus objetivos, actividades y evidencias.
- El proyecto integrador había perdido parte de la ruta semanal y sus entregables. Se restauró `integrador.html` completo.
- Las especificaciones habían cambiado la duración del curso y la implementación del resaltado de sintaxis difería del original. Ambos archivos se restauraron.
- La migración del tema había cambiado reglas de diseño del modo claro. Se recuperaron las dos hojas de estilos originales y se separó el tema en `theme.css`.
- El botón de tema estaba dentro de un menú que se oculta en móviles. Ahora está fuera de ese menú y aparece también al abrir directamente los laboratorios independientes.
- Los cambios automáticos de tema del sistema se guardaban como una elección manual, impidiendo seguir cambios posteriores. Se corrigió ese comportamiento y se añadió sincronización entre pestañas.

## Resultado y comprobaciones

Los 39 archivos originales de contenido, código y estilos se conservan exactamente; en los HTML únicamente se añaden las referencias a `theme.css` y `theme.js`. El README se adapta a este repositorio. Los hashes originales están registrados en `tests/original-content.json` y se comprueban con `python3 scripts/verify_content.py`.

`npm test` comprueba además las 32 páginas, el botón de tema, su persistencia, el seguimiento de la preferencia del sistema, el funcionamiento sin almacenamiento, la sincronización entre pestañas, los enlaces y anclas locales, las ocho pestañas semanales y la carga íntegra de las dieciséis sesiones. Verifica que el resaltado y el botón de copiar conservan el texto de los ejemplos.

La verificación funcional usa un DOM con jsdom. No se realizó una inspección visual en navegador: la conexión de control del navegador no estaba disponible en esta sesión.

## Mejoras visuales posteriores

A petición del usuario, se añadieron transiciones de color de 280 ms, una mezcla de los degradados de portada de 320 ms y un cambio animado del icono de tema. Se habilitan después del primer dibujo para conservar la carga inicial sin destellos. Los enlaces de navegación incorporan un subrayado al interactuar; los bloques de código y los controles tienen un foco de teclado más claro. Las tarjetas solo reciben un cambio sutil de borde al pasar el cursor. La preferencia `prefers-reduced-motion` desactiva las transiciones, las animaciones y el desplazamiento suave, incluidas las reglas originales. Estos ajustes se concentran en `theme.css` y `theme.js`; se mantienen los 39 archivos originales verificados.

## Mejoras de experiencia y contraste (19 de noviembre de 2026)

Diseño y plan: `docs/superpowers/specs/2026-11-19-mejoras-diseno-calidad-de-vida-design.md` y `docs/superpowers/plans/2026-11-19-mejoras-diseno-calidad-de-vida.md`.

- **Capa separada.** `enhancements.css` y `enhancements.js` se cargan en las 32 páginas, después del tema. `verify_content.py` reconoce el bloque de integración completo.
- **Excepción a la regla de archivos idénticos.** `codelab-navigation.js` tenía desfasados los títulos de las sesiones 9 a 12 y 16 respecto a `app.js`; por ejemplo, la 12 y la 13 se llamaban igual. Se alinearon con `app.js` y el nuevo hash queda registrado con su motivo en `tests/original-content.json`. Los otros 38 archivos siguen idénticos.
- **Finales de línea.** Con `core.autocrlf=true`, Windows convertía los archivos a CRLF y `verify_content.py` fallaba aunque el contenido era el mismo. `.gitattributes` fija `eol=lf`.
- **Desbordamiento en móviles.** A 390 px, 14 páginas del original desbordaban en horizontal: bloques de código dentro de cuadrículas sin `min-width: 0` y rutas largas en código en línea. Tras la corrección, ninguna de las 32 páginas desborda a 390 px ni a 1440 px.

### Contraste del modo oscuro

Medido en Chrome con `scripts/contrast-audit.js` sobre todos los nodos de texto de las 32 páginas: 11 184 antes y 11 744 después, que incluyen los componentes nuevos. Se auditó con todos los codelabs y detalles desplegados, la paleta de búsqueda abierta y progreso guardado, tomando el peor color de cada degradado.

| | Antes | Después |
|---|---|---|
| Textos por debajo de AA (4.5:1, o 3:1 en texto grande) | 130 | 0 |
| Textos de tamaño normal por debajo de 7:1 | 523 | 0 |
| Peor caso | 1.91:1 (insignia «3 HORAS», menta sobre lila) | 7.07:1 |

Causas principales: en oscuro `--purple` se aclaraba a `#a69dff`, pero seguía usándose como fondo de texto blanco en insignias, marca y botón principal. Los degradados de las cabeceras de codelab y sesión terminaban en un verde azulado claro (`#41777c`), y los comentarios de código quedaban en 4.46:1. Ahora los rellenos usan `--purple-fill` (`#3b32a8`), los degradados son más profundos y `--muted`/`--purple` son algo más claros.

### Contraste del modo claro

A petición del usuario también se corrigió el modo claro, con la misma auditoría (11 720 textos). El script ignora ahora el texto transparente, como el número oculto bajo el ✓ de un paso completado.

| | Antes | Después |
|---|---|---|
| Textos por debajo de AA | 181 | 0 |
| Textos de tamaño normal por debajo de 7:1 | 2 238 | 0 |
| Peor caso | 2.97:1 (código en los recuadros de reto) | 7.04:1 |

Se conservan la paleta y la estructura del original, con tonos más profundos. Todo está en `theme.css`, bajo `:root:not([data-theme="dark"])`:

- `--muted` pasa de `#5e6b80` a `#3f4a60` y `--purple` de `#6257e9` a `#4339b8`.
- Las cabeceras de codelab y sesión terminan en `#264f53` en lugar de `#41777c`.
- Los recuadros de reto usan el degradado profundo del modo oscuro y el código dentro de ellos va sobre `#1d1850`.
- La etiqueta morada sobre la sección oscura de la portada se aclara.
- Se oscurecen algunos colores fijos del original: menú lateral, notas, ejemplos de especificación y números de la metodología.

### Verificación

`npm test` ejecuta 25 pruebas (8 del sitio y 17 de las mejoras). Cubren el progreso, los datos corruptos, el almacenamiento bloqueado, la sincronización entre pestañas, la carga asíncrona de las sesiones, la píldora, la búsqueda, los atajos (ignorados mientras se escribe), el paginador en las sesiones 1 y 16, el aviso de continuar y la impresión. Se revisaron visualmente en Chrome la portada, `sesion-05` y `sesion-07`, en claro y oscuro, a 390 y 1440 px, sin errores de consola. La hoja de impresión se revisó en código, no en una vista previa de impresión.
