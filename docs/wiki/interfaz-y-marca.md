# Interfaz y marca

## Estructura

[`dist/index.html`](../../dist/index.html) contiene una cabecera compacta y un visor dividido en dos
columnas iguales:

- **Modelo 3D**, a la izquierda, con la barra vertical de coloración, exageración, curvas y cámara.
- **Imagen satelital**, a la derecha, con controles Leaflet, leyenda y herramienta de perfil.

Las etiquetas de panel se colocan lejos de los controles de cada biblioteca. Las lecturas del
cursor se muestran sobre ambas vistas. El panel del perfil aparece sobre la zona inferior del mapa
y oculta temporalmente la leyenda para evitar solapamientos.

Los scripts se cargan al final en este orden: Plotly, Leaflet, Proj4, `terrain-data.js` y
`app.js`. El último usa `type="module"` y resuelve sus dependencias internas desde `dist/js/`.

## Cabecera

En escritorio mide 66 px. El logo y el nombre **Gestiagro** forman un bloque con proporciones de
marca; a continuación aparecen el título y EPSG:32620. A la derecha se muestran elevación,
resolución y curvas. No se presentan el nombre interno del área ni un descriptor corporativo.

## Herramientas

Los botones usan SVG en línea, estado activo turquesa, foco visible y etiquetas emergentes. En
escritorio la barra del modelo se ubica abajo a la izquierda. En móvil pasa a una fila horizontal,
mientras el botón de perfil permanece dentro del panel satelital.

La exageración abre un panel pequeño con deslizador. El botón de perfil activa instrucciones A–B y
su estado se refleja con `aria-pressed`.

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

Por debajo de 760 px las vistas se apilan verticalmente y la barra del modelo se vuelve horizontal.
Las lecturas de coordenadas cambian de posición, el gráfico del perfil reduce su altura y sus cuatro
estadísticas pasan a dos columnas. Por debajo de 600 px se simplifica la cabecera y se oculta el pie.
