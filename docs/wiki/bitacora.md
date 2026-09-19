# Bitácora

Qué aportó cada commit, del más reciente al más antiguo.

## 2026-09-18 — Panel de plan de campo más guiado · v2.4.1

El panel del planificador era una sola columna de formularios, botones y filas de 8 px sin decir en
qué orden se usaban. El cuerpo pasa a cuatro pasos numerados (`.planning-steps` en
[`dist/index.html`](../../dist/index.html)): definir el trabajo, generar la propuesta, revisar y
ajustar, y llevar el plan a campo. Cada paso lleva una frase de ayuda y los datos opcionales del
terreno (exclusiones, accesos, control conocido, CSV) quedan plegados en un `<details>` que resume
cuántos hay.

La lista de puntos se agrupa por rol con su punto de color, un contador y una línea que explica
para qué sirve cada rol. Cada fila es un botón que centra el punto en la imagen satelital
(`focusPlanningPoint` en [`adapters/satellite-map.js`](../../dist/js/adapters/satellite-map.js)), y
al pulsar un marcador del mapa se resalta la fila correspondiente. `×` pasa a **Quitar** y `Fijo` a
**Fijado**, ambos con `title` y `aria-label` por punto. El estado de acceso se escribe en lenguaje
de campo: *Acceso por verificar*, *Cerca de un acceso*, *Lejos del acceso dibujado*.

Las advertencias anteponen una etiqueta *Corregir · Revisar · Nota*, las observaciones dicen si la
visual está libre u obstruida, los mensajes de éxito ya no se pintan de rojo (`.planning-message.is-ok`)
y los seis entregables se separan en *Para la comisión de campo* y *Para la oficina*, con las
descargas ocultas hasta que exista propuesta. Los tamaños de texto de 8–9 px suben a 10–12 px y los
botones de fila a 30 px de alto. → [Planificación de campo](planificacion-campo.md) ·
[Interfaz y marca](interfaz-y-marca.md)

## 2026-09-18 — Planificación de fotocontrol y red de apoyo · v2.4.0

Nuevo flujo local para preparar el reconocimiento de campo. Propone GCP y checkpoints en áreas o
corredores, respeta exclusiones, considera accesos y agrega auxiliares cuando el control existente
queda lejos o no se ha cargado. La red se construye desde el control conocido y añade redundancia
para estación total o método combinado; las visuales se contrastan con el perfil del DEM.

El mapa muestra puntos tipificados y arrastrables, conexiones, exclusiones y accesos. El panel
permite fijar, quitar o añadir puntos, cambiar el método de cada observación, guardar en el
navegador y descargar/reabrir un proyecto portable. Entrega informe imprimible, CSV, PENZD, KML y
KMZ. Siete pruebas nuevas cubren distribución, exclusiones, corredor, visibilidad, edición,
persistencia y exportaciones. → [Planificación de campo](planificacion-campo.md)

## 2026-09-18 — Paneles de resultados minimizables

Los controles del tiempo de llenado dejaron el panel de nivel de agua tan alto que tapaba la mitad
de la imagen satelital. Las cinco cabeceras ganan un botón `–` que minimiza el panel a la cabecera
más el control esencial de la herramienta; el de nivel de agua conserva así el deslizador de cota y
permite mover el agua con el mapa a la vista.

`createResultPanel` acepta `collapseButton` y expone `setCollapsed` y `collapsed`. Además, la
intensidad de lluvia y el coeficiente de escorrentía pasan a una sola fila de dos columnas
(`.panel-control-row`), que vuelve a una columna por debajo de 760 px.
→ [Herramientas de análisis](herramientas-analisis.md)

## 2026-09-18 — Tiempo de llenado y referencias del Orinoco

El panel de nivel de agua deja de responder solo "cuánta agua" y responde también "en cuánto
tiempo". [`domain/flood-timing.js`](../../dist/js/domain/flood-timing.js) resuelve el llenado por
balance de volumen en dos regímenes conmutables: por lluvia, con el método racional
`Q = C · i · A` sobre la zona de influencia, y por caudal de entrada externo, con deslizador
logarítmico de 1 a 10.000 m³/s.

El deslizador de cota gana marcas y una línea de contexto con los niveles del Orinoco en Ciudad
Bolívar (estación 0870 del INAMEH): alerta verde 16,50, riesgo de desborde 18,00, récord 2018
18,34 y máximo histórico de 1892 19,14 m.s.n.m. Sirven para situar la cota simulada: el deslizador
llega a 53 m, casi 34 m por encima de lo que el río ha alcanzado nunca.

La estadística "Cota simulada" se sustituyó por "Tiempo de llenado", porque duplicaba el valor que
ya muestra el deslizador.

Contraste sobre la malla real (1.173,5 ha de zona de influencia, lluvia de 20 mm/h con C = 0,45):
cota 18,34 m da 33,81 hm³ y 13,3 días de llenado, equivalentes a 6.403 mm de lluvia bruta — cinco
veces la lluvia anual de Ciudad Bolívar. Con 50 m³/s de aporte externo, 7,8 días.
→ [Herramientas de análisis](herramientas-analisis.md)

## 2026-09-18 — Encuadre ajustado a la zona de influencia

El mapa pasa a usar `zoomSnap: 0`, de modo que `fitBounds` puede tomar zooms fraccionarios. Antes
bajaba al entero inferior y la zona de influencia ocupaba el 69 % del ancho del panel; ahora ocupa
el 94 %, con 18 px de margen en lugar de 34. El botón de "volver al área de estudio" detiene lo que
esté en curso y reencuadra sin animación, para que no quede medio nivel corto si se pulsa durante
un zoom. → [Vista satelital](vista-satelital.md)

## 2026-09-18 — Zona de influencia ampliada a 500 m

El modelo pasa de 200 m a **500 m** de zona de influencia: la malla crece de 136×134 a 160×158
celdas de 25 m (18.776 con dato, 1.173,7 ha) y `terrain-data.js` de 246 KB a 344 KB. La elevación
mínima real baja a -13,6 m.s.n.m. porque entra más terreno bajo junto a la laguna.

Para poder regenerar el modelo se escribieron
[`scripts/build_satellite_texture.py`](../../scripts/build_satellite_texture.py), que descarga las
teselas de Esri World Imagery y las remuestrea a la malla promediando por celda, y
[`scripts/terrain_grid.py`](../../scripts/terrain_grid.py), que centraliza polígono, buffer y
submuestreo para los dos scripts. El payload publica `bufferMeters`, y la leyenda y el resumen de
la cabecera se llenan desde el payload.

Cifras de contraste actualizadas: inundación a 12 m da 190,88 ha y 19,87 hm³ (16,3 % del área);
drenaje con 5 ha de cuenca da 33,65 km de cauces y 174,00 ha encharcadas desde 0,3 m, en 27 ms.
→ [Área de estudio](area-de-estudio.md), [Canal de datos](canal-de-datos.md)

## 2026-09-18 — Capas KML y KMZ del usuario

Carga de archivos propios sobre la imagen satelital, con botón y arrastrar y soltar. El KML se
interpreta con `DOMParser` y se convierte a GeoJSON
([`domain/kml.js`](../../dist/js/domain/kml.js)); el KMZ se descomprime leyendo el ZIP a mano y
usando `DecompressionStream`, sin añadir dependencias
([`domain/kmz.js`](../../dist/js/domain/kmz.js)).

El panel lista las capas con mostrar u ocultar, encuadrar y quitar. Ajustes de móvil: panel de
resultados por encima de los controles de Leaflet, botones de herramienta de 38 px y rótulo del
panel satelital oculto. → [Herramientas de análisis](herramientas-analisis.md)

## 2026-09-18 — Drenaje y zonas de encharcamiento

Análisis hidrológico en el navegador: relleno de depresiones con Priority-Flood, direcciones de
flujo D8, acumulación y extracción de cauces por umbral de cuenca aportante
([`domain/hydrology.js`](../../dist/js/domain/hydrology.js)). Los cauces se dibujan en el mapa y
como traza de líneas en el 3D; el encharcamiento, como mancha sobre el mapa.

Sobre la malla real: 20 ms de cálculo, 21,47 km de cauces con cuenca mínima de 5 ha, 106,13 ha
encharcadas desde 0,3 m y ninguna celda con relleno por debajo del DEM original.
→ [Herramientas de análisis](herramientas-analisis.md)

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
