# Herramientas de análisis

Herramientas interactivas del panel satelital. Todas se coordinan con
[`ui/tool-controller.js`](../../dist/js/ui/tool-controller.js), que mantiene **una sola activa a la
vez**, y muestran sus resultados en un panel construido con
[`ui/result-panel.js`](../../dist/js/ui/result-panel.js). `Escape` cierra cualquiera de ellas.

## Minimizar el panel

Los paneles ocupan hasta 560 px de ancho sobre la imagen satelital, y el de nivel de agua es el más
alto de todos. Cada cabecera lleva por eso dos botones: `–` minimiza y `×` cierra.

Minimizado, el panel conserva la cabecera y el control marcado con `.panel-control-essential`, que
hoy es solo el deslizador de cota del nivel de agua: **se puede mover el agua mientras se mira el
mapa despejado**, que es para lo que sirve el modo. El resto de paneles quedan como una barra de
título de 340 px. El estado es de cada panel y persiste mientras la herramienta siga abierta.

`setCollapsed` y el captador `collapsed` forman parte de la API del panel; el botón está cableado
en [`app.js`](../../dist/app.js) para las cinco herramientas.

Los botones viven en `.pane-tools`, arriba a la izquierda del panel satelital
([`index.html:46`](../../dist/index.html#L46)).

| Herramienta | Módulo de dominio | Estado |
| --- | --- | --- |
| Perfil topográfico | [`domain/terrain.js`](../../dist/js/domain/terrain.js) (`sampleLine`) | Implementada |
| Medición de distancias y áreas | [`domain/measure.js`](../../dist/js/domain/measure.js) | Implementada |
| Simulación de nivel de agua | [`domain/flood.js`](../../dist/js/domain/flood.js) | Implementada |
| Tiempo de llenado | [`domain/flood-timing.js`](../../dist/js/domain/flood-timing.js) | Implementada |
| Drenaje y encharcamiento | [`domain/hydrology.js`](../../dist/js/domain/hydrology.js) | Implementada |
| Capas KML y KMZ del usuario | [`domain/kml.js`](../../dist/js/domain/kml.js), [`domain/kmz.js`](../../dist/js/domain/kmz.js) | Implementada |
| Planificación de fotocontrol y red | [`domain/planning.js`](../../dist/js/domain/planning.js) | Implementada |

## Planificación de campo

Propone y permite editar GCP, checkpoints y puntos auxiliares sobre el mapa; construye conexiones
GNSS, de estación total o nivelación y revisa intervisibilidad indicativa sobre el DEM. Guarda el
proyecto localmente y entrega informe imprimible, CSV, PENZD, KML y KMZ. El alcance y los algoritmos
se documentan en [Planificación de campo](planificacion-campo.md).

## Perfil topográfico

Dos vértices ajustados al centro de la celda del DEM, con separación mínima de 30 m. Dibuja la
línea A–B sobre el mapa y muestra el perfil como SVG con distancia, elevación mínima, máxima y
desnivel. Ver [Visor 3D](visor-3d.md) para el muestreo.

## Medición de distancias y áreas

Dibujo de una polilínea sobre el mapa: cada clic añade un vértice, doble clic o `Enter` termina, y
**cerrar sobre el primer vértice convierte el recorrido en un polígono** y añade las áreas.

A diferencia del perfil, la medición **no ajusta los puntos a la celda** (`snap: false`): usa la
coordenada exacta del clic, porque redondear a la malla de 25 m falsearía longitudes y áreas. La
elevación sí procede de la celda más cercana.

### Qué calcula

| Resultado | Cómo |
| --- | --- |
| Longitud / perímetro | Suma de distancias planas entre vértices en UTM |
| Longitud sobre el relieve | Se muestrea cada segmento con `terrain.sampleLine` y se suman las hipotenusas de cada tramo |
| Área proyectada | Fórmula de Gauss sobre los vértices en UTM |
| Área real | Área proyectada × promedio de `sec(pendiente)` de las celdas cuyo centro cae dentro del polígono |
| Desnivel | Diferencia entre la cota máxima y mínima de los vértices |

El área proyectada se contrastó con `shapely`: para el polígono del área de estudio,
`geometry.js` y `shapely` dan el mismo valor, **5.913.840,2 m² (591,384 ha)** y un perímetro de
10.077,5 m. La diferencia es nula porque ambos aplican la misma fórmula sobre las mismas
coordenadas UTM.

### Límites

- El **área real es indicativa**: `sec(pendiente)` se calcula sobre un DEM de 25 m que además viene
  suavizado con `gaussian_filter(σ=1)` en
  [`build_terrain_data.py:50`](../../scripts/build_terrain_data.py#L50), de modo que subestima la
  rugosidad. El panel lo advierte.
- Solo se aceptan puntos **dentro de la zona de influencia**: fuera de ella el DEM es nulo y no hay
  elevación con la que drapear. Al tocar fuera, la herramienta lo indica y no añade el vértice.
- Se mide sobre el plano UTM; el factor de escala de la proyección introduce un error del orden del
  0,006 % en área, muy por debajo de la resolución del DEM.

### Pruebas

[`tests/measure.test.mjs`](../../tests/measure.test.mjs) cubre polilínea abierta, longitud drapeada
en pendiente, área y perímetro de un polígono, factor de drapeado sobre una rampa de pendiente
conocida y el descarte de recorridos de un solo vértice.

## Simulación de nivel de agua

Un deslizador de cota inunda el terreno en las dos vistas a la vez: en el mapa como mancha azul y
en el modelo 3D como lámina translúcida de la que emergen las lomas.

### Cómo se calcula

[`domain/flood.js`](../../dist/js/domain/flood.js) ordena una sola vez las celdas válidas por
elevación y acumula sus cotas. Con eso, el área y el volumen de cualquier cota salen de una
búsqueda binaria y una resta, sin recorrer la malla:

- `área = celdas_por_debajo × 625 m²`
- `volumen = (celdas × cota − suma de cotas) × 625 m²`

La casilla **"solo agua conectada con el exterior"** cambia el criterio: en lugar de marcar toda
celda bajo la cota, hace un recorrido en anchura desde las celdas del borde del área y descarta las
depresiones cerradas que no tienen aporte. La diferencia entre los dos modos es el volumen que vive
en depresiones sin salida.

**En esta malla la casilla cambia muy poco**, porque el terreno casi no tiene depresiones cerradas
por encima del mínimo: a cota 10 m pasa de 167,50 a 167,25 ha, y a cota 25 m las dos dan 317,75 ha.
El modo conectado sigue siendo el correcto para leer una crecida del Orinoco; simplemente, aquí el
relieve no produce mucha diferencia.

El rango del deslizador usa `actualMinElevation` y `actualMaxElevation` del payload, que hasta
ahora se publicaban sin que nadie los leyera.

### Representación

- **Mapa**: [`adapters/raster-overlay.js`](../../dist/js/adapters/raster-overlay.js) pinta un azul
  cuya intensidad crece con la lámina de agua hasta los 5 m. El repintado se agrupa con
  `requestAnimationFrame` para que arrastrar el deslizador no encole trabajo.
- **3D**: un plano `mesh3d` recortado a la zona de influencia, con `opacity: 0.55`. Cambiar la cota
  es un `restyle` de su `z`; la intersección con el relieve la resuelve el z-buffer. Es la única
  traza translúcida de la escena, para evitar los artefactos de ordenación de Plotly.

### Referencias del Orinoco

El área cae en la llanura aluvial del Orinoco, unos 15 km al noreste de Ciudad Bolívar. El
deslizador llega hasta 53 m.s.n.m., muy por encima de lo que el río produce, así que
[`config.js`](../../dist/js/config.js) publica `REFERENCIAS_ORINOCO` con los niveles de la
estación 0870 del INAMEH y el panel los pinta como marcas del deslizador (`<datalist>`) más una
línea de contexto:

| Referencia | Cota (m.s.n.m.) |
| --- | --- |
| Alerta verde | 16,50 |
| Riesgo de desborde | 18,00 |
| Máximo de 1976 | 18,05 |
| Récord de 2018 | 18,34 |
| Máximo histórico de 1892 | 19,14 |

Son cotas de limnígrafo. El DEM es ALOS PALSAR RTC y su datum vertical puede no coincidir con el
del aforo, de modo que la comparación es **orientativa y no una equivalencia de datums**; se anota
en [Pendientes](pendientes.md).

### Contraste

Con cota 12 m el visor informa 190,88 ha, 19,87 hm³ y 16,3 % del área. El mismo cálculo hecho
aparte sobre `terrain-data.js` da exactamente esos valores.

### Límites

El resultado es una inundación estática por cota, no un modelo hidráulico: no considera infiltración
ni obras, y el tiempo que informa sale de un balance de volumen, no de un tránsito. El panel lo
advierte.

### Pruebas

[`tests/flood.test.mjs`](../../tests/flood.test.mjs) comprueba el rango de cotas, el área y el
volumen de la cota simple, el descarte de una depresión aislada en modo conectado, la inundación
total con la cota máxima y la ausencia de agua por debajo del mínimo.

## Tiempo de llenado

Responde en cuánto tiempo entra el volumen que la cota necesita.
[`domain/flood-timing.js`](../../dist/js/domain/flood-timing.js) es aritmética de balance, sin
estado: `tiempo = volumen / caudal`. Lo que cambia entre regímenes es de dónde sale el caudal.

### Régimen por lluvia

Método racional, `Q = C · i · A`, con el área aportante fijada a **toda la zona de influencia**
(1.173,5 ha) porque es la única cuenca que el DEM publica. Dos deslizadores: intensidad de 1 a
120 mm/h y coeficiente de escorrentía de 0,05 a 0,95. El panel informa además la **lámina de lluvia
bruta** necesaria, `volumen × 1000 / (área × C)` en mm, que es la cifra que delata un escenario
imposible.

### Régimen por caudal

Aporte externo constante en m³/s, para crecida de río, rotura o bombeo. El deslizador es
logarítmico — `caudal = 10^(valor/25)` con el valor de 0 a 100 — para cubrir de 1 a 10.000 m³/s sin
perder resolución en la parte baja.

### Contraste

Con la malla real, lluvia de 20 mm/h y C = 0,45:

| Cota | Área | Volumen | Tiempo por lluvia | Lluvia bruta | Tiempo con 50 m³/s |
| --- | --- | --- | --- | --- | --- |
| 10,0 m | 167,50 ha | 16,29 hm³ | 6,4 días | 3.085 mm | 3,8 días |
| 16,5 m | 234,00 ha | 29,36 hm³ | 11,6 días | 5.560 mm | 6,8 días |
| 18,34 m | 251,06 ha | 33,81 hm³ | 13,3 días | 6.403 mm | 7,8 días |
| 25,0 m | 317,75 ha | 52,80 hm³ | 20,8 días | 9.998 mm | 12,2 días |

La lluvia media anual de Ciudad Bolívar ronda los 1.280 mm, con julio como mes más lluvioso
(159 mm). Las láminas de la tabla están entre dos y ocho veces esa cifra anual: **la lluvia local
no puede, por sí sola, llenar estas cotas**. El agua de una inundación aquí viene del río.

### Límites

- Es un balance de volumen con aporte constante: no hay propagación de la onda de crecida,
  infiltración, evaporación ni almacenamiento en el suelo.
- El método racional está pensado para caudales punta en duraciones del orden del tiempo de
  concentración. Aplicado a llenados de días, sobrestima, porque supone la intensidad sostenida.
- El área aportante no es la cuenca real de la depresión: es toda la zona de influencia. Cuando la
  cuenca verdadera sea menor, el tiempo real será mayor.

### Pruebas

[`tests/flood-timing.test.mjs`](../../tests/flood-timing.test.mjs) fija el método racional con un
caso cerrado (36 mm/h sobre 1 km² con C = 1 son exactamente 10 m³/s), la linealidad del
coeficiente, la lámina equivalente, los dos regímenes y el caso sin aporte, que devuelve `Infinity`
y el panel muestra como "sin aporte".

## Drenaje y zonas de encharcamiento

Deriva del DEM por dónde corre el agua y dónde se queda. Dibuja los cauces sobre el mapa y sobre el
modelo 3D, y las zonas de encharcamiento como mancha sobre el mapa.

### Cómo se calcula

[`domain/hydrology.js`](../../dist/js/domain/hydrology.js), en cuatro pasos encadenados que se
calculan la primera vez que se activa la herramienta y quedan en memoria:

1. **Relleno de depresiones (Priority-Flood)** con un montículo binario propio: se siembra el borde
   del área y se avanza hacia adentro elevando cada celda al máximo entre su cota y la de su
   predecesora más un epsilon, que garantiza drenaje incluso en mesetas planas.
2. **Encharcamiento** = DEM rellenado − DEM original, con umbral ajustable.
3. **Direcciones de flujo D8** sobre el DEM rellenado: el vecino de mayor pendiente descendente,
   con distancias de 25 m en cruz y 35,36 m en diagonal.
4. **Acumulación**: una sola pasada de mayor a menor cota rellenada empujando el aporte de cada
   celda a su receptor. Sin recursión y sin riesgo de ciclos.

Sobre la malla real (18.776 celdas válidas) los cuatro pasos tardan **unos 27 ms**, por debajo del
límite de 50 ms que se fijó.

### Controles

- **Cuenca mínima del cauce**, en hectáreas de área aportante. Es más comprensible que un número de
  celdas: `celdas = hectáreas × 10.000 / 625`.
- **Encharcamiento desde**, la profundidad mínima de la depresión. Por defecto **0,3 m**: por debajo
  de 0,2 m solo aparece el ruido del suavizado gaussiano y del redondeo a 0,1 m del DEM.

Al arrastrar los deslizadores solo se repinta el ráster del mapa. Los miles de segmentos de la
traza 3D se redibujan al soltar (`change`), no en cada paso.

### Resultados sobre el área de estudio

Con cuenca mínima de 5 ha y encharcamiento desde 0,3 m: **33,65 km de cauces** en 1.158 celdas y
**174,00 ha encharcadas**, con una profundidad máxima de depresión de 9,1 m. El DEM rellenado nunca
queda por debajo del original en ninguna de las 18.776 celdas.

### Límites

Resultado **indicativo**. El DEM es SRTM de 30 m remuestreado a 25 m y suavizado, de modo que los
cauces están generalizados y las depresiones pueden ser artefactos del propio modelo. No sustituye
un levantamiento hidráulico; el panel lo advierte.

### Pruebas

[`tests/hydrology.test.mjs`](../../tests/hydrology.test.mjs) comprueba que el relleno nunca baja del
DEM original, que una depresión cerrada se llena hasta su nivel de desborde, que el flujo desciende
por la ladera y se acumula en la salida, la conversión de hectáreas a celdas y el efecto del umbral
de profundidad.

## Capas KML y KMZ del usuario

Permite superponer sobre la imagen satelital los archivos que ya tiene la persona usuaria:
linderos, recorridos o puntos exportados de Google Earth o QGIS. Se cargan con el botón del panel
o **arrastrando el archivo sobre el panel satelital**.

### Lectura del archivo

- **KML**: [`domain/kml.js`](../../dist/js/domain/kml.js) lo interpreta con `DOMParser` y lo
  convierte a GeoJSON, que es lo que consume `L.geoJSON`. Cubre `Folder`, `Placemark`, `name`,
  `description`, `Point`, `LineString`, `LinearRing`, `Polygon` con `innerBoundaryIs` y
  `MultiGeometry`, además del color `aabbggrr` de `LineStyle` y `PolyStyle`.
- **KMZ**: [`domain/kmz.js`](../../dist/js/domain/kmz.js) lee el directorio central del ZIP a mano
  y descomprime el primer `.kml` con `DecompressionStream('deflate-raw')`, que ya trae el
  navegador. **No se añadió ninguna dependencia** para soportar el formato.

Ninguna descripción del KML se inserta como HTML: se escribe con `textContent` en el globo de
Leaflet, porque esos textos vienen en CDATA y son contenido ajeno.

### Panel de capas

[`ui/layers-panel.js`](../../dist/js/ui/layers-panel.js) lista cada archivo cargado con su nombre,
el número de elementos y tres acciones: mostrar u ocultar, encuadrar el mapa sobre la capa y
quitarla. Al cargar una capa el mapa se encuadra automáticamente sobre ella.

Las capas **viven solo en la sesión**: no hay servidor donde guardarlas, así que al recargar la
página desaparecen. El panel lo advierte.

### Límites conocidos

No se admiten `NetworkLink`, `gx:Track`, `Model`, `StyleMap` ni iconos remotos. Si el navegador no
expone `DecompressionStream`, el KMZ se rechaza con un mensaje que pide el `.kml` descomprimido.
Un KMZ sin ningún `.kml` dentro también se rechaza con un aviso.

### Pruebas

[`tests/kml.test.mjs`](../../tests/kml.test.mjs) cubre la lectura de coordenadas, la conversión de
color, el reconocimiento de la firma ZIP y la extracción del KML comprimido usando los archivos de
[`tests/fixtures/`](../../tests/fixtures). El parseo del documento se verifica en navegador, porque
`DOMParser` no existe en Node.
