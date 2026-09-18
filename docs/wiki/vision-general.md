# Visión general

## Qué es

Un visor web estático que muestra el relieve del área de estudio en 3D interactivo junto a una
vista satelital 2D sincronizada. Permite consultar coordenadas UTM y elevación en ambas vistas,
cambiar la coloración del terreno y obtener perfiles topográficos a partir de líneas dibujadas en
el mapa. No hay backend: GitHub Pages sirve directamente los archivos de `dist/`.

Publicado en <https://jose.caicedo.dev/modelamientoTerreno/>.

## Arquitectura en tres piezas

**1. Preparación de datos (fuera de línea).** [`scripts/build_terrain_data.py`](../../scripts/build_terrain_data.py)
lee el DEM del producto ALOS PALSAR, que vive *fuera* del repositorio, recorta al área de estudio,
submuestrea y escribe la malla como un único objeto JSON embebido en `dist/terrain-data.js`. Se ejecuta a mano; no forma parte del despliegue.
Ver [Canal de datos](canal-de-datos.md).

**2. Datos publicados.** [`dist/terrain-data.js`](../../dist/terrain-data.js) define
`window.TERRAIN_DATA` con la malla de elevación, los colores satelitales por celda y los polígonos
en WGS 84. Es la única fuente de datos del visor.
Ver [Formato de terrain-data.js](formato-terrain-data.md).

**3. Visor.** [`dist/app.js`](../../dist/app.js) compone módulos ES especializados: núcleo de
terreno, adaptador Plotly, adaptador Leaflet y gráfico SVG. Las dos vistas permanecen visibles en
paralelo y comparten el punto seguido por el cursor. Ver [Arquitectura frontend](arquitectura-frontend.md),
[Visor 3D](visor-3d.md) y [Vista satelital](vista-satelital.md).

```
ALOS_PALSAR/*.dem.tif ──►  build_terrain_data.py  ──►  dist/terrain-data.js
  (fuera del repo)         (manual, Python)              │
                                                         ▼
                              index.html + módulos ES + styles.css
                                      │                   │
                                  Plotly 3D ◄──────► Leaflet 2D
                                      │      cursor       │
                                      └──── perfil SVG ───┘
                                                │
                                   GitHub Pages (workflow en push)
```

## Dependencias

Todas por CDN, sin gestor de paquetes ni build de frontend:

- **Plotly 2.35.2** (`cdn.plot.ly`) — escena 3D.
- **Leaflet 1.9.4** (`unpkg.com`) — mapa satelital.
- **Proj4js 2.21.0** (`jsdelivr.net`) — transformación entre WGS 84 y UTM 20N.
- **Montserrat** (Google Fonts) — tipografía de marca.
- Teselas **Esri World Imagery** (`server.arcgisonline.com`) — imagen satelital del mapa 2D.

En Python: `numpy`, `scipy`, `tifffile`, `Pillow`, `shapely`, `pyproj`.

## Decisiones que conviene conocer

- **Sin herramientas de construcción.** `dist/` se edita directamente y se versiona; el workflow
  solo lo sube. Los módulos ES son nativos del navegador, sin empaquetado ni minificación.
- **Los datos se hornean, no se sirven.** En vez de servir un GeoTIFF o teselas propias, la malla
  ya recortada y submuestreada viaja como JavaScript. Simplifica el hosting y permite el modo
  offline del 3D, pero obliga a regenerar el archivo con el script para cualquier cambio de datos.
- **El DEM crudo no está en el repositorio.** El script lo busca en `../ALOS_PALSAR/` relativo al
  directorio padre del proyecto. Sin esos archivos el canal de datos no se puede re-ejecutar.
- **Dos representaciones 3D coexistentes.** La coloración por elevación usa una traza
  `surface`; la coloración satelital usa una `mesh3d` con color por vértice, porque Plotly no
  admite texturas de imagen sobre `surface`. Ver [Visor 3D](visor-3d.md).
- **Dominio geoespacial aislado.** La búsqueda de celdas, el muestreo del perfil y la triangulación
  viven en un módulo sin DOM, probado con `node:test`. Ver [Arquitectura frontend](arquitectura-frontend.md).
