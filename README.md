# Curso Flutter — Codelab

Versión del [codelab original de epanchanaf](https://epanchanaf.github.io/curso-flutter/) con el mismo contenido y diseño claro, más un modo oscuro, contraste AA en ambos temas y mejoras para seguir los laboratorios.

**Sitio publicado:** https://dumarmatamoros.github.io/curso-flutter-codelab/

El curso contiene **8 semanas, 16 sesiones y 40 horas**, con los laboratorios completos y el proyecto integrador TaskFlow. El selector de tema está disponible también en móviles, recuerda la elección y sigue la preferencia del sistema mientras no se elija un tema manualmente. Los colores y el icono de sol/luna cambian suavemente, sin animar la carga inicial. Los enlaces, el código y el foco de teclado incluyen detalles visuales discretos. La preferencia de movimiento reducido desactiva las animaciones y el desplazamiento suave.

## Mejoras para seguir los codelabs

- **Progreso por paso:** cada paso tiene una casilla *Hecho* y cada codelab un check general (*Marcar todos* / *Desmarcar todos*, a medias si hay progreso parcial); la cabecera muestra `N/M pasos` y el menú lateral marca las sesiones empezadas (•) y terminadas (✓). Se guarda en el navegador.
- **Continuar donde lo dejaste:** la portada y el índice de codelabs enlazan a la última sesión y paso visitados.
- **Navegador de pasos:** una píldora fija («Paso 3 · 4/9») abre la lista de pasos del codelab.
- **Barra de lectura y botón para volver arriba.**
- **Anterior / Siguiente sesión** al final de cada sesión.
- **Búsqueda rápida** de sesiones por número, título u objetivo, sin importar acentos.
- **Codelabs independientes** (`codelab-NN.html`): con las fuentes del sitio y enlaces al índice y a su vista de sesión.
- **Impresión/PDF limpia:** sin menús ni botones, en colores claros y con las explicaciones desplegadas.
- **Contraste AA en modo claro y oscuro:** todo el texto supera 7:1.
- **Móvil:** sin desbordamiento horizontal; en las sesiones el menú de 16 sesiones se pliega («Sesión 5 de 16 · Ver todas»); la píldora y el botón de volver arriba aparecen al llegar a los pasos y se ocultan al bajar; casillas táctiles de 44 px.

| Atajo | Acción |
|---|---|
| `/` | Abrir la búsqueda |
| `↑` `↓` `Enter` | Elegir y abrir un resultado |
| `Esc` | Cerrar la búsqueda o la lista de pasos |
| `←` `→` | Sesión anterior / siguiente (en las páginas de sesión) |

## Desarrollo local

Es un sitio estático sin compilación ni dependencias de ejecución. Para que el visor pueda cargar los laboratorios mediante `fetch`, ábrelo con un servidor HTTP:

```sh
python3 -m http.server 8000
```

Visita http://localhost:8000/.

## Verificación

Comprobar la integridad respecto al original, sin dependencias ni acceso a la red:

```sh
python3 scripts/verify_content.py
```

Pruebas funcionales del DOM y del contenido (Node.js 24.15 o posterior de la rama 24, o Node.js 26+, y Python 3):

```sh
npm ci
npm test
```

Consulta [AUDITORIA_MIGRACION.md](AUDITORIA_MIGRACION.md) para ver los fallos encontrados, el origen de los archivos y el alcance de la verificación.

## Publicación

GitHub Pages publica la rama `main`, carpeta `/(root)`. Basta con subir los archivos: no hace falta ejecutar `npm install` ni compilar para publicar o usar el sitio.

Las hojas `styles.css` y `codelab-navigation.css` conservan el diseño original. `theme.css` y `theme.js` implementan el selector y los colores oscuros; `enhancements.css` y `enhancements.js`, las mejoras de experiencia. Todas las páginas incluyen los cuatro archivos, así que los cambios del repositorio original pueden incorporarse sin conflictos.

`scripts/contrast-audit.js` es una auditoría de contraste WCAG para ejecutar en la consola del navegador (`auditContrast()`).
