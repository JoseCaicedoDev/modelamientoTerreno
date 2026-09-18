# Visor 3D

[`dist/app.js`](../../dist/app.js) — 309 líneas dentro de una IIFE, sin módulos ni framework.
El estado vive en tres variables: `colorMode`, `viewMode` y `contoursVisible`.

## Las dos trazas

Plotly se inicializa con **dos** trazas sobre la misma escena
([`app.js:282`](../../dist/app.js#L282)) y se alterna su visibilidad:

| Índice | Tipo | Se usa para |
| --- | --- | --- |
| 0 | `surface` | Coloración por **elevación** |
| 1 | `mesh3d` | Coloración **satelital** |

La razón de la segunda traza: Plotly no puede pintar una imagen sobre una `surface`, así que
`buildSatelliteMesh` ([`app.js:76-126`](../../dist/app.js#L76-L126)) convierte la malla en una
triangulación con color por vértice. Recorre la matriz, salta las celdas `null`, guarda el índice
de cada vértice creado y luego emite dos triángulos por cada cuadro cuyos cuatro vértices existen.
Su iluminación es casi plana (`ambient: 0.88`, `specular: 0.02`) para que la textura satelital se
lea como imagen y no como material brillante.

## Coloración

Dos modos, conmutados por `setColorMode` ([`app.js:174-194`](../../dist/app.js#L174-L194)):

- **Elevación** — traza 0, rampa de 7 paradas de azul profundo a blanco hueso, `cmin`/`cmax` = 0/55,
  barra de color visible.
- **Satélite** — oculta la `surface`, muestra la `mesh3d`, y **deshabilita el botón de curvas**
  (con `title` explicativo, porque las curvas pertenecen a la traza 0).

Al volver de satélite a elevación la traza 0 se reestiliza entera en una sola llamada
`Plotly.restyle`, aunque hoy siempre recibe los mismos valores: ese bloque quedó preparado para
más de una coloración sobre la superficie.

El texto de atribución al pie cambia con el modo vía `updateSourceLabel`.

## Controles

| Control | Efecto |
| --- | --- |
| Vista (Modelo 3D / Satélite) | `setViewMode` — alterna Plotly ↔ Leaflet, oculta los controles `.terrain-only` |
| Coloración (Elevación / Satélite) | `setColorMode` |
| Exageración vertical (1–10) | `scene.aspectratio.z = 0.055 × valor`, por `Plotly.relayout` |
| Curvas 10 m | `contours.z.show` y su proyección sobre la base |
| Restablecer vista | Devuelve `scene.camera` al objeto `camera` inicial |

Las curvas van de 0 a 60 m cada 10 m, proyectadas también sobre el plano inferior
(`project: { z: true }`), lo que dibuja el plano de curvas bajo el terreno.

## Cámara y escena

Posición inicial `eye: {1.34, -1.5, 0.78}`, mirando ligeramente por debajo del centro
(`center.z: -0.08`): una vista desde el sureste. `aspectmode: 'manual'` con `x: 1`,
`y: data.aspectY` y `z` según el deslizador; sin esto Plotly normalizaría los ejes y el relieve
aparecería deformado. El eje Z se fija a `[-2, 58]`, derivado de `minElevation`/`maxElevation`.

Los tooltips muestran Este/Norte UTM y elevación con `hovertemplate`, idénticos en ambas trazas.

## Parámetros de URL

- `?color=elevation|satellite` — coloración inicial, aplicada tras el primer render.
- `?view=satellite` — arranca en la vista de mapa.

## Ciclo de vida

Si falta `Plotly` o `window.TERRAIN_DATA`, se oculta el cargador y se muestra el mensaje de error
([`app.js:276-280`](../../dist/app.js#L276-L280)); el `.catch` del `newPlot` hace lo mismo si el
render falla. El aviso táctil se desvanece a los 3,6 s. En `resize` se redimensionan tanto Plotly
como el mapa Leaflet.
