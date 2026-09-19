# Interfaz y marca

## Estructura

[`dist/index.html`](../../dist/index.html) contiene una cabecera compacta y un visor dividido en dos
columnas iguales:

- **Modelo 3D**, a la izquierda, con la barra vertical de coloración, exageración, curvas y cámara.
- **Imagen satelital**, a la derecha, con controles Leaflet, leyenda y la barra de herramientas de
  análisis (`.pane-tools`): perfil, medición, capas KML, plan de campo, drenaje y nivel de agua.

Las etiquetas de panel se colocan lejos de los controles de cada biblioteca. Las lecturas del
cursor se muestran sobre ambas vistas. Cada herramienta muestra sus resultados en un
`.result-panel` sobre la zona inferior del mapa, que oculta temporalmente la leyenda para evitar
solapamientos y se sitúa por encima de los controles de Leaflet.

El resumen de elevación de la cabecera y el rótulo de la zona de influencia de la leyenda se
llenan desde `terrain-data.js` (`actualMinElevation`, `actualMaxElevation` y `bufferMeters`), no
desde el marcado, para que no puedan contradecir al modelo publicado.

Los scripts se cargan al final en este orden: Plotly, Leaflet, Proj4, `terrain-data.js` y
`app.js`. El último usa `type="module"` y resuelve sus dependencias internas desde `dist/js/`.

## Cabecera

En escritorio mide 66 px. El logo y el nombre **Gestiagro** forman un bloque con proporciones de
marca; a continuación aparecen el título y EPSG:32620. A la derecha se muestran elevación,
resolución y curvas. No se presentan el nombre interno del área ni un descriptor corporativo.

## Herramientas

Hay dos barras, con responsabilidades distintas:

- **`.controls`**, sobre el modelo 3D: coloración, exageración, curvas y cámara. En escritorio va
  abajo a la izquierda; en móvil pasa a una fila horizontal.
- **`.pane-tools`**, sobre el panel satelital: las herramientas de análisis, que dibujan o calculan
  sobre el terreno. En móvil se dispone en horizontal con botones de 38 px y se oculta el rótulo
  del panel para dejarles sitio.

Los botones usan SVG en línea, estado activo turquesa, foco visible y etiquetas emergentes. La
exageración abre un panel pequeño con deslizador. Solo una herramienta de análisis puede estar
activa a la vez y su estado se refleja con `aria-pressed`; `Esc` las cierra.

Arrastrar un archivo KML o KMZ sobre el panel satelital lo resalta con `.drop-target` y lo carga.

El planificador usa un panel propio, más ancho y desplazable que los resultados breves. En
escritorio ocupa la parte derecha del mapa; en móvil se limita a la mitad inferior visible. Su
cabecera también puede minimizarse para inspeccionar los puntos y conexiones sobre la imagen.

## Accesibilidad

Las regiones tienen nombres accesibles, los botones de estado usan `aria-pressed`, el panel de
exageración declara `aria-expanded`/`aria-controls`, el gráfico del perfil tiene `role="img"` y el
cargador usa `aria-live="polite"`. `Esc` cierra interfaces transitorias. Todos los controles
interactivos tienen foco visible y se respeta `prefers-reduced-motion`.

## Sistema visual

Los tokens CSS viven en `:root` de [`dist/styles.css`](../../dist/styles.css). Los colores que
necesita JavaScript se centralizan en `BRAND` dentro de
[`dist/js/config.js`](../../dist/js/config.js), evitando literales repetidos entre adaptadores.

| Token | Valor | Uso |
| --- | --- | --- |
| `--brand-dark` | `#015059` | Marca, fondos activos |
| `--brand` | `#0396a6` | Zona de influencia |
| `--brand-light` | `#00cba9` | Lindero, seguimiento y perfil |
| `--primary-500` | `#03c0d0` | Foco y deslizador |
| `--gray-100` … `--gray-950` | escala Slate | Texto, paneles y fondo |

La tipografía es Montserrat con `system-ui` de respaldo. El tema es oscuro y la cabecera usa el
degradado oficial de Gestiagro.

## Adaptación móvil

Por debajo de 760 px las vistas se apilan verticalmente y las dos barras se vuelven horizontales.
Las lecturas de coordenadas cambian de posición, el gráfico del perfil reduce su altura y las
estadísticas pasan a dos columnas. Los paneles de resultados se limitan al 68 % de la altura del
panel y desplazan su contenido. Por debajo de 600 px se simplifica la cabecera y se oculta el pie.
