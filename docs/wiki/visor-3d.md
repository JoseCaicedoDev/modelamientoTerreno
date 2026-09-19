# Visor 3D

La escena se encapsula en
[`dist/js/adapters/terrain-plot.js`](../../dist/js/adapters/terrain-plot.js). El módulo no busca
elementos del DOM ni administra botones: recibe el contenedor y los datos, crea Plotly y expone
operaciones (`setColorMode`, `setContours`, `setExaggeration`, `resetCamera`, `showCursor`,
`clearCursor`, `setWaterLevel`, `setStreams`, `setPlanningPins` y `resize`).

## Trazas

Plotly se inicializa con siete trazas de índice fijo, declaradas en la constante `TRAZA`. Ninguna se
añade ni se elimina en caliente: se muestran y ocultan con `restyle` para que los índices no se
desplacen.

| Índice | Nombre | Tipo | Uso |
| --- | --- | --- | --- |
| 0 | `superficie` | `surface` | Superficie coloreada por elevación y curvas cada 10 m |
| 1 | `satelital` | `mesh3d` | Textura satelital horneada como color por vértice |
| 2 | `cursor` | `scatter3d` | Baliza sincronizada con el cursor del mapa |
| 3 | `cauces` | `scatter3d` | Red de drenaje derivada del análisis hidrológico |
| 4 | `mastiles` | `scatter3d` | Mástiles verticales de los pines del plan de campo |
| 5 | `pines` | `scatter3d` | Cabezas de los pines, con color por rol y código como etiqueta |
| 6 | `agua` | `mesh3d` | Plano de inundación, translúcido y siempre el último |

La traza de agua va al final porque es la única translúcida: adelantarla produce artefactos de
ordenación con el resto de la escena.

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

## Pines del plan de campo

`setPlanningPins(points)` recibe los puntos del plan y dibuja un pin por cada uno: un mástil que
arranca en la cota del terreno y sube `PLANNING_PIN_HEIGHT` metros —12 m definidos en
[`dist/js/config.js`](../../dist/js/config.js)— y una cabeza con el color del rol tomado de
`PLANNING_COLORS`, el código del punto como etiqueta y la elevación en el globo de información.
Como la altura está en metros del modelo, la exageración vertical la escala igual que al relieve.

Los pines los enciende [`app.js`](../../dist/app.js) con el callback `onPlanChange` del
planificador, de modo que se actualizan al generar la propuesta, al mover un punto y al añadir o
quitar uno; cerrar la herramienta los apaga con `setPlanningPins(null)`. Pasar el cursor sobre un
pin no mueve la baliza sincronizada: el manejador de `plotly_hover` solo reacciona a la superficie
y a la malla satelital.
