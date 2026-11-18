# Curso Flutter — Codelab

Versión del [codelab original de epanchanaf](https://epanchanaf.github.io/curso-flutter/) con el mismo contenido y diseño claro, más un selector de modo oscuro.

**Sitio publicado:** https://dumarmatamoros.github.io/curso-flutter-codelab/

El curso contiene **8 semanas, 16 sesiones y 40 horas**, con los laboratorios completos y el proyecto integrador TaskFlow. El selector de tema está disponible también en móviles, recuerda la elección y sigue la preferencia del sistema mientras no se elija un tema manualmente. Los colores y el icono de sol/luna cambian suavemente, sin animar la carga inicial. Los enlaces, el código y el foco de teclado incluyen detalles visuales discretos. La preferencia de movimiento reducido desactiva las animaciones y el desplazamiento suave.

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

Las hojas `styles.css` y `codelab-navigation.css` conservan el diseño original. `theme.css` y `theme.js` implementan el selector y los colores oscuros. Todas las páginas incluyen ambos archivos de tema.
