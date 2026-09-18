# Herramientas de análisis

Herramientas interactivas del panel satelital. Todas se coordinan con
[`ui/tool-controller.js`](../../dist/js/ui/tool-controller.js), que mantiene **una sola activa a la
vez**, y muestran sus resultados en un panel construido con
[`ui/result-panel.js`](../../dist/js/ui/result-panel.js). `Escape` cierra cualquiera de ellas.

Los botones viven en `.pane-tools`, arriba a la izquierda del panel satelital
([`index.html:46`](../../dist/index.html#L46)).

| Herramienta | Módulo de dominio | Estado |
| --- | --- | --- |
| Perfil topográfico | [`domain/terrain.js`](../../dist/js/domain/terrain.js) (`sampleLine`) | Implementada |
| Medición de distancias y áreas | [`domain/measure.js`](../../dist/js/domain/measure.js) | Implementada |
| Simulación de nivel de agua | [`domain/flood.js`](../../dist/js/domain/flood.js) | Implementada |

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
depresiones cerradas que no tienen aporte.

El rango del deslizador usa `actualMinElevation` y `actualMaxElevation` del payload, que hasta
ahora se publicaban sin que nadie los leyera.

### Representación

- **Mapa**: [`adapters/raster-overlay.js`](../../dist/js/adapters/raster-overlay.js) pinta un azul
  cuya intensidad crece con la lámina de agua hasta los 5 m. El repintado se agrupa con
  `requestAnimationFrame` para que arrastrar el deslizador no encole trabajo.
- **3D**: un plano `mesh3d` recortado a la zona de influencia, con `opacity: 0.55`. Cambiar la cota
  es un `restyle` de su `z`; la intersección con el relieve la resuelve el z-buffer. Es la única
  traza translúcida de la escena, para evitar los artefactos de ordenación de Plotly.

### Contraste

Con cota 12 m el visor informa 71,44 ha, 4,03 hm³ y 8,9 % del área. El mismo cálculo hecho aparte
sobre `terrain-data.js` da exactamente esos valores.

### Límites

El resultado es una inundación estática por cota, no un modelo hidráulico: no considera caudales,
tiempo, infiltración ni obras. El panel lo advierte.

### Pruebas

[`tests/flood.test.mjs`](../../tests/flood.test.mjs) comprueba el rango de cotas, el área y el
volumen de la cota simple, el descarte de una depresión aislada en modo conectado, la inundación
total con la cota máxima y la ausencia de agua por debajo del mínimo.
