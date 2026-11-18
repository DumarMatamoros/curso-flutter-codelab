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
