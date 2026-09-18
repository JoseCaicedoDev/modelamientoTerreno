# Visor 3D

La escena se encapsula en
[`dist/js/adapters/terrain-plot.js`](../../dist/js/adapters/terrain-plot.js). El módulo no busca
elementos del DOM ni administra botones: recibe el contenedor y los datos, crea Plotly y expone
operaciones (`setColorMode`, `setContours`, `setExaggeration`, `resetCamera`, `showCursor`,
`clearCursor` y `resize`).

## Trazas

Plotly se inicializa con tres trazas:

| Índice | Tipo | Uso |
| --- | --- | --- |
| 0 | `surface` | Superficie coloreada por elevación y curvas cada 10 m |
| 1 | `mesh3d` | Textura satelital horneada como color por vértice |
| 2 | `scatter3d` | Baliza sincronizada con el cursor del mapa |

La triangulación de la segunda traza se calcula en la función pura `buildSatelliteMeshData` de
[`dist/js/domain/terrain.js`](../../dist/js/domain/terrain.js). Solo se emiten triángulos cuando
los cuatro vértices de la celda contienen elevación válida.

## Coloración y curvas

La coloración **Elevación** muestra la traza `surface`, su escala altimétrica y las curvas. La
coloración **Satélite** muestra la `mesh3d`; el orquestador deshabilita el botón de curvas porque
esa propiedad pertenece exclusivamente a la superficie.

La paleta, cámara y colores compartidos se centralizan en
[`dist/js/config.js`](../../dist/js/config.js). El adaptador conserva únicamente valores propios de
Plotly, como iluminación, ejes y plantilla del tooltip.

## Escena

La cámara inicial mira desde el sureste (`eye: {x: 1.34, y: -1.5, z: 0.78}`). La relación XY usa
`data.aspectY`; Z se calcula como `0.055 × exageración`, con valor inicial de 2×. Los ejes muestran
Este y Norte UTM en metros y elevación en m.s.n.m.

## Seguimiento sincronizado

Cuando Plotly emite `plotly_hover`, el adaptador entrega las coordenadas al orquestador. Este busca
la celda válida más cercana mediante `terrain.nearestPoint`, actualiza la baliza 3D, mueve el punto
Leaflet y muestra la misma lectura en ambas vistas.

La baliza es una línea vertical turquesa con dos marcadores del mismo color y borde blanco. La
elevación superior está 8 m sobre la celda para mantenerse visible desde distintos ángulos.

## Ciclo de vida y errores

[`dist/app.js`](../../dist/app.js) valida Plotly, Leaflet, Proj4 y `window.TERRAIN_DATA` antes de
crear los módulos. Inicializa primero la escena y después el mapa. Una excepción oculta el cargador,
muestra el mensaje de error y se registra en la consola. En `resize` se redimensionan las dos vistas.
