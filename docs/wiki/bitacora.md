# Bitácora

Qué aportó cada commit, del más reciente al más antiguo.

## 2026-09-18 — Simulación de nivel de agua por cota

Deslizador de cota que inunda las dos vistas a la vez: mancha azul sobre el mapa con la capa
canvas y lámina translúcida en el 3D. Informa área inundada, volumen y porcentaje del área, con
un modo opcional que solo cuenta el agua conectada con el exterior
([`domain/flood.js`](../../dist/js/domain/flood.js)).

Con cota 12 m: 71,44 ha, 4,03 hm³ y 8,9 % del área, idénticos al cálculo hecho aparte sobre
`terrain-data.js`. Se añadieron los parámetros de consulta `?herramienta=`, `?cota=` y
`?conectado=` para reproducir estados exactos, y el deslizador da uso a `actualMinElevation` y
`actualMaxElevation`. → [Herramientas de análisis](herramientas-analisis.md)

## 2026-09-18 — Medición de distancias y áreas

Nueva herramienta en el panel satelital: polilínea con vértices exactos (sin ajustar a la celda)
que al cerrarse sobre el primer punto pasa a polígono. Calcula longitud y perímetro, longitud sobre
el relieve, área proyectada, área real por factor de pendiente y desnivel
([`domain/measure.js`](../../dist/js/domain/measure.js)).

El área se contrastó con `shapely` sobre el polígono de estudio: 591,384 ha en ambos.
`slopeFactor` pasó a usar diferencias de un solo lado en los bordes de la malla.
→ [Herramientas de análisis](herramientas-analisis.md)

## 2026-09-18 — Infraestructura compartida de herramientas

Base para las herramientas de análisis: `domain/grid.js` (malla plana, vecinos D8, orden por
elevación), `domain/geometry.js` (longitudes, áreas, punto en polígono, factor de drapeado),
`ui/tool-controller.js` (herramienta activa exclusiva), `ui/result-panel.js` (panel de resultados
compartido) y `adapters/raster-overlay.js` (capa canvas con tabla píxel → celda).

`satellite-map.js` sustituye el trazado fijo del perfil por `beginDrawing` genérico con grupos de
capas por herramienta, y `terrain-plot.js` reserva las trazas `cauces` y `agua` con índices
nombrados en `TRAZA`. El perfil topográfico se reescribió sobre esa base sin cambios visibles.
→ [Arquitectura frontend](arquitectura-frontend.md)

## v2.3.0 — Arquitectura modular y reglas de mantenimiento

Se incorpora `AGENTS.md` como regla raíz: lectura obligatoria de `docs/llm-wiki.md` y del índice,
actualización de la wiki en cada cambio y límites de arquitectura. La IIFE monolítica se divide en
configuración, dominio geoespacial, adaptadores Plotly/Leaflet y componente SVG. `app.js` queda como
raíz de composición. Se añaden tres pruebas del dominio con `node:test`.
→ [Arquitectura frontend](arquitectura-frontend.md)

## `5e5aee9`–`73f432f` — Perfil topográfico

Herramienta A–B dentro del mapa satelital: línea de previsualización, muestreo del DEM, gráfico SVG,
distancia, elevaciones extremas y desnivel. El botón se trasladó desde la barra 3D al propio mapa.
→ [Vista satelital](vista-satelital.md)

## `909d35a`–`8c01215` — Vista dividida y seguimiento sincronizado

El modelo 3D y la imagen satelital pasan a mostrarse simultáneamente en mitades. El puntero se
sincroniza en ambos sentidos mediante transformaciones WGS 84 ↔ EPSG:32620 y una celda DEM común.
→ [Visor 3D](visor-3d.md), [Vista satelital](vista-satelital.md)

## `33a5078`–`c28ae16` — Interfaz compacta

El panel grande se sustituye por botones flotantes, se compacta y reorganiza la cabecera, se corrige
la cobertura completa del mapa y se ajustan las proporciones de la marca Gestiagro.
→ [Interfaz y marca](interfaz-y-marca.md)

## Sin commitear — Exageración vertical por defecto de 2×

El deslizador arranca en 2× en lugar de 5× (`value` y `<output>` en `index.html`); el relieve se
muestra más cercano a la escala real al abrir. → [Visor 3D](visor-3d.md)

## Sin commitear — Botón de volver al área de estudio

Control Leaflet propio bajo el zoom que reencuadra el mapa sobre la zona de influencia, con la
misma llamada `fitBounds` del encuadre inicial. → [Vista satelital](vista-satelital.md)

## `faac6f8` — Controles en barra inferior en móvil

Por debajo de 760 px el panel de controles deja de flotar sobre el mapa y pasa a una barra al pie
del visor, con los grupos repartidos en dos columnas y botones de 42 px. Solo CSS.
→ [Interfaz y marca](interfaz-y-marca.md)

## `faac6f8` — Retirada del relieve sombreado

(El mismo commit incorpora además la wiki y la guía del repositorio.)

Se elimina la coloración "Relieve": desaparecen el cálculo del sombreado y la clave `hillshade` del
payload, la escala gris y el tercer botón, la regla `.segmented.three-options` y el valor `shade`
del parámetro `?color`. El modelo 3D queda con dos coloraciones: elevación y satélite.
→ [Canal de datos](canal-de-datos.md), [Visor 3D](visor-3d.md)

## `cdadfeb` — Drape satellite imagery over 3D terrain

Coloración **Satélite** dentro del modelo 3D. Añade la traza `mesh3d` con color por vértice y
`buildSatelliteMesh`, la clave `satellite` del payload (un hex por celda) con validación de tamaño
frente a la malla, el tercer botón de coloración y el bloqueo de las curvas en ese modo.
→ [Visor 3D](visor-3d.md)

## `7d88ac3` — Add satellite imagery view for study area

Vista 2D completa: mapa Leaflet con teselas Esri, polígonos de lindero y buffer, leyenda, selector
de vista, inicialización perezosa y parámetro `?view=satellite`. Añade `boundary` y `buffer` al
payload. → [Vista satelital](vista-satelital.md)

## `e5ab14d` — Apply Gestiagro brand system to terrain viewer

Rediseño completo: tokens de marca, degradado de cabecera, Montserrat, logos, panel de controles
rehecho y ajuste de la paleta de la escena Plotly al nuevo sistema.
→ [Interfaz y marca](interfaz-y-marca.md)

## `4c6f09a` — Show real UTM coordinates in terrain viewer

Los ejes pasan de índices de celda a coordenadas UTM reales: el script publica `x`/`y` en metros y
el visor los rotula con `tickformat` y los muestra en los tooltips.
→ [Formato de terrain-data.js](formato-terrain-data.md)

## `3f47818` — Finalize Pages configuration / `92227b4` — Configure GitHub Pages deployment

Workflow de publicación, permisos OIDC, concurrencia y URL del sitio en el README.
→ [Despliegue](despliegue.md)

## `761db34` — begin

Base del proyecto: canal de datos en Python (recorte al buffer, relleno de `nodata`, suavizado,
sombreado desde gradientes, submuestreo), visor Plotly con superficie, curvas de nivel, deslizador
de exageración y alternancia elevación/relieve, y el esqueleto de la página.
